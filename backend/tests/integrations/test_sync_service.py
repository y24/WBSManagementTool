"""Integration tests for the Azure DevOps sync service.

Uses SQLite in-memory (via the existing conftest fixture) and the mock client.
"""
import pytest
from datetime import date, datetime, timezone

from app import models
from app.integrations.azure_devops import router as devops_router
from app.integrations.azure_devops.client import AzureDevOpsMockClient
from app.integrations.azure_devops.hash_service import compute_payload_hash
from app.integrations.azure_devops.repositories import DevopsSyncStateRepository
from app.integrations.azure_devops.settings import AzureDevOpsSettings
from app.integrations.azure_devops.sync_service import SyncResult, SyncSummary, run_sync


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def settings():
    return AzureDevOpsSettings(
        use_mock=True,
        clear_remote_when_local_null=False,
        field_mapping={
            "planned_start_date": "Microsoft.VSTS.Scheduling.StartDate",
            "planned_end_date": "Microsoft.VSTS.Scheduling.TargetDate",
            "actual_start_date": "Custom.ActualStartDate",
            "actual_end_date": "Custom.ActualEndDate",
        },
    )


def _make_project(db, ticket_id=101, testing_id=None, sync=True, planned_start=date(2026, 5, 1), planned_end=date(2026, 5, 10)):
    p = models.Project(
        project_name="Test Project",
        ticket_id=ticket_id,
        testing_id=testing_id,
        sync_to_azure_devops=sync,
        planned_start_date=planned_start,
        planned_end_date=planned_end,
        status_id=1,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_task(db, project_id, ticket_id=201, sync=True, planned_start=date(2026, 5, 2), planned_end=date(2026, 5, 9)):
    t = models.Task(
        project_id=project_id,
        task_name="Test Task",
        ticket_id=ticket_id,
        sync_to_azure_devops=sync,
        planned_start_date=planned_start,
        planned_end_date=planned_end,
        status_id=1,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def _make_subtask(
    db,
    task_id,
    ticket_id=301,
    status_id=1,
    actual_end=date(2026, 5, 8),
):
    s = models.Subtask(
        task_id=task_id,
        subtask_detail="Test Subtask",
        ticket_id=ticket_id,
        sync_to_azure_devops=True,
        actual_end_date=actual_end,
        status_id=status_id,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def test_mock_client_returns_child_work_item_candidates():
    client = AzureDevOpsMockClient(
        {
            201: {
                "System.Title": "Child task",
                "System.WorkItemType": "Task",
                "System.State": "Active",
            },
            202: {
                "System.Title": "Child bug",
                "System.WorkItemType": "Bug",
                "System.State": "New",
            },
        }
    )
    client.set_children(101, [201, 202])

    children = client.get_child_work_items(
        101, ["System.Title", "System.WorkItemType", "System.State"]
    )

    assert [item.id for item in children] == [201, 202]
    assert children[0].fields["System.Title"] == "Child task"
    assert children[1].fields["System.WorkItemType"] == "Bug"


def test_mock_client_returns_default_child_work_item_candidates():
    client = AzureDevOpsMockClient()

    children = client.get_child_work_items(
        101, ["System.Title", "System.WorkItemType", "System.State"]
    )

    assert [item.id for item in children] == [10101, 10102, 10103]
    assert children[0].fields["System.Title"] == "Mock child work item 1 for #101"
    assert children[0].fields["System.WorkItemType"] == "Task"
    assert children[0].fields["System.State"] == "New"


# ---------------------------------------------------------------------------
# Tests: sync_to_azure_devops flag filtering
# ---------------------------------------------------------------------------

class TestSyncTargetFiltering:
    def test_sync_flag_off_is_excluded(self, db_session):
        _make_project(db_session, ticket_id=100, sync=False)
        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=True, settings=AzureDevOpsSettings(), client=client)
        assert result.summary.candidates == 0

    def test_null_ticket_id_is_excluded(self, db_session):
        p = models.Project(
            project_name="No ticket",
            ticket_id=None,
            sync_to_azure_devops=True,
            status_id=1,
        )
        db_session.add(p)
        db_session.commit()
        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=True, settings=AzureDevOpsSettings(), client=client)
        assert result.summary.candidates == 0

    def test_deleted_project_is_excluded(self, db_session):
        p = models.Project(
            project_name="Deleted",
            ticket_id=999,
            sync_to_azure_devops=True,
            is_deleted=True,
            status_id=1,
        )
        db_session.add(p)
        db_session.commit()
        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=True, settings=AzureDevOpsSettings(), client=client)
        assert result.summary.candidates == 0


# ---------------------------------------------------------------------------
# Tests: hash comparison (skip unchanged)
# ---------------------------------------------------------------------------

