from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from datetime import date, timedelta
import httpx
import json
from sqlalchemy import func
from sqlalchemy.orm import Session
from typing import List

from .. import crud, models, schemas
from ..database import get_db

router = APIRouter()

DEFAULT_SCHEDULE_VARIANCE_NORMAL = "10"
DEFAULT_SCHEDULE_VARIANCE_WARNING = "20"
DEFAULT_SCHEDULE_VARIANCE_CRITICAL = "40"

def _setting_value_or_default(setting, default_value: str):
    if not setting or setting.setting_value is None or setting.setting_value == "":
        return default_value
    return setting.setting_value

def _default_devops_sync_status_conditions(_db: Session) -> str:
    return json.dumps({"actual_end_date": [4]}, ensure_ascii=True)

def _wbs_tree_version(db: Session) -> str:
    version_parts = []
    for model in (models.Project, models.Task, models.Subtask, models.SubtaskInterruption):
        count, max_id, max_updated_at = db.query(
            func.count(model.id),
            func.coalesce(func.max(model.id), 0),
            func.max(model.updated_at),
        ).one()
        updated = max_updated_at.isoformat() if max_updated_at else ""
        version_parts.append(f"{model.__tablename__}:{count}:{max_id}:{updated}")
    return "|".join(version_parts)

def _initial_data_version(db: Session) -> str:
    version_parts = []
    for model in (models.MstStatus, models.MstSubtaskType, models.MstMember, models.MstHoliday, models.Marker):
        count, max_id, max_updated_at = db.query(
            func.count(model.id),
            func.coalesce(func.max(model.id), 0),
            func.max(model.updated_at),
        ).one()
        updated = max_updated_at.isoformat() if max_updated_at else ""
        version_parts.append(f"{model.__tablename__}:{count}:{max_id}:{updated}")

    settings_count, max_setting_key, max_setting_updated_at = db.query(
        func.count(models.SystemSetting.setting_key),
        func.max(models.SystemSetting.setting_key),
        func.max(models.SystemSetting.updated_at),
    ).one()
    settings_updated = max_setting_updated_at.isoformat() if max_setting_updated_at else ""
    version_parts.append(f"{models.SystemSetting.__tablename__}:{settings_count}:{max_setting_key or ''}:{settings_updated}")
    return "|".join(version_parts)

# --- WBS Aggregation ---
@router.get("/wbs/version", response_model=schemas.WBSVersionResponse)
def read_wbs_version(db: Session = Depends(get_db)):
    return {
        "tree_version": _wbs_tree_version(db),
        "initial_data_version": _initial_data_version(db),
    }

@router.get("/wbs", response_model=schemas.WBSResponse)
def read_wbs(
    project_ids: List[int] = Query(default=None),
    include_done: bool = False,
    include_removed: bool = False,
    weeks: int = 8,
    done_project_window_start: date | None = None,
    done_project_window_end: date | None = None,
    refresh_ongoing_end_dates: bool = True,
    db: Session = Depends(get_db)
):
    if refresh_ongoing_end_dates:
        crud.refresh_subtasks_actual_end_date(db, project_ids)
    projects = crud.get_wbs_data(
        db,
        project_ids,
        include_done,
        include_removed,
        done_project_window_start,
        done_project_window_end,
    )
    
    # Dynamic gantt range calculation
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
        "tree_version": _wbs_tree_version(db),
        "initial_data_version": _initial_data_version(db),
        "projects": projects
    }

@router.post("/wbs/export")
def export_wbs(
    projects: List[schemas.ProjectWBS],
    db: Session = Depends(get_db)
):
    from ..crud import import_data
    buffer = import_data.export_wbs_to_excel(projects, db)
    
    # Generate filename with current date
    from datetime import date
    today = date.today().strftime("%Y%m%d")
    filename = f"wbs_export_{today}.xlsx"
    
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# --- Projects ---
@router.get("/projects/options", response_model=List[schemas.ProjectOption])
def read_project_options(
    include_done: bool = False,
    include_removed: bool = False,
    db: Session = Depends(get_db),
):
    return crud.get_project_options(db, include_done, include_removed)

