import pytest
from datetime import date
from decimal import Decimal
from app import crud, schemas, models

def test_create_project(db_session):
    project_in = schemas.ProjectCreate(project_name="Test Project")
    db_project = crud.create_project(db_session, project_in)
    assert db_project.project_name == "Test Project"
    assert db_project.id is not None

def test_link_url_columns_are_unbounded_text():
    assert isinstance(models.Project.__table__.c.link_url.type, models.Text)
    assert isinstance(models.Task.__table__.c.link_url.type, models.Text)
    assert isinstance(models.Subtask.__table__.c.link_url.type, models.Text)

def test_create_and_update_long_link_url(db_session):
    long_url = "https://example.com/" + ("a" * 700)
    project = crud.create_project(
        db_session,
        schemas.ProjectCreate(project_name="Long URL Project", link_url=long_url),
    )
    assert project.link_url == long_url

    task = crud.create_task(
        db_session,
        schemas.TaskCreate(project_id=project.id, task_name="Long URL Task", link_url=long_url),
    )
    assert task.link_url == long_url

    subtask = crud.create_subtask(
        db_session,
        schemas.SubtaskCreate(task_id=task.id, subtask_detail="Long URL Subtask", link_url=long_url),
    )
    assert subtask.link_url == long_url

    updated_url = "https://example.com/" + ("b" * 900)
    updated_subtask = crud.update_subtask(
        db_session,
        subtask.id,
        schemas.SubtaskUpdate(link_url=updated_url),
    )
    assert updated_subtask.link_url == updated_url

def test_create_task_and_recalculate_dates(db_session):
    # 1. Create project
    project_in = schemas.ProjectCreate(project_name="Test Project", is_auto_planned_date=True)
    db_project = crud.create_project(db_session, project_in)
    
    # 2. Create task
    task_in = schemas.TaskCreate(
        project_id=db_project.id,
        task_name="Test Task",
        planned_start_date=date(2023, 1, 1),
        planned_end_date=date(2023, 1, 10),
        is_auto_planned_date=False, # Manual for now
        status_id=1 # New
    )
    db_task = crud.create_task(db_session, task_in)
    
    # 3. Check if project dates were updated (triggered by create_task)
    db_session.refresh(db_project)
    assert db_project.planned_start_date == date(2023, 1, 1)
    assert db_project.planned_end_date == date(2023, 1, 10)

def test_task_status_recalculation(db_session):
    # Setup: Project, Task, and Subtasks
    project_in = schemas.ProjectCreate(project_name="P1")
    db_project = crud.create_project(db_session, project_in)
    
    task_in = schemas.TaskCreate(project_id=db_project.id, task_name="T1", status_id=1) # New
    db_task = crud.create_task(db_session, task_in)
    
    # Create subtask with status "In Progress" (ID 2)
    subtask_in = schemas.SubtaskCreate(
        task_id=db_task.id,
        status_id=2, # In Progress
        subtask_detail="S1"
    )
    crud.create_subtask(db_session, subtask_in)
    
    # Task should become "In Progress"
    db_session.refresh(db_task)
    assert db_task.status_id == 2
    
    # Create another subtask with status "Blocked" (ID 5)
    subtask_blocked = schemas.SubtaskCreate(
        task_id=db_task.id,
        status_id=5, # Blocked
        subtask_detail="S2"
    )
    crud.create_subtask(db_session, subtask_blocked)
    
    # Task should become "Blocked" (Priority)
    db_session.refresh(db_task)
    assert db_task.status_id == 5

def test_get_wbs_data_with_calculations(db_session):
    # Complex setup to test aggregation
    project_in = schemas.ProjectCreate(project_name="P1")
    db_project = crud.create_project(db_session, project_in)
    
    task_in = schemas.TaskCreate(project_id=db_project.id, task_name="T1")
    db_task = crud.create_task(db_session, task_in)
    
    # Subtask 1: 5 days effort
    crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=db_task.id, status_id=1, planned_effort_days=5, subtask_detail="S1",
        planned_start_date=date(2023,1,1), planned_end_date=date(2023,1,5)
    ))
    # Subtask 2: 3 days effort, overlapping
    crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=db_task.id, status_id=1, planned_effort_days=3, subtask_detail="S2",
        planned_start_date=date(2023,1,3), planned_end_date=date(2023,1,7)
    ))
    
    wbs_data = crud.get_wbs_data(db_session, project_ids=[db_project.id])
    assert len(wbs_data) == 1
    p_wbs = wbs_data[0]
    assert p_wbs.planned_effort_total == 8
    assert p_wbs.tasks[0].planned_effort_total == 8
    assert p_wbs.tasks[0].is_overlapping == True