class TestHashComparison:
    def test_skips_when_hash_matches(self, db_session, settings):
        proj = _make_project(db_session, ticket_id=101)

        # Pre-set last_sent_hash to the current hash
        current_hash = compute_payload_hash({
            "planned_start_date": proj.planned_start_date,
            "planned_end_date": proj.planned_end_date,
            "actual_start_date": proj.actual_start_date,
        })
        state = models.DevopsSyncState(
            entity_type="project",
            entity_id=proj.id,
            last_sent_hash=current_hash,
        )
        db_session.add(state)
        db_session.commit()

        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=True, settings=settings, client=client)

        assert result.summary.skipped_no_local_change == 1
        assert result.summary.fetch_targets == 0
        # Client was never called (mock store is empty and wasn't queried)
        assert result.summary.fetched_from_devops == 0

    def test_fetches_when_hash_differs(self, db_session, settings):
        _make_project(db_session, ticket_id=101)
        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=True, settings=settings, client=client)

        assert result.summary.fetch_targets == 1
        assert result.summary.fetched_from_devops == 1


# ---------------------------------------------------------------------------
# Tests: PATCH logic
# ---------------------------------------------------------------------------

class TestPatchBehavior:
    def test_patches_when_devops_empty(self, db_session, settings):
        """Mock starts empty → WBS has dates → PATCH should be issued."""
        _make_project(db_session, ticket_id=101,
                      planned_start=date(2026, 5, 1), planned_end=date(2026, 5, 10))
        client = AzureDevOpsMockClient()  # empty store → DevOps fields are all None
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.updated == 1
        assert result.summary.failed == 0
        # Mock now holds the patched values
        stored = client.get_stored_fields(101)
        assert stored.get("Microsoft.VSTS.Scheduling.StartDate") == "2026-05-01T00:00:00+09:00"
        assert stored.get("Microsoft.VSTS.Scheduling.TargetDate") == "2026-05-10T00:00:00+09:00"

    def test_skips_patch_when_devops_already_same(self, db_session, settings):
        _make_project(db_session, ticket_id=101,
                      planned_start=date(2026, 5, 1), planned_end=date(2026, 5, 10))

        # Pre-populate mock with the same values already applied
        client = AzureDevOpsMockClient(initial_items={
            101: {
                "Microsoft.VSTS.Scheduling.StartDate": "2026-05-01T00:00:00Z",
                "Microsoft.VSTS.Scheduling.TargetDate": "2026-05-10T00:00:00Z",
                "Custom.ActualStartDate": None,
                "Custom.ActualEndDate": None,
            }
        })
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.skipped_same_remote_value == 1
        assert result.summary.updated == 0

    def test_only_diff_fields_are_patched(self, db_session, settings):
        _make_project(db_session, ticket_id=101,
                      planned_start=date(2026, 5, 1), planned_end=date(2026, 5, 15))

        # Mock: start date already correct, end date differs
        client = AzureDevOpsMockClient(initial_items={
            101: {
                "Microsoft.VSTS.Scheduling.StartDate": "2026-05-01T00:00:00Z",
                "Microsoft.VSTS.Scheduling.TargetDate": "2026-05-10T00:00:00Z",  # stale
                "Custom.ActualStartDate": None,
                "Custom.ActualEndDate": None,
            }
        })
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.updated == 1
        stored = client.get_stored_fields(101)
        # Start date unchanged
        assert stored["Microsoft.VSTS.Scheduling.StartDate"] == "2026-05-01T00:00:00Z"
        # End date patched to new value
        assert stored["Microsoft.VSTS.Scheduling.TargetDate"] == "2026-05-15T00:00:00+09:00"

    def test_last_sent_hash_updated_after_success(self, db_session, settings):
        proj = _make_project(db_session, ticket_id=101,
                             planned_start=date(2026, 5, 1), planned_end=date(2026, 5, 10))
        client = AzureDevOpsMockClient()
        run_sync(db_session, dry_run=False, settings=settings, client=client)

        state_repo = DevopsSyncStateRepository(db_session)
        state = state_repo.get_by_entity("project", proj.id)
        expected_hash = compute_payload_hash({
            "planned_start_date": proj.planned_start_date,
            "planned_end_date": proj.planned_end_date,
            "actual_start_date": None,
        })
        assert state is not None
        assert state.last_sent_hash == expected_hash
        assert state.last_status == "success"

    def test_last_sent_hash_not_updated_on_failure(self, db_session, settings):
        """Simulate a PATCH failure and verify hash is NOT updated."""
        proj = _make_project(db_session, ticket_id=999)

        class FailingMock(AzureDevOpsMockClient):
            def patch_work_item(self, work_item_id, patch_ops):
                raise RuntimeError("Simulated network error")

        client = FailingMock()
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.failed == 1
        state_repo = DevopsSyncStateRepository(db_session)
        state = state_repo.get_by_entity("project", proj.id)
        # Hash must remain None (not updated)
        assert state.last_sent_hash is None
        assert state.last_status == "failed"