@router.post("/projects", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_proj = crud.create_project(db=db, project=project)
    return db_proj

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
    db_task = crud.create_task(db=db, task=task)
    return db_task

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
    db_subtask = crud.create_subtask(db=db, subtask=subtask)
    return db_subtask

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
    load_rate_critical_low = crud.get_system_setting(db, crud.SETTING_LOAD_RATE_CRITICAL_LOW)
    load_rate_warning_low = crud.get_system_setting(db, crud.SETTING_LOAD_RATE_WARNING_LOW)
    load_rate_normal_high = crud.get_system_setting(db, crud.SETTING_LOAD_RATE_NORMAL_HIGH)
    load_rate_warning_high = crud.get_system_setting(db, crud.SETTING_LOAD_RATE_WARNING_HIGH)
    load_rate_overload = crud.get_system_setting(db, crud.SETTING_LOAD_RATE_OVERLOAD)
    schedule_variance_normal = crud.get_system_setting(db, crud.SETTING_SCHEDULE_VARIANCE_NORMAL)
    schedule_variance_warning = crud.get_system_setting(db, crud.SETTING_SCHEDULE_VARIANCE_WARNING)
    schedule_variance_critical = crud.get_system_setting(db, crud.SETTING_SCHEDULE_VARIANCE_CRITICAL)
    devops_sync_status_conditions = crud.get_system_setting(db, crud.SETTING_AZURE_DEVOPS_SYNC_STATUS_CONDITIONS)
    
    return {
        "statuses": crud.get_statuses(db),
        "subtask_types": crud.get_subtask_types(db),
        "members": crud.get_members(db),
        "holidays": crud.get_holidays(db),
        "markers": crud.get_markers(db),
        "ticket_url_template": ticket_setting.setting_value if ticket_setting else None,
        "status_mapping_new": mapping_new.setting_value if mapping_new else None,
        "status_mapping_blocked": mapping_blocked.setting_value if mapping_blocked else None,
        "status_mapping_done": mapping_done.setting_value if mapping_done else None,
        "load_rate_critical_low": load_rate_critical_low.setting_value if load_rate_critical_low else None,
        "load_rate_warning_low": load_rate_warning_low.setting_value if load_rate_warning_low else None,
        "load_rate_normal_high": load_rate_normal_high.setting_value if load_rate_normal_high else None,
        "load_rate_warning_high": load_rate_warning_high.setting_value if load_rate_warning_high else None,
        "load_rate_overload": load_rate_overload.setting_value if load_rate_overload else None,
        "schedule_variance_normal": _setting_value_or_default(schedule_variance_normal, DEFAULT_SCHEDULE_VARIANCE_NORMAL),
        "schedule_variance_warning": _setting_value_or_default(schedule_variance_warning, DEFAULT_SCHEDULE_VARIANCE_WARNING),
        "schedule_variance_critical": _setting_value_or_default(schedule_variance_critical, DEFAULT_SCHEDULE_VARIANCE_CRITICAL),
        "azure_devops_sync_status_conditions": _setting_value_or_default(
            devops_sync_status_conditions,
            _default_devops_sync_status_conditions(db),
        ),
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
        crud.SETTING_LOAD_RATE_CRITICAL_LOW: "稼働率しきい値: 低すぎ",
        crud.SETTING_LOAD_RATE_WARNING_LOW: "稼働率しきい値: 低め",
        crud.SETTING_LOAD_RATE_NORMAL_HIGH: "稼働率しきい値: 適正上限",
        crud.SETTING_LOAD_RATE_WARNING_HIGH: "稼働率しきい値: 高め",
        crud.SETTING_LOAD_RATE_OVERLOAD: "稼働率しきい値: 過負荷",
        crud.SETTING_SCHEDULE_VARIANCE_NORMAL: "予実差しきい値: 正常",
        crud.SETTING_SCHEDULE_VARIANCE_WARNING: "予実差しきい値: 注意",
        crud.SETTING_SCHEDULE_VARIANCE_CRITICAL: "予実差しきい値: 重大",
        crud.SETTING_AZURE_DEVOPS_SYNC_STATUS_CONDITIONS: "Azure DevOps連携: ステータス別同期条件",
    }.get(key, "システム設定")
    return crud.set_system_setting(db, key, req.setting_value, description)

# --- Status Master ---
@router.post("/masters/statuses", response_model=schemas.Status)
def create_status(status: schemas.StatusCreate, db: Session = Depends(get_db)):
    db_status = crud.create_status(db=db, status=status)
    return db_status

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

@router.post("/masters/statuses/reorder")
def reorder_statuses(req: schemas.ReorderRequest, db: Session = Depends(get_db)):
    crud.reorder_statuses(db, req.ordered_ids)
    return {"status": "ok"}

# --- SubtaskType Master ---
@router.post("/masters/subtask-types", response_model=schemas.SubtaskType)
def create_subtask_type(subtask_type: schemas.SubtaskTypeCreate, db: Session = Depends(get_db)):
    db_type = crud.create_subtask_type(db=db, subtask_type=subtask_type)
    return db_type

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

@router.post("/masters/subtask-types/reorder")
def reorder_subtask_types(req: schemas.ReorderRequest, db: Session = Depends(get_db)):
    crud.reorder_subtask_types(db, req.ordered_ids)
    return {"status": "ok"}

# --- Member Master ---
@router.post("/masters/members", response_model=schemas.Member)
def create_member(member: schemas.MemberCreate, db: Session = Depends(get_db)):
    db_member = crud.create_member(db=db, member=member)
    return db_member

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

@router.post("/masters/members/reorder")
def reorder_members(req: schemas.ReorderRequest, db: Session = Depends(get_db)):
    crud.reorder_members(db, req.ordered_ids)
    return {"status": "ok"}

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

@router.post("/masters/holidays/sync")
async def sync_holidays(db: Session = Depends(get_db)):
    """
    Fetch Japanese holidays from holidays-jp API and sync with local DB.
    """
    url = "https://holidays-jp.github.io/api/v1/date.json"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
            
            # Transfer data into list of dicts: [{"date": "...", "name": "..."}]
            holiday_list = []
            for h_date, h_name in data.items():
                holiday_list.append({"date": h_date, "name": h_name})
            
            result = crud.sync_holidays(db, holiday_list)
            return {
                "status": "success",
                "message": f"Holidays synced: {result['added']} added, {result['updated']} updated.",
                "details": result
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch holidays: {str(e)}")

# --- Import ---
@router.get("/import/template")
def get_import_template():
    from ..crud import import_data
    buffer = import_data.generate_template()
    return StreamingResponse(
        buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=wbs_import_template.xlsx"}
    )

@router.post("/import/preview", response_model=schemas.ImportPreviewResponse)
async def preview_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    from ..crud import import_data
    content = await file.read()
    return import_data.validate_and_preview(db, content)

@router.post("/import/execute")
def execute_import(req: schemas.ImportExecuteRequest, db: Session = Depends(get_db)):
    from ..crud import import_data
    success = import_data.execute_import(db, req.rows)
    if not success:
        raise HTTPException(status_code=400, detail="Import failed")
    return {"status": "ok"}
@router.post("/admin/recalc-effort")
def recalc_all_effort(
    project_ids: List[int] = Query(default=None),
    db: Session = Depends(get_db)
):
    result = crud.recalculate_all_effort(db, project_ids or None)
    return result

@router.post("/items/duplicate")
def duplicate_items(req: schemas.DuplicateRequest, db: Session = Depends(get_db)):
    success = crud.duplicate_items(db, req)
    if not success:
        raise HTTPException(status_code=400, detail="Duplication failed")
    return {"status": "ok"}

@router.post("/items/clear-actuals")
def clear_actuals(req: schemas.ClearActualsRequest, db: Session = Depends(get_db)):
    success = crud.clear_actuals(db, req)
    if not success:
        raise HTTPException(status_code=400, detail="Clear actuals failed")
    return {"status": "ok"}

@router.post("/items/clear-plans-actuals")
def clear_plans_actuals(req: schemas.ClearPlansActualsRequest, db: Session = Depends(get_db)):
    success = crud.clear_plans_actuals(db, req)
    if not success:
        raise HTTPException(status_code=400, detail="Clear plans and actuals failed")
    return {"status": "ok"}

@router.post("/items/shift-dates")
def shift_dates(req: schemas.ShiftDatesRequest, db: Session = Depends(get_db)):
    success = crud.shift_dates(db, req)
    if not success:
        raise HTTPException(status_code=400, detail="Date shifting failed or no items selected")
    return {"status": "ok"}

# --- Markers ---
@router.get("/markers", response_model=List[schemas.Marker])
def get_markers(db: Session = Depends(get_db)):
    return crud.get_markers(db)

@router.post("/markers", response_model=schemas.Marker)
def create_or_update_marker(marker: schemas.MarkerCreate, db: Session = Depends(get_db)):
    db_marker = crud.create_or_update_marker(db, marker)
    return db_marker

@router.patch("/markers/{marker_id}", response_model=schemas.Marker)
def update_marker(marker_id: int, marker: schemas.MarkerUpdate, db: Session = Depends(get_db)):
    db_marker = crud.update_marker(db, marker_id, marker)
    if not db_marker:
        raise HTTPException(status_code=404, detail="Marker not found")
    return db_marker

@router.delete("/markers/{marker_id}", response_model=schemas.Marker)
def delete_marker(marker_id: int, db: Session = Depends(get_db)):
    db_marker = crud.delete_marker(db, marker_id)
    if not db_marker:
        raise HTTPException(status_code=404, detail="Marker not found")
    return db_marker

# --- Dashboard ---
@router.get("/dashboard", response_model=schemas.DashboardData)
def get_dashboard(db: Session = Depends(get_db)):
    return crud.get_dashboard_data(db)

# --- Shared Filters ---
@router.post("/shared-filters", response_model=schemas.SharedFilterResponse)
def create_shared_filter(filter_in: schemas.SharedFilterCreate, db: Session = Depends(get_db)):
    db_shared = crud.create_shared_filter(db, filter_in)
    import json
    return {
        "token": db_shared.token,
        "filter_data": json.loads(db_shared.filter_data)
    }

@router.get("/shared-filters/{token}", response_model=schemas.SharedFilterResponse)
def get_shared_filter(token: str, db: Session = Depends(get_db)):
    db_shared = crud.get_shared_filter(db, token)
    if not db_shared:
        raise HTTPException(status_code=404, detail="Shared filter not found")
    import json
    return {
        "token": db_shared.token,
        "filter_data": json.loads(db_shared.filter_data)
    }

# --- Subtask Interruptions ---
@router.get("/subtasks/{subtask_id}/interruptions", response_model=List[schemas.SubtaskInterruption])
def get_subtask_interruptions(subtask_id: int, db: Session = Depends(get_db)):
    return crud.get_subtask_interruptions(db, subtask_id)

@router.post("/subtasks/{subtask_id}/interruptions", response_model=schemas.SubtaskInterruption)
def create_subtask_interruption(subtask_id: int, interruption: schemas.SubtaskInterruptionCreate, db: Session = Depends(get_db)):
    if subtask_id != interruption.subtask_id:
        raise HTTPException(status_code=400, detail="Subtask ID mismatch")
    db_interruption = crud.create_subtask_interruption(db, interruption)
    return db_interruption

@router.patch("/interruptions/{interruption_id}", response_model=schemas.SubtaskInterruption)
def update_subtask_interruption(interruption_id: int, interruption: schemas.SubtaskInterruptionUpdate, db: Session = Depends(get_db)):
    db_interruption = crud.update_subtask_interruption(db, interruption_id, interruption)
    if not db_interruption:
        raise HTTPException(status_code=404, detail="Interruption not found")
    return db_interruption

@router.delete("/interruptions/{interruption_id}")
def delete_subtask_interruption(interruption_id: int, db: Session = Depends(get_db)):
    success = crud.delete_subtask_interruption(db, interruption_id)
    if not success:
        raise HTTPException(status_code=404, detail="Interruption not found")
    return {"status": "ok"}
