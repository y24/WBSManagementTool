"""FastAPI router for Azure DevOps sync.

Endpoint: POST /integrations/azure-devops/sync
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from .repositories import SyncLockRepository, LOCK_NAME_DEVOPS_SYNC
from .sync_service import SyncError, SyncResult, SyncSummary, run_sync
from .client import create_client
from .settings import get_settings


router = APIRouter(prefix="/integrations/azure-devops", tags=["azure-devops"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SyncSummaryOut(BaseModel):
    candidates: int
    invalid_ticket_id: int
    skipped_no_local_change: int
    fetch_targets: int
    fetched_from_devops: int
    skipped_same_remote_value: int
    updated: int
    failed: int
    field_updates: Dict[str, int] = Field(default_factory=dict)


class SyncErrorOut(BaseModel):
    entity_type: Optional[str]
    entity_id: Optional[int]
    ticket_id: Optional[int]
    message: str


class SyncResponse(BaseModel):
    job_id: str
    status: str
    dry_run: bool
    started_at: datetime
    finished_at: datetime
    summary: SyncSummaryOut
    errors: List[SyncErrorOut]


class WorkItemCandidateOut(BaseModel):
    id: int
    title: Optional[str] = None
    work_item_type: Optional[str] = None
    state: Optional[str] = None


class AzureDevOpsUserOut(BaseModel):
    descriptor: str
    display_name: str
    unique_name: str
    mail_address: Optional[str] = None


# ---------------------------------------------------------------------------
# Token verification dependency
# ---------------------------------------------------------------------------

def _verify_sync_token(x_sync_token: str = Header(..., alias="X-Sync-Token")) -> None:
    expected = os.getenv("WBS_SYNC_TOKEN", "")
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="WBS_SYNC_TOKEN is not configured on the server.",
        )
    if x_sync_token != expected:
        raise HTTPException(status_code=401, detail="Invalid sync token.")


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/sync", response_model=SyncResponse)
def sync_to_azure_devops(
    dry_run: bool = Query(default=False),
    _token: None = Depends(_verify_sync_token),
    db: Session = Depends(get_db),
) -> SyncResponse:
    """Synchronise WBS date fields to Azure DevOps Work Items.

    Query parameters:
    - dry_run (bool, default false): run without writing to Azure DevOps
    """
    settings = get_settings()
    lock_repo = SyncLockRepository(db)

    # Determine a job_id for lock ownership
    from datetime import timezone
    job_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    if not dry_run:
        acquired = lock_repo.acquire(job_id)
        if not acquired:
            raise HTTPException(
                status_code=409,
                detail="Another sync is already running. Try again later.",
            )
        db.commit()

    try:
        result = run_sync(db=db, dry_run=dry_run, settings=settings)
    except Exception:
        if not dry_run:
            db.rollback()
        raise
    finally:
        if not dry_run:
            lock_repo.release(job_id)
            db.commit()

    return SyncResponse(
        job_id=result.job_id,
        status=result.status,
        dry_run=result.dry_run,
        started_at=result.started_at,
        finished_at=result.finished_at,
        summary=SyncSummaryOut(
            candidates=result.summary.candidates,
            invalid_ticket_id=result.summary.invalid_ticket_id,
            skipped_no_local_change=result.summary.skipped_no_local_change,
            fetch_targets=result.summary.fetch_targets,
            fetched_from_devops=result.summary.fetched_from_devops,
            skipped_same_remote_value=result.summary.skipped_same_remote_value,
            updated=result.summary.updated,
            failed=result.summary.failed,
            field_updates=result.summary.field_updates,
        ),
        errors=[
            SyncErrorOut(
                entity_type=e.entity_type,
                entity_id=e.entity_id,
                ticket_id=e.ticket_id,
                message=e.message,
            )
            for e in result.errors
        ],
    )


@router.get(
    "/work-items/{parent_work_item_id}/children",
    response_model=List[WorkItemCandidateOut],
)
def get_child_work_item_candidates(parent_work_item_id: int) -> List[WorkItemCandidateOut]:
    """Return Azure DevOps Work Items linked as children of the parent Work Item."""
    if parent_work_item_id <= 0:
        raise HTTPException(status_code=400, detail="parent_work_item_id must be positive.")

    settings = get_settings()
    if not settings.use_mock and (not settings.organization or not settings.pat):
        raise HTTPException(
            status_code=503,
            detail="Azure DevOps settings are not configured on the server.",
        )

    client = create_client(settings)
    fields = ["System.Title", "System.WorkItemType", "System.State"]
    try:
        children = client.get_child_work_items(parent_work_item_id, fields)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch child Work Items from Azure DevOps: {exc}",
        ) from exc

    return [
        WorkItemCandidateOut(
            id=item.id,
            title=item.fields.get("System.Title"),
            work_item_type=item.fields.get("System.WorkItemType"),
            state=item.fields.get("System.State"),
        )
        for item in children
    ]


@router.get("/users", response_model=List[AzureDevOpsUserOut])
def list_azure_devops_users() -> List[AzureDevOpsUserOut]:
    """Return Azure DevOps users without persisting the fetched list locally."""
    settings = get_settings()
    if not settings.use_mock and (not settings.organization or not settings.pat):
        raise HTTPException(
            status_code=503,
            detail="Azure DevOps settings are not configured on the server.",
        )

    client = create_client(settings)
    try:
        users = client.list_users()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch Azure DevOps users: {exc}",
        ) from exc

    results: List[AzureDevOpsUserOut] = []
    for user in users:
        display_name = user.get("displayName") or user.get("principalName") or user.get("mailAddress") or ""
        unique_name = user.get("principalName") or user.get("mailAddress") or display_name
        descriptor = user.get("descriptor") or unique_name
        if not unique_name:
            continue
        results.append(
            AzureDevOpsUserOut(
                descriptor=descriptor,
                display_name=display_name,
                unique_name=unique_name,
                mail_address=user.get("mailAddress"),
            )
        )

    return sorted(results, key=lambda user: (user.display_name.lower(), user.unique_name.lower()))
