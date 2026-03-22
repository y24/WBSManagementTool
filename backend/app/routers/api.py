from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas
from ..database import get_db

router = APIRouter()

# --- WBS Aggregation ---
@router.get("/wbs", response_model=schemas.WBSResponse)
def read_wbs(
    project_ids: List[int] = Query(default=None),
    include_removed: bool = False,
    weeks: int = 8,
    db: Session = Depends(get_db)
):
    projects = crud.get_wbs_data(db, project_ids, include_removed)
    
    # Dynamic gantt range calculation
    from datetime import date, timedelta
    today = date.today()
    
    all_dates = []
    for p in projects:
        if p.planned_start_date: all_dates.append(p.planned_start_date)
        if p.planned_end_date: all_dates.append(p.planned_end_date)
        if p.actual_start_date: all_dates.append(p.actual_start_date)
        if p.actual_end_date: all_dates.append(p.actual_end_date)
        
    start_point = min(all_dates) if all_dates else today
    end_point = max(all_dates) if all_dates else today
    
    # Add 1 week buffer before and after (or use defaults if no dates)
    start_date = min(start_point - timedelta(days=7), today - timedelta(days=7))
    target_end = max(end_point + timedelta(days=14), today + timedelta(days=weeks*7))
    
    gantt_range = schemas.GanttRange(
        start_date=start_date,
        end_date=target_end,
        today=today
    )
    
    return {
        "filters": {
            "project_ids": project_ids or [],
            "include_removed": include_removed,
            "weeks": weeks
        },
        "gantt_range": gantt_range,
        "projects": projects
    }

# --- Projects ---
@router.post("/projects", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db=db, project=project)

