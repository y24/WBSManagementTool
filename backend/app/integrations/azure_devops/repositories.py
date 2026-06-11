"""Repository layer for Azure DevOps sync.

Three repositories:
- SyncTargetRepository       : reads sync-eligible rows from projects/tasks/subtasks
- DevopsSyncStateRepository  : CRUD on devops_sync_states
- SyncLockRepository         : acquire/release sync_locks row
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import Project, Task, Subtask, DevopsSyncState, SyncLock


# ---------------------------------------------------------------------------
# SyncTarget dataclass
# ---------------------------------------------------------------------------

@dataclass
class SyncTarget:
    entity_type: str          # 'project' | 'project_testing' | 'task' | 'subtask'
    entity_id: int
    raw_ticket_id: Optional[int]
    planned_start_date: object  # date | None
    planned_end_date: object
    actual_start_date: object
    actual_end_date: object
    azure_devops_assigned_to: Optional[str]
    azure_devops_state: Optional[str]
    status_id: Optional[int]
    updated_at: datetime


# ---------------------------------------------------------------------------
# SyncTargetRepository
# ---------------------------------------------------------------------------

class SyncTargetRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    @staticmethod
    def _is_ticket_sync_allowed(row: Project | Task | Subtask) -> bool:
        return row.status is None or row.status.azure_devops_sync_ticket_id

    @staticmethod
    def _is_testing_sync_allowed(row: Project) -> bool:
        return row.status is None or row.status.azure_devops_sync_testing_id

    def get_all(self) -> List[SyncTarget]:
        targets: List[SyncTarget] = []

        for row in (
            self._db.query(Project)
            .filter(
                (
                    (Project.sync_to_azure_devops.is_(True) & Project.ticket_id.isnot(None))
                    | (
                        Project.sync_testing_to_azure_devops.is_(True)
                        & Project.testing_id.isnot(None)
                    )
                ),
                Project.is_deleted.is_(False),
            )
            .all()
        ):
            if row.sync_to_azure_devops and row.ticket_id is not None and self._is_ticket_sync_allowed(row):
                targets.append(
                    SyncTarget(
                        entity_type="project",
                        entity_id=row.id,
                        raw_ticket_id=row.ticket_id,
                        planned_start_date=row.planned_start_date,
                        planned_end_date=row.planned_end_date,
                        actual_start_date=row.actual_start_date,
                        actual_end_date=row.actual_end_date,
                        azure_devops_assigned_to=row.assignee.azure_devops_unique_name if row.assignee else None,
                        azure_devops_state=row.status.azure_devops_state if row.status else None,
                        status_id=row.status_id,
                        updated_at=row.updated_at,
                    )
                )
            if row.sync_testing_to_azure_devops and row.testing_id is not None and self._is_testing_sync_allowed(row):
                targets.append(
                    SyncTarget(
                        entity_type="project_testing",
                        entity_id=row.id,
                        raw_ticket_id=row.testing_id,
                        planned_start_date=row.planned_start_date,
                        planned_end_date=row.planned_end_date,
                        actual_start_date=row.actual_start_date,
                        actual_end_date=row.actual_end_date,
                        azure_devops_assigned_to=row.assignee.azure_devops_unique_name if row.assignee else None,
                        azure_devops_state=row.status.azure_devops_state if row.status else None,
                        status_id=row.status_id,
                        updated_at=row.updated_at,
                    )
                )

        for row in (
            self._db.query(Task)
            .filter(
                Task.sync_to_azure_devops.is_(True),
                Task.ticket_id.isnot(None),
                Task.is_deleted.is_(False),
            )
            .all()
        ):
            if not self._is_ticket_sync_allowed(row):
                continue
            targets.append(
                SyncTarget(
                    entity_type="task",
                    entity_id=row.id,
                    raw_ticket_id=row.ticket_id,
                    planned_start_date=row.planned_start_date,
                    planned_end_date=row.planned_end_date,
                    actual_start_date=row.actual_start_date,
                    actual_end_date=row.actual_end_date,
                    azure_devops_assigned_to=row.assignee.azure_devops_unique_name if row.assignee else None,
                    azure_devops_state=row.status.azure_devops_state if row.status else None,
                    status_id=row.status_id,
                    updated_at=row.updated_at,
                )
            )

        for row in (
            self._db.query(Subtask)
            .filter(
                Subtask.sync_to_azure_devops.is_(True),
                Subtask.ticket_id.isnot(None),
                Subtask.is_deleted.is_(False),
            )
            .all()
        ):
            if not self._is_ticket_sync_allowed(row):
                continue
            targets.append(
                SyncTarget(
                    entity_type="subtask",
                    entity_id=row.id,
                    raw_ticket_id=row.ticket_id,
                    planned_start_date=row.planned_start_date,
                    planned_end_date=row.planned_end_date,
                    actual_start_date=row.actual_start_date,
                    actual_end_date=row.actual_end_date,
                    azure_devops_assigned_to=row.assignee.azure_devops_unique_name if row.assignee else None,
                    azure_devops_state=row.status.azure_devops_state if row.status else None,
                    status_id=row.status_id,
                    updated_at=row.updated_at,
                )
            )

        return targets


# ---------------------------------------------------------------------------
# DevopsSyncStateRepository
# ---------------------------------------------------------------------------

class DevopsSyncStateRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_entity(
        self, entity_type: str, entity_id: int
    ) -> Optional[DevopsSyncState]:
        return (
            self._db.query(DevopsSyncState)
            .filter(
                DevopsSyncState.entity_type == entity_type,
                DevopsSyncState.entity_id == entity_id,
            )
            .first()
        )

    def _get_or_create(self, entity_type: str, entity_id: int) -> DevopsSyncState:
        state = self.get_by_entity(entity_type, entity_id)
        if state is None:
            state = DevopsSyncState(
                entity_type=entity_type,
                entity_id=entity_id,
            )
            self._db.add(state)
            self._db.flush()
        return state

    def update_synced_at(self, entity_type: str, entity_id: int) -> None:
        """Record that we visited this entity (hash matched → skipped)."""
        state = self._get_or_create(entity_type, entity_id)
        state.last_synced_at = datetime.now(timezone.utc)
        state.last_status = "skipped_no_local_change"
        self._db.flush()

    def update_success(
        self,
        entity_type: str,
        entity_id: int,
        work_item_id: int,
        current_hash: str,
        local_updated_at: datetime,
        devops_rev: int,
    ) -> None:
        state = self._get_or_create(entity_type, entity_id)
        now = datetime.now(timezone.utc)
        state.work_item_id = work_item_id
        state.last_sent_hash = current_hash
        state.last_local_updated_at = local_updated_at
        state.last_devops_rev = devops_rev
        state.last_synced_at = now
        state.last_success_at = now
        state.last_status = "success"
        state.last_error_message = None
        self._db.flush()

    def update_failed(
        self,
        entity_type: str,
        entity_id: int,
        work_item_id: Optional[int],
        local_updated_at: datetime,
        error_message: str,
    ) -> None:
        state = self._get_or_create(entity_type, entity_id)
        now = datetime.now(timezone.utc)
        if work_item_id is not None:
            state.work_item_id = work_item_id
        state.last_local_updated_at = local_updated_at
        state.last_synced_at = now
        state.last_status = "failed"
        state.last_error_message = error_message
        self._db.flush()


# ---------------------------------------------------------------------------
# SyncLockRepository
# ---------------------------------------------------------------------------

LOCK_NAME_DEVOPS_SYNC = "azure_devops_sync"
LOCK_EXPIRE_MINUTES = 30


class SyncLockRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def acquire(self, job_id: str, lock_name: str = LOCK_NAME_DEVOPS_SYNC) -> bool:
        """Try to acquire the named lock.

        First removes any expired locks, then inserts a new row.
        Returns True on success, False if already locked.
        """
        now = datetime.now(timezone.utc)

        # Remove expired locks so stale entries don't block forever
        self._db.query(SyncLock).filter(
            SyncLock.lock_name == lock_name,
            SyncLock.expires_at <= now,
        ).delete(synchronize_session=False)
        self._db.flush()

        try:
            lock = SyncLock(
                lock_name=lock_name,
                locked_at=now,
                locked_by=job_id,
                expires_at=now + timedelta(minutes=LOCK_EXPIRE_MINUTES),
            )
            self._db.add(lock)
            self._db.flush()
            return True
        except IntegrityError:
            self._db.rollback()
            return False

    def release(
        self, job_id: str, lock_name: str = LOCK_NAME_DEVOPS_SYNC
    ) -> None:
        self._db.query(SyncLock).filter(
            SyncLock.lock_name == lock_name,
            SyncLock.locked_by == job_id,
        ).delete(synchronize_session=False)
        self._db.flush()