def test_get_wbs_data_keeps_zero_planned_effort_totals(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))

    crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        planned_effort_days=0,
        subtask_detail="S1",
    ))
    crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        planned_effort_days=0,
        subtask_detail="S2",
    ))

    wbs_data = crud.get_wbs_data(db_session, project_ids=[project.id])
    p_wbs = wbs_data[0]

    assert p_wbs.planned_effort_total == 0
    assert p_wbs.tasks[0].planned_effort_total == 0

def test_auto_planned_effort_excludes_review_days(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))

    subtask = crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        subtask_detail="S1",
        planned_start_date=date(2023, 1, 2),
        planned_end_date=date(2023, 1, 6),
        work_days=3,
        review_days=2,
        workload_percent=50,
        is_auto_effort=True,
    ))

    # work_days(3) を直接使用: 3 * 工数比率0.5 = 1.5
    assert subtask.planned_effort_days == Decimal("1.5")

def test_auto_planned_effort_fractional_review_days(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))

    subtask = crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        subtask_detail="S1",
        planned_start_date=date(2023, 1, 2),
        planned_end_date=date(2023, 1, 4),  # addBusinessDays(1/2, 2+0.5) -> 1/4
        work_days=2,
        review_days=Decimal("0.5"),
        workload_percent=100,
        is_auto_effort=True,
    ))

    # work_days(2) を直接使用: 2 * 工数比率1.0 = 2.0 (端数レビュー日数が混入しない)
    assert subtask.planned_effort_days == Decimal("2.0")

def test_auto_actual_effort_excludes_review_period(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))

    subtask = crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        subtask_detail="S1",
        actual_start_date=date(2023, 1, 2),
        review_start_date=date(2023, 1, 5),
        actual_end_date=date(2023, 1, 6),
        workload_percent=50,
        is_auto_effort=True,
    ))

    # 作業日数(5営業日 - レビュー2営業日 = 3) * 工数比率0.5 = 1.5
    assert subtask.actual_effort_days == Decimal("1.5")

def test_auto_actual_effort_same_day_start_review_end(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))

    subtask = crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        subtask_detail="S1",
        actual_start_date=date(2023, 1, 2),
        review_start_date=date(2023, 1, 2),
        actual_end_date=date(2023, 1, 2),
        workload_percent=100,
        is_auto_effort=True,
    ))

    # 開始・レビュー開始・終了が同日: 作業とレビューが重複 → 作業日数1日 * 1.0 = 1
    assert subtask.actual_effort_days == Decimal("1")

def test_in_review_without_review_days_preserves_actual_end_date(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))
    original_end = date(2023, 1, 10)
    subtask = crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        subtask_detail="S1",
        actual_start_date=date(2023, 1, 1),
        actual_end_date=original_end,
        review_days=None
    ))

    updated = crud.update_subtask(db_session, subtask.id, schemas.SubtaskUpdate(status_id=3))
    assert updated.actual_end_date == original_end

    crud.refresh_subtasks_actual_end_date(db_session, [project.id])
    db_session.refresh(updated)
    assert updated.actual_end_date == original_end

def test_in_review_with_zero_review_days_preserves_actual_end_date(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))
    original_end = date(2023, 1, 10)
    subtask = crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        subtask_detail="S1",
        actual_start_date=date(2023, 1, 1),
        actual_end_date=original_end,
        review_days=0
    ))

    updated = crud.update_subtask(db_session, subtask.id, schemas.SubtaskUpdate(status_id=3))
    assert updated.actual_end_date == original_end

    crud.refresh_subtasks_actual_end_date(db_session, [project.id])
    db_session.refresh(updated)
    assert updated.actual_end_date == original_end