class TestStatusConditionBehavior:
    def test_actual_end_date_is_not_patched_when_status_does_not_match(self, db_session, settings):
        proj = _make_project(db_session, ticket_id=None)
        task = _make_task(db_session, proj.id, ticket_id=None)
        _make_subtask(db_session, task.id, ticket_id=301, status_id=2)

        settings.sync_status_conditions = {"actual_end_date": [4]}
        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.skipped_same_remote_value == 1
        assert result.summary.updated == 0
        assert "Custom.ActualEndDate" not in client.get_stored_fields(301)

    def test_actual_end_date_is_patched_when_status_matches(self, db_session, settings):
        proj = _make_project(db_session, ticket_id=None)
        task = _make_task(db_session, proj.id, ticket_id=None)
        _make_subtask(db_session, task.id, ticket_id=301, status_id=4)

        settings.sync_status_conditions = {"actual_end_date": [4]}
        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.updated == 1
        assert client.get_stored_fields(301).get("Custom.ActualEndDate") == "2026-05-08T00:00:00+09:00"


# ---------------------------------------------------------------------------
# Tests: dry_run
# ---------------------------------------------------------------------------

class TestDryRun:
    def test_dry_run_does_not_patch(self, db_session, settings):
        _make_project(db_session, ticket_id=101,
                      planned_start=date(2026, 5, 1), planned_end=date(2026, 5, 10))
        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=True, settings=settings, client=client)

        assert result.dry_run is True
        assert result.status == "dry_run"
        assert result.summary.updated == 1  # "would update" is still counted
        # Mock store must not have been written to
        assert client.get_stored_fields(101) == {}

    def test_dry_run_does_not_update_hash(self, db_session, settings):
        proj = _make_project(db_session, ticket_id=101)
        client = AzureDevOpsMockClient()
        run_sync(db_session, dry_run=True, settings=settings, client=client)

        state_repo = DevopsSyncStateRepository(db_session)
        state = state_repo.get_by_entity("project", proj.id)
        assert state is None  # no state record created in dry_run


# ---------------------------------------------------------------------------
# Tests: multiple entity types
# ---------------------------------------------------------------------------

class TestMultiEntitySync:
    def test_project_testing_id_is_synced_as_additional_work_item(self, db_session, settings):
        proj = _make_project(db_session, ticket_id=10, testing_id=11)

        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.candidates == 2
        assert result.summary.updated == 2
        assert result.summary.failed == 0
        assert client.get_stored_fields(10).get("Microsoft.VSTS.Scheduling.StartDate") == "2026-05-01T00:00:00+09:00"
        assert client.get_stored_fields(11).get("Microsoft.VSTS.Scheduling.StartDate") == "2026-05-01T00:00:00+09:00"

        state_repo = DevopsSyncStateRepository(db_session)
        assert state_repo.get_by_entity("project", proj.id) is not None
        assert state_repo.get_by_entity("project_testing", proj.id) is not None

        result2 = run_sync(db_session, dry_run=False, settings=settings, client=client)
        assert result2.summary.skipped_no_local_change == 2
        assert result2.summary.fetch_targets == 0

    def test_project_task_subtask_all_synced(self, db_session, settings):
        proj = _make_project(db_session, ticket_id=10)
        task = _make_task(db_session, proj.id, ticket_id=20)
        sub = models.Subtask(
            task_id=task.id,
            subtask_detail="Test sub",
            ticket_id=30,
            sync_to_azure_devops=True,
            planned_start_date=date(2026, 5, 3),
            planned_end_date=date(2026, 5, 8),
            status_id=1,
        )
        db_session.add(sub)
        db_session.commit()

        client = AzureDevOpsMockClient()
        result = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result.summary.candidates == 3
        assert result.summary.updated == 3
        assert result.summary.failed == 0

    def test_second_run_fully_skipped(self, db_session, settings):
        """After a successful sync, a second run with unchanged data is skipped."""
        _make_project(db_session, ticket_id=101)
        client = AzureDevOpsMockClient()

        run_sync(db_session, dry_run=False, settings=settings, client=client)
        result2 = run_sync(db_session, dry_run=False, settings=settings, client=client)

        assert result2.summary.skipped_no_local_change == 1
        assert result2.summary.fetch_targets == 0


# ---------------------------------------------------------------------------
# Tests: API lock lifecycle
# ---------------------------------------------------------------------------

class TestSyncEndpointLockLifecycle:
    def test_sync_endpoint_releases_lock_after_success(self, db_session, monkeypatch):
        def fake_run_sync(db, dry_run=False, settings=None):
            now = datetime.now(timezone.utc)
            return SyncResult(
                job_id=now.strftime("%Y%m%d-%H%M%S"),
                status="success",
                started_at=now,
                finished_at=now,
                dry_run=dry_run,
                summary=SyncSummary(),
                errors=[],
            )

        monkeypatch.setattr(devops_router, "run_sync", fake_run_sync)

        first = devops_router.sync_to_azure_devops(
            dry_run=False,
            _token=None,
            db=db_session,
        )
        assert first.status == "success"
        assert db_session.query(models.SyncLock).count() == 0

        second = devops_router.sync_to_azure_devops(
            dry_run=False,
            _token=None,
            db=db_session,
        )
        assert second.status == "success"
