"""Core sync orchestration service.

Implements the full flow described in design doc §8:
  1. Fetch sync targets
  2. Validate ticket IDs
  3. Hash comparison (skip if unchanged)
  4. Batch-fetch from Azure DevOps
  5. Field-level diff  →  selective PATCH
  6. Update devops_sync_states
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app import crud

from .client import AzureDevOpsClientBase, create_client
from .hash_service import compute_payload_hash, normalize_date, normalize_devops_date
from .repositories import (
    DevopsSyncStateRepository,
    SyncLockRepository,
    SyncTarget,
    SyncTargetRepository,
)
from .settings import AzureDevOpsSettings, get_settings


# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------

@dataclass
class SyncError:
    entity_type: Optional[str]
    entity_id: Optional[int]
    ticket_id: Optional[int]
    message: str


@dataclass
class SyncSummary:
    candidates: int = 0
    invalid_ticket_id: int = 0
    skipped_no_local_change: int = 0
    fetch_targets: int = 0
    fetched_from_devops: int = 0
    skipped_same_remote_value: int = 0
    updated: int = 0
    failed: int = 0
    field_updates: Dict[str, int] = field(default_factory=dict)


@dataclass
class SyncResult:
    job_id: str
    status: str
    started_at: datetime
    finished_at: datetime
    dry_run: bool
    summary: SyncSummary
    errors: List[SyncError] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_sync_status_conditions(db: Session) -> Dict[str, List[int]]:
    setting = crud.get_system_setting(db, crud.SETTING_AZURE_DEVOPS_SYNC_STATUS_CONDITIONS)
    if setting and setting.setting_value:
        try:
            parsed = json.loads(setting.setting_value)
            if isinstance(parsed, dict):
                return {
                    key: [int(status_id) for status_id in value]
                    for key, value in parsed.items()
                    if isinstance(value, list)
                }
        except (TypeError, ValueError, json.JSONDecodeError):
            return {}

    return {"actual_end_date": [4]}


def _is_field_sync_allowed(
    target: SyncTarget,
    wbs_attr: str,
    status_conditions: Dict[str, List[int]],
) -> bool:
    allowed_status_ids = status_conditions.get(wbs_attr) or []
    if not allowed_status_ids:
        return True
    return target.status_id in allowed_status_ids


def _build_active_payload(
    target: SyncTarget,
    field_mapping: Dict[str, str],
    status_conditions: Dict[str, List[int]],
) -> Dict[str, Any]:
    return {
        wbs_attr: getattr(target, wbs_attr, None)
        for wbs_attr in field_mapping.keys()
        if _is_field_sync_allowed(target, wbs_attr, status_conditions)
    }

def _build_patch_ops(
    target: SyncTarget,
    devops_fields: Dict[str, Any],
    field_mapping: Dict[str, str],
    clear_remote_when_local_null: bool,
    status_conditions: Dict[str, List[int]],
) -> List[Dict[str, Any]]:
    """Return a list of JSON Patch operations for fields that differ."""
    ops = []
    for wbs_attr, devops_field in field_mapping.items():
        if not _is_field_sync_allowed(target, wbs_attr, status_conditions):
            continue

        wbs_raw = getattr(target, wbs_attr, None)
        if wbs_attr == "azure_devops_assigned_to":
            wbs_val = str(wbs_raw).strip() if wbs_raw else None
            devops_raw = devops_fields.get(devops_field)
            if isinstance(devops_raw, dict):
                devops_val = devops_raw.get("uniqueName") or devops_raw.get("mailAddress") or devops_raw.get("displayName")
            else:
                devops_val = str(devops_raw).strip() if devops_raw else None
        elif wbs_attr == "azure_devops_state":
            wbs_val = str(wbs_raw).strip() if wbs_raw else None
            devops_raw = devops_fields.get(devops_field)
            devops_val = str(devops_raw).strip() if devops_raw else None
        else:
            wbs_val = normalize_date(wbs_raw)
            devops_val = normalize_devops_date(devops_fields.get(devops_field))

        if wbs_val is None and not clear_remote_when_local_null:
            continue

        if wbs_val == devops_val:
            continue

        patch_value = wbs_val if wbs_attr in ("azure_devops_assigned_to", "azure_devops_state") or wbs_val is None else f"{wbs_val}T00:00:00+09:00"
        ops.append({"op": "add", "path": f"/fields/{devops_field}", "value": patch_value})

    return ops


def _determine_status(summary: SyncSummary, dry_run: bool) -> str:
    if dry_run:
        return "dry_run"
    if summary.failed == 0:
        return "success"
    total_ok = (
        summary.skipped_no_local_change
        + summary.skipped_same_remote_value
        + summary.updated
    )
    return "partial_success" if total_ok > 0 else "failed"


def _record_field_updates(summary: SyncSummary, patch_ops: List[Dict[str, Any]]) -> None:
    for op in patch_ops:
        path = op.get("path", "")
        field_name = path[len("/fields/"):] if path.startswith("/fields/") else path
        summary.field_updates[field_name] = summary.field_updates.get(field_name, 0) + 1


# ---------------------------------------------------------------------------
# Main sync function
# ---------------------------------------------------------------------------

def run_sync(
    db: Session,
    dry_run: bool = False,
    settings: Optional[AzureDevOpsSettings] = None,
    client: Optional[AzureDevOpsClientBase] = None,
) -> SyncResult:
    """Execute a full Azure DevOps sync cycle.

    Parameters
    ----------
    db:      SQLAlchemy session (caller commits/rolls back on error)
    dry_run: When True, skips PATCH calls and hash updates
    settings: Override loaded settings (useful in tests)
    client:   Override the DevOps client (useful in tests)
    """
    if settings is None:
        settings = get_settings()
    if client is None:
        client = create_client(settings)
    sync_status_conditions = settings.sync_status_conditions or _load_sync_status_conditions(db)

    started_at = datetime.now(timezone.utc)
    job_id = started_at.strftime("%Y%m%d-%H%M%S")
    summary = SyncSummary()
    errors: List[SyncError] = []

    target_repo = SyncTargetRepository(db)
    state_repo = DevopsSyncStateRepository(db)

    # ------------------------------------------------------------------
    # 1. Fetch sync targets and validate ticket IDs
    # ------------------------------------------------------------------
    all_targets = target_repo.get_all()
    summary.candidates = len(all_targets)

    fetch_queue: List[Tuple[SyncTarget, int, str]] = []  # (target, work_item_id, hash)

    for target in all_targets:
        if not target.raw_ticket_id or target.raw_ticket_id <= 0:
            summary.invalid_ticket_id += 1
            errors.append(
                SyncError(
                    entity_type=target.entity_type,
                    entity_id=target.entity_id,
                    ticket_id=target.raw_ticket_id,
                    message="Ticket ID is not a valid Azure DevOps Work Item ID.",
                )
            )
            continue

        work_item_id = target.raw_ticket_id
        current_hash = compute_payload_hash(
            _build_active_payload(
                target,
                settings.field_mapping,
                sync_status_conditions,
            )
        )

        state = state_repo.get_by_entity(target.entity_type, target.entity_id)
        last_hash = state.last_sent_hash if state else None

        if current_hash == last_hash:
            summary.skipped_no_local_change += 1
            if not dry_run:
                state_repo.update_synced_at(target.entity_type, target.entity_id)
            continue

        fetch_queue.append((target, work_item_id, current_hash))

    summary.fetch_targets = len(fetch_queue)

    if not fetch_queue:
        if not dry_run:
            db.commit()
        return SyncResult(
            job_id=job_id,
            status=_determine_status(summary, dry_run),
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            dry_run=dry_run,
            summary=summary,
            errors=errors,
        )

    # ------------------------------------------------------------------
    # 2. Batch-fetch current values from Azure DevOps
    # ------------------------------------------------------------------
    unique_ids = list({wid for _, wid, _ in fetch_queue})
    fetch_fields = ["System.Id"] + list(settings.field_mapping.values())

    try:
        devops_items = client.get_work_items_batch(unique_ids, fetch_fields)
        summary.fetched_from_devops = len(devops_items)
    except Exception as exc:
        if not dry_run:
            db.rollback()
        return SyncResult(
            job_id=job_id,
            status="failed",
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            dry_run=dry_run,
            summary=summary,
            errors=[
                SyncError(
                    entity_type=None,
                    entity_id=None,
                    ticket_id=None,
                    message=f"Failed to fetch from Azure DevOps: {exc}",
                )
            ],
        )

    # ------------------------------------------------------------------
    # 3. Compare and PATCH per item
    # ------------------------------------------------------------------
    for target, work_item_id, current_hash in fetch_queue:
        devops_item = devops_items.get(work_item_id)

        if devops_item is None:
            summary.failed += 1
            msg = f"Work Item {work_item_id} not found in Azure DevOps."
            errors.append(
                SyncError(
                    entity_type=target.entity_type,
                    entity_id=target.entity_id,
                    ticket_id=work_item_id,
                    message=msg,
                )
            )
            if not dry_run:
                state_repo.update_failed(
                    target.entity_type,
                    target.entity_id,
                    work_item_id,
                    target.updated_at,
                    msg,
                )
            continue

        patch_ops = _build_patch_ops(
            target,
            devops_item.fields,
            settings.field_mapping,
            settings.clear_remote_when_local_null,
            sync_status_conditions,
        )

        if not patch_ops:
            # Azure DevOps already holds the same values
            summary.skipped_same_remote_value += 1
            if not dry_run:
                state_repo.update_success(
                    target.entity_type,
                    target.entity_id,
                    work_item_id,
                    current_hash,
                    target.updated_at,
                    devops_item.rev,
                )
            continue

        # dry_run: count as "would update" but skip PATCH
        if dry_run:
            summary.updated += 1
            _record_field_updates(summary, patch_ops)
            continue

        try:
            updated = client.patch_work_item(work_item_id, patch_ops)
            summary.updated += 1
            _record_field_updates(summary, patch_ops)
            state_repo.update_success(
                target.entity_type,
                target.entity_id,
                work_item_id,
                current_hash,
                target.updated_at,
                updated.rev,
            )
        except Exception as exc:
            summary.failed += 1
            msg = str(exc)
            errors.append(
                SyncError(
                    entity_type=target.entity_type,
                    entity_id=target.entity_id,
                    ticket_id=work_item_id,
                    message=msg,
                )
            )
            state_repo.update_failed(
                target.entity_type,
                target.entity_id,
                work_item_id,
                target.updated_at,
                msg,
            )

    if not dry_run:
        db.commit()

    return SyncResult(
        job_id=job_id,
        status=_determine_status(summary, dry_run),
        started_at=started_at,
        finished_at=datetime.now(timezone.utc),
        dry_run=dry_run,
        summary=summary,
        errors=errors,
    )