def test_in_review_with_positive_review_days_tracks_today(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(db_session, schemas.TaskCreate(project_id=project.id, task_name="T1"))
    subtask = crud.create_subtask(db_session, schemas.SubtaskCreate(
        task_id=task.id,
        status_id=1,
        subtask_detail="S1",
        actual_start_date=date(2023, 1, 1),
        actual_end_date=date(2023, 1, 10),
        review_days=1
    ))

    updated = crud.update_subtask(db_session, subtask.id, schemas.SubtaskUpdate(status_id=3))
    assert updated.actual_end_date == date.today()

def test_shift_dates_moves_subtask_interruptions(db_session):
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(
        db_session,
        schemas.TaskCreate(
            project_id=project.id,
            task_name="T1",
            planned_start_date=date(2023, 1, 2),
            planned_end_date=date(2023, 1, 6),
            is_auto_planned_date=False,
        ),
    )
    subtask = crud.create_subtask(
        db_session,
        schemas.SubtaskCreate(
            task_id=task.id,
            subtask_detail="S1",
            planned_start_date=date(2023, 1, 2),
            planned_end_date=date(2023, 1, 6),
        ),
    )
    interruption = crud.create_subtask_interruption(
        db_session,
        schemas.SubtaskInterruptionCreate(
            subtask_id=subtask.id,
            interruption_date=date(2023, 1, 5),
            resumption_date=date(2023, 1, 10),
            reason="Waiting",
        ),
    )

    crud.shift_dates(
        db_session,
        schemas.ShiftDatesRequest(
            project_ids=[],
            task_ids=[task.id],
            subtask_ids=[],
            new_base_date=date(2023, 1, 4),
        ),
    )

    db_session.refresh(interruption)
    assert interruption.interruption_date == date(2023, 1, 9)
    assert interruption.resumption_date == date(2023, 1, 12)


def test_actual_effort_excludes_interruption_days(db_session):
    """中断期間は実績工数から除外されること"""
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(
        db_session,
        schemas.TaskCreate(
            project_id=project.id,
            task_name="T1",
            is_auto_planned_date=False,
        ),
    )
    # 2023-01-02(月) 〜 2023-01-13(金): 10営業日
    # 中断: 2023-01-05(木) 〜 2023-01-09(月)復帰 → 除外は01/05〜01/06の2営業日
    # 期待実績工数 = (10 - 2) * 1.0 = 8日
    subtask = crud.create_subtask(
        db_session,
        schemas.SubtaskCreate(
            task_id=task.id,
            subtask_detail="S1",
            actual_start_date=date(2023, 1, 2),
            actual_end_date=date(2023, 1, 13),
            is_auto_effort=True,
            workload_percent=100,
        ),
    )

    crud.create_subtask_interruption(
        db_session,
        schemas.SubtaskInterruptionCreate(
            subtask_id=subtask.id,
            interruption_date=date(2023, 1, 5),
            resumption_date=date(2023, 1, 9),
        ),
    )

    db_session.refresh(subtask)
    assert subtask.actual_effort_days == Decimal("8.0")


def test_actual_effort_excludes_open_ended_interruption(db_session):
    """resumption_date が未設定の中断は実績終了日まで除外されること"""
    project = crud.create_project(db_session, schemas.ProjectCreate(project_name="P1"))
    task = crud.create_task(
        db_session,
        schemas.TaskCreate(
            project_id=project.id,
            task_name="T1",
            is_auto_planned_date=False,
        ),
    )
    # 2023-01-02(月) 〜 2023-01-06(金): 5営業日
    # 中断: 2023-01-04(水) 〜 未設定 → 01/04〜01/06 の3営業日を除外
    # 期待実績工数 = (5 - 3) * 1.0 = 2日
    subtask = crud.create_subtask(
        db_session,
        schemas.SubtaskCreate(
            task_id=task.id,
            subtask_detail="S1",
            actual_start_date=date(2023, 1, 2),
            actual_end_date=date(2023, 1, 6),
            is_auto_effort=True,
            workload_percent=100,
        ),
    )

    crud.create_subtask_interruption(
        db_session,
        schemas.SubtaskInterruptionCreate(
            subtask_id=subtask.id,
            interruption_date=date(2023, 1, 4),
            resumption_date=None,
        ),
    )

    db_session.refresh(subtask)
    assert subtask.actual_effort_days == Decimal("2.0")
