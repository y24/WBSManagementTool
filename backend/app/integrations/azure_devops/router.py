"""FastAPI router for Azure DevOps sync.

Endpoint: POST /integrations/azure-devops/sync
"""
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from .repositories import SyncLockRepository, LOCK_NAME_DEVOPS_SYNC
from .sync_service import SyncError, SyncResult, SyncSummary, run_sync
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

    try:
        result = run_sync(db=db, dry_run=dry_run, settings=settings)
    finally:
        if not dry_run:
            lock_repo.release(job_id)

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