@router.patch("/projects/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, project: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    db_proj = crud.update_project(db, project_id, project)
    if not db_proj: raise HTTPException(status_code=404, detail="Project not found")
    return db_proj

@router.delete("/projects/{project_id}", response_model=schemas.Project)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_proj = crud.delete_project(db, project_id)
    if not db_proj: raise HTTPException(status_code=404, detail="Project not found")
    return db_proj

@router.post("/projects/reorder")
def reorder_projects(req: schemas.ReorderRequest, db: Session = Depends(get_db)):
    crud.reorder_projects(db, req.ordered_ids)
    return {"status": "ok"}

# --- Tasks ---
@router.post("/tasks", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db=db, task=task)

@router.patch("/tasks/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = crud.update_task(db, task_id, task)
    if not db_task: raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@router.delete("/tasks/{task_id}", response_model=schemas.Task)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = crud.delete_task(db, task_id)
    if not db_task: raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@router.post("/tasks/reorder")
def reorder_tasks(req: schemas.ReorderRequest, db: Session = Depends(get_db)):
    crud.reorder_tasks(db, req.ordered_ids)
    return {"status": "ok"}

# --- Subtasks ---
@router.post("/subtasks", response_model=schemas.Subtask)
def create_subtask(subtask: schemas.SubtaskCreate, db: Session = Depends(get_db)):
    return crud.create_subtask(db=db, subtask=subtask)

@router.patch("/subtasks/{subtask_id}", response_model=schemas.Subtask)
def update_subtask(subtask_id: int, subtask: schemas.SubtaskUpdate, db: Session = Depends(get_db)):
    db_subtask = crud.update_subtask(db, subtask_id, subtask)
    if not db_subtask: raise HTTPException(status_code=404, detail="Subtask not found")
    return db_subtask

@router.delete("/subtasks/{subtask_id}", response_model=schemas.Subtask)
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    db_subtask = crud.delete_subtask(db, subtask_id)
    if not db_subtask: raise HTTPException(status_code=404, detail="Subtask not found")
    return db_subtask

@router.post("/subtasks/reorder")
def reorder_subtasks(req: schemas.ReorderRequest, db: Session = Depends(get_db)):
    crud.reorder_subtasks(db, req.ordered_ids)
    return {"status": "ok"}

@router.get("/initial-data", response_model=schemas.InitialData)
def get_initial_data(db: Session = Depends(get_db)):
    ticket_setting = crud.get_system_setting(db, crud.SETTING_TICKET_URL)
    mapping_new = crud.get_system_setting(db, crud.SETTING_STATUS_NEW)
    mapping_blocked = crud.get_system_setting(db, crud.SETTING_STATUS_BLOCKED)
    mapping_done = crud.get_system_setting(db, crud.SETTING_STATUS_DONE)
    
    return {
        "statuses": crud.get_statuses(db),
        "subtask_types": crud.get_subtask_types(db),
        "members": crud.get_members(db),
        "holidays": crud.get_holidays(db),
        "ticket_url_template": ticket_setting.setting_value if ticket_setting else None,
        "status_mapping_new": mapping_new.setting_value if mapping_new else None,
        "status_mapping_blocked": mapping_blocked.setting_value if mapping_blocked else None,
        "status_mapping_done": mapping_done.setting_value if mapping_done else None,
    }

# --- System Settings ---
@router.get("/settings/ticket-url", response_model=schemas.SystemSetting)
def get_ticket_url(db: Session = Depends(get_db)):
    setting = crud.get_system_setting(db, crud.SETTING_TICKET_URL)
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting

@router.put("/settings/{key}", response_model=schemas.SystemSetting)
def set_system_setting(key: str, req: schemas.SystemSettingUpdate, db: Session = Depends(get_db)):
    # Map friendly keys to constants if needed, or just use key directly
    description = {
        crud.SETTING_TICKET_URL: "チケットURLテンプレート",
        crud.SETTING_STATUS_NEW: "ステータス条件: 未着手",
        crud.SETTING_STATUS_BLOCKED: "ステータス条件: ブロック",
        crud.SETTING_STATUS_DONE: "ステータス条件: 完了",
    }.get(key, "システム設定")
    return crud.set_system_setting(db, key, req.setting_value, description)

# --- Status Master ---
@router.post("/masters/statuses", response_model=schemas.Status)
def create_status(status: schemas.StatusCreate, db: Session = Depends(get_db)):
    return crud.create_status(db=db, status=status)

@router.patch("/masters/statuses/{status_id}", response_model=schemas.Status)
def update_status(status_id: int, status: schemas.StatusUpdate, db: Session = Depends(get_db)):
    db_status = crud.update_status(db, status_id, status)
    if not db_status: raise HTTPException(status_code=404, detail="Status not found")
    return db_status

@router.delete("/masters/statuses/{status_id}", response_model=schemas.Status)
def delete_status(status_id: int, db: Session = Depends(get_db)):
    db_status = crud.delete_status(db, status_id)
    if not db_status: raise HTTPException(status_code=404, detail="Status not found")
    return db_status

# --- SubtaskType Master ---
@router.post("/masters/subtask-types", response_model=schemas.SubtaskType)
def create_subtask_type(subtask_type: schemas.SubtaskTypeCreate, db: Session = Depends(get_db)):
    return crud.create_subtask_type(db=db, subtask_type=subtask_type)

@router.patch("/masters/subtask-types/{type_id}", response_model=schemas.SubtaskType)
def update_subtask_type(type_id: int, subtask_type: schemas.SubtaskTypeUpdate, db: Session = Depends(get_db)):
    db_type = crud.update_subtask_type(db, type_id, subtask_type)
    if not db_type: raise HTTPException(status_code=404, detail="SubtaskType not found")
    return db_type

@router.delete("/masters/subtask-types/{type_id}", response_model=schemas.SubtaskType)
def delete_subtask_type(type_id: int, db: Session = Depends(get_db)):
    db_type = crud.delete_subtask_type(db, type_id)
    if not db_type: raise HTTPException(status_code=404, detail="SubtaskType not found")
    return db_type

# --- Member Master ---
@router.post("/masters/members", response_model=schemas.Member)
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    return crud.create_member(db=db, member=member)

@router.patch("/masters/members/{member_id}", response_model=schemas.Member)
def update_member(member_id: int, member: schemas.MemberUpdate, db: Session = Depends(get_db)):
    db_member = crud.update_member(db, member_id, member)
    if not db_member: raise HTTPException(status_code=404, detail="Member not found")
    return db_member

@router.delete("/masters/members/{member_id}", response_model=schemas.Member)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    db_member = crud.delete_member(db, member_id)
    if not db_member: raise HTTPException(status_code=404, detail="Member not found")
    return db_member

# --- Holiday Master ---
@router.post("/masters/holidays", response_model=schemas.Holiday)
def create_holiday(holiday: schemas.HolidayCreate, db: Session = Depends(get_db)):
    return crud.create_holiday(db=db, holiday=holiday)

@router.patch("/masters/holidays/{holiday_id}", response_model=schemas.Holiday)
def update_holiday(holiday_id: int, holiday: schemas.HolidayUpdate, db: Session = Depends(get_db)):
    db_holiday = crud.update_holiday(db, holiday_id, holiday)
    if not db_holiday: raise HTTPException(status_code=404, detail="Holiday not found")
    return db_holiday

@router.delete("/masters/holidays/{holiday_id}", response_model=schemas.Holiday)
def delete_holiday(holiday_id: int, db: Session = Depends(get_db)):
    db_holiday = crud.delete_holiday(db, holiday_id)
    if not db_holiday: raise HTTPException(status_code=404, detail="Holiday not found")
    return db_holiday
