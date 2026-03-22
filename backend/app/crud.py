from sqlalchemy.orm import Session
from datetime import date
from . import models, schemas

# --- System Settings ---
SETTING_TICKET_URL = "ticket_url_template"
SETTING_STATUS_NEW = "status_mapping_new"
SETTING_STATUS_BLOCKED = "status_mapping_blocked"
SETTING_STATUS_DONE = "status_mapping_done"

def get_status_ids_by_category(db: Session, category: str) -> list[int]:
    key = {
        "new": SETTING_STATUS_NEW,
        "blocked": SETTING_STATUS_BLOCKED,
        "done": SETTING_STATUS_DONE
    }.get(category)
    if not key: return []
    
    setting = get_system_setting(db, key)
    if setting and setting.setting_value:
        try:
            return [int(sid.strip()) for sid in setting.setting_value.split(",") if sid.strip().isdigit()]
        except ValueError:
            pass
            
    # Defaults based on seed.py: 1:New, 4:Done, 5:Blocked, 7:Removed
    if category == "new": return [1, 7]
    if category == "blocked": return [5]
    if category == "done": return [4, 7]
    return []

def get_system_setting(db: Session, key: str):
    return db.query(models.SystemSetting).filter(models.SystemSetting.setting_key == key).first()

def set_system_setting(db: Session, key: str, value: str, description: str = None):
    db_setting = db.query(models.SystemSetting).filter(models.SystemSetting.setting_key == key).first()
    if db_setting:
        db_setting.setting_value = value
    else:
        db_setting = models.SystemSetting(setting_key=key, setting_value=value, description=description)
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

# --- Masters ---
def get_statuses(db: Session, include_inactive: bool = False):
    query = db.query(models.MstStatus)
    if not include_inactive:
        query = query.filter(models.MstStatus.is_active == True)
    return query.order_by(models.MstStatus.sort_order, models.MstStatus.id).all()

def get_subtask_types(db: Session, include_inactive: bool = False):
    query = db.query(models.MstSubtaskType)
    if not include_inactive:
        query = query.filter(models.MstSubtaskType.is_active == True)
    return query.order_by(models.MstSubtaskType.sort_order, models.MstSubtaskType.id).all()

def get_members(db: Session, include_inactive: bool = False):
    query = db.query(models.MstMember)
    if not include_inactive:
        query = query.filter(models.MstMember.is_active == True)
    return query.order_by(models.MstMember.sort_order, models.MstMember.id).all()

def get_holidays(db: Session, include_inactive: bool = False):
    query = db.query(models.MstHoliday)
    if not include_inactive:
        query = query.filter(models.MstHoliday.is_active == True)
    return query.order_by(models.MstHoliday.holiday_date).all()

# --- Master CRUD ---
def create_status(db: Session, status: schemas.StatusCreate):
    db_status = models.MstStatus(**status.dict())
    db.add(db_status)
    db.commit()
    db.refresh(db_status)
    return db_status

def update_status(db: Session, status_id: int, status: schemas.StatusUpdate):
    db_status = db.query(models.MstStatus).filter(models.MstStatus.id == status_id).first()
    if not db_status:
        return None
    for key, value in status.dict(exclude_unset=True).items():
        setattr(db_status, key, value)
    db.commit()
    db.refresh(db_status)
    return db_status

def delete_status(db: Session, status_id: int):
    db_status = db.query(models.MstStatus).filter(models.MstStatus.id == status_id).first()
    if db_status:
        if db_status.is_system_reserved:
            return None # Cannot delete system reserved status
        db_status.is_active = False
        db.commit()
        db.refresh(db_status)
    return db_status

def create_subtask_type(db: Session, subtask_type: schemas.SubtaskTypeCreate):
    db_type = models.MstSubtaskType(**subtask_type.dict())
    db.add(db_type)
    db.commit()
    db.refresh(db_type)
    return db_type

def update_subtask_type(db: Session, type_id: int, subtask_type: schemas.SubtaskTypeUpdate):
    db_type = db.query(models.MstSubtaskType).filter(models.MstSubtaskType.id == type_id).first()
    if not db_type:
        return None
    for key, value in subtask_type.dict(exclude_unset=True).items():
        setattr(db_type, key, value)
    db.commit()
    db.refresh(db_type)
    return db_type

def delete_subtask_type(db: Session, type_id: int):
    db_type = db.query(models.MstSubtaskType).filter(models.MstSubtaskType.id == type_id).first()
    if db_type:
        db_type.is_active = False
        db.commit()
        db.refresh(db_type)
    return db_type

def create_member(db: Session, member: schemas.MemberCreate):
    db_member = models.MstMember(**member.dict())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def update_member(db: Session, member_id: int, member: schemas.MemberUpdate):
    db_member = db.query(models.MstMember).filter(models.MstMember.id == member_id).first()
    if not db_member:
        return None
    for key, value in member.dict(exclude_unset=True).items():
        setattr(db_member, key, value)
    db.commit()
    db.refresh(db_member)
    return db_member

def delete_member(db: Session, member_id: int):
    db_member = db.query(models.MstMember).filter(models.MstMember.id == member_id).first()
    if db_member:
        db_member.is_active = False
        db.commit()
        db.refresh(db_member)
    return db_member

def create_holiday(db: Session, holiday: schemas.HolidayCreate):
    db_holiday = models.MstHoliday(**holiday.dict())
    db.add(db_holiday)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday

def update_holiday(db: Session, holiday_id: int, holiday: schemas.HolidayUpdate):
    db_holiday = db.query(models.MstHoliday).filter(models.MstHoliday.id == holiday_id).first()
    if not db_holiday:
        return None
    for key, value in holiday.dict(exclude_unset=True).items():
        setattr(db_holiday, key, value)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday

def delete_holiday(db: Session, holiday_id: int):
    db_holiday = db.query(models.MstHoliday).filter(models.MstHoliday.id == holiday_id).first()
    if db_holiday:
        db_holiday.is_active = False
        db.commit()
        db.refresh(db_holiday)
    return db_holiday

# --- Projects ---
def create_project(db: Session, project: schemas.ProjectCreate):
    db_project = models.Project(**project.dict())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def update_project(db: Session, project_id: int, project: schemas.ProjectUpdate):
    db_project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.is_deleted == False).first()
    if not db_project:
        return None
    for key, value in project.dict(exclude_unset=True).items():
        setattr(db_project, key, value)
    
    # Check if flags changed or dates changed manually
    db.commit()
    
    # Recalculate if auto-date is enabled
    if db_project.is_auto_planned_date or db_project.is_auto_actual_date:
        recalculate_project_dates(db, project_id)
    
    # Always recalculate status (as tasks might have changed independently)
    recalculate_project_status(db, project_id)
        
    db.refresh(db_project)
    return db_project

def delete_project(db: Session, project_id: int):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if db_project:
        db_project.is_deleted = True
        db.commit()
    return db_project

# --- Tasks ---
def create_task(db: Session, task: schemas.TaskCreate):
    db_task = models.Task(**task.dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # Trigger project recalculation
    recalculate_project_dates(db, db_task.project_id)
    
    return db_task

def update_task(db: Session, task_id: int, task: schemas.TaskUpdate):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.is_deleted == False).first()
    if not db_task:
        return None
    for key, value in task.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    
    db.commit()
    
    # Recalculate if auto-date is enabled
    if db_task.is_auto_planned_date or db_task.is_auto_actual_date:
        recalculate_task_dates(db, task_id)
    else:
        # Even if not auto-date for THIS task, it might affect PROJECT auto-date
        recalculate_project_dates(db, db_task.project_id)
    
    # Always recalculate status
    recalculate_task_status(db, task_id)
        
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db_task.is_deleted = True
        db.commit()
        # Trigger project recalculation
        recalculate_project_dates(db, db_task.project_id)
    return db_task

# --- Subtasks ---
def create_subtask(db: Session, subtask: schemas.SubtaskCreate):
    db_subtask = models.Subtask(**subtask.dict())
    db.add(db_subtask)
    db.commit()
    db.refresh(db_subtask)
    
    # Always trigger recalculation for parent task
    recalculate_task_dates(db, db_subtask.task_id)
    recalculate_task_status(db, db_subtask.task_id)
    
    return db_subtask

def update_subtask(db: Session, subtask_id: int, subtask: schemas.SubtaskUpdate):
    db_subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id, models.Subtask.is_deleted == False).first()
    if not db_subtask:
        return None
    for key, value in subtask.dict(exclude_unset=True).items():
        setattr(db_subtask, key, value)
    db.commit()
    
    # Always trigger recalculation for parent task
    recalculate_task_dates(db, db_subtask.task_id)
    recalculate_task_status(db, db_subtask.task_id)
    
    db.refresh(db_subtask)
    return db_subtask

def delete_subtask(db: Session, subtask_id: int):
    db_subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if db_subtask:
        db_subtask.is_deleted = True
        db.commit()
        # Always trigger recalculation for parent task
        recalculate_task_dates(db, db_subtask.task_id)
        recalculate_task_status(db, db_subtask.task_id)
    return db_subtask

# --- WBS Aggregation ---
def get_wbs_data(db: Session, project_ids: list[int] = None, include_removed: bool = False):
    from sqlalchemy.orm import selectinload
    
    query = db.query(models.Project)
    if not include_removed:
        query = query.filter(models.Project.is_deleted == False)
        
    if project_ids:
        query = query.filter(models.Project.id.in_(project_ids))
    
    if not include_removed:
        query = query.options(
            selectinload(models.Project.tasks.and_(models.Task.is_deleted == False))
            .selectinload(models.Task.subtasks.and_(models.Subtask.is_deleted == False))
        )
    else:
        query = query.options(
            selectinload(models.Project.tasks)
            .selectinload(models.Task.subtasks)
        )
        
    projects = query.order_by(models.Project.sort_order, models.Project.id).all()
    
    # Map to schema with calculated fields
    result = []
    for p in projects:
        p_wbs = schemas.ProjectWBS.from_orm(p)
        
        tasks_wbs = []
        p_planned_effort = 0
        p_actual_effort = 0
        task_periods = []
        
        for t in p.tasks:
            if t.is_deleted: continue
            
            t_wbs = schemas.TaskWBS.from_orm(t)
            t_wbs.planned_effort_total = sum((s.planned_effort_days or 0) for s in t.subtasks if not s.is_deleted)
            t_wbs.actual_effort_total = sum((s.actual_effort_days or 0) for s in t.subtasks if not s.is_deleted)
            
            p_planned_effort += t_wbs.planned_effort_total
            p_actual_effort += t_wbs.actual_effort_total
            
            # Subtask overlap check
            subtask_periods = [(s.planned_start_date, s.planned_end_date) for s in t.subtasks if not s.is_deleted]
            t_wbs.is_overlapping = check_overlap(subtask_periods)
            
            if t_wbs.planned_start_date and t_wbs.planned_end_date:
                task_periods.append((t_wbs.planned_start_date, t_wbs.planned_end_date))
                
            tasks_wbs.append(t_wbs)
            
        p_wbs.tasks = tasks_wbs
        p_wbs.planned_effort_total = p_planned_effort
        p_wbs.actual_effort_total = p_actual_effort
        
        # Task level overlap check for project
        p_wbs.is_overlapping = check_overlap(task_periods)
        result.append(p_wbs)
        
    return result

# --- WBS Advanced Logic ---

def recalculate_task_dates(db: Session, task_id: int):
    """
    Recalculate Task dates based on its Subtasks if auto-calculation is enabled.
    Then triggers Project recalculation.
    """
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return
    
    from .models import Subtask, MstStatus
    subtasks = db.query(Subtask).join(MstStatus).filter(
        Subtask.task_id == task_id,
        Subtask.is_deleted == False,
        MstStatus.status_name != "Removed"
    ).all()
    
    changed = False
    if db_task.is_auto_planned_date:
        p_starts = [s.planned_start_date for s in subtasks if s.planned_start_date]
        p_ends = [s.planned_end_date for s in subtasks if s.planned_end_date]
        
        new_start = min(p_starts) if p_starts else None
        new_end = max(p_ends) if p_ends else None
        
        if db_task.planned_start_date != new_start or db_task.planned_end_date != new_end:
            db_task.planned_start_date = new_start
            db_task.planned_end_date = new_end
            changed = True
            
    if db_task.is_auto_actual_date:
        a_starts = [s.actual_start_date for s in subtasks if s.actual_start_date]
        a_ends = [s.actual_end_date for s in subtasks if s.actual_end_date]
        
        new_start = min(a_starts) if a_starts else None
        new_end = max(a_ends) if a_ends else None
        
        if db_task.actual_start_date != new_start or db_task.actual_end_date != new_end:
            db_task.actual_start_date = new_start
            db_task.actual_end_date = new_end
            changed = True
            
    if changed:
        db.commit()
        
    # Always check if project needs update (as task dates might have changed regardless of auto-flag)
    recalculate_project_dates(db, db_task.project_id)

def recalculate_project_dates(db: Session, project_id: int):
    """
    Recalculate Project dates based on its Tasks if auto-calculation is enabled.
    """
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        return
    
    # Query tasks explicitly to ensure latest values after potential updates in recalculate_task_dates
    tasks = db.query(models.Task).filter(models.Task.project_id == project_id, models.Task.is_deleted == False).all()
    
    changed = False
    if db_project.is_auto_planned_date:
        p_starts = [t.planned_start_date for t in tasks if t.planned_start_date]
        p_ends = [t.planned_end_date for t in tasks if t.planned_end_date]
        
        new_start = min(p_starts) if p_starts else None
        new_end = max(p_ends) if p_ends else None
        
        if db_project.planned_start_date != new_start or db_project.planned_end_date != new_end:
            db_project.planned_start_date = new_start
            db_project.planned_end_date = new_end
            changed = True
            
    if db_project.is_auto_actual_date:
        a_starts = [t.actual_start_date for t in tasks if t.actual_start_date]
        a_ends = [t.actual_end_date for t in tasks if t.actual_end_date]
        
        new_start = min(a_starts) if a_starts else None
        new_end = max(a_ends) if a_ends else None
        
        if db_project.actual_start_date != new_start or db_project.actual_end_date != new_end:
            db_project.actual_start_date = new_start
            db_project.actual_end_date = new_end
            changed = True
            
    if changed:
        db.commit()

def recalculate_task_status(db: Session, task_id: int):
    """
    Recalculate Task status based on its Subtasks.
    Priority: Blocked > Done (All) > New (All) > In Progress
    """
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task: return
    
    # Get subtasks (filter by is_deleted and not Removed status category if desired, 
    # but the rule says New/Removed = New, so we include them in count)
    subtasks = db.query(models.Subtask).filter(
        models.Subtask.task_id == task_id,
        models.Subtask.is_deleted == False
    ).all()
    
    if not subtasks: return
    
    new_ids = get_status_ids_by_category(db, "new")
    blocked_ids = get_status_ids_by_category(db, "blocked")
    done_ids = get_status_ids_by_category(db, "done")
    
    sub_status_ids = [s.status_id for s in subtasks]
    
    # Priority logic
    if any(sid in blocked_ids for sid in sub_status_ids):
        new_status_id = blocked_ids[0] if blocked_ids else 5 # Blocked
    elif all(sid in done_ids for sid in sub_status_ids):
        # Pick the first Done ID that is NOT Removed if possible, otherwise use 4
        new_status_id = next((sid for sid in done_ids if sid != 7), 4)
    elif all(sid in new_ids for sid in sub_status_ids):
        new_status_id = next((sid for sid in new_ids if sid != 7), 1)
    else:
        new_status_id = 2 # In Progress
        
    if db_task.status_id != new_status_id:
        db_task.status_id = new_status_id
        db.commit()
    
    # Recalculate Project status
    recalculate_project_status(db, db_task.project_id)

def recalculate_project_status(db: Session, project_id: int):
    """
    Recalculate Project status based on its Tasks.
    """
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project: return
    
    tasks = db.query(models.Task).filter(
        models.Task.project_id == project_id,
        models.Task.is_deleted == False
    ).all()
    
    if not tasks: return
    
    new_ids = get_status_ids_by_category(db, "new")
    blocked_ids = get_status_ids_by_category(db, "blocked")
    done_ids = get_status_ids_by_category(db, "done")
    
    task_status_ids = [t.status_id for t in tasks if t.status_id]
    
    if not task_status_ids: return
    
    if all(sid in done_ids for sid in task_status_ids):
        new_status_id = next((sid for sid in done_ids if sid != 7), 4)
    elif all(sid in new_ids for sid in task_status_ids):
        new_status_id = next((sid for sid in new_ids if sid != 7), 1)
    else:
        new_status_id = 2
        
    if db_project.status_id != new_status_id:
        db_project.status_id = new_status_id
        db.commit()

def check_overlap(periods: list[tuple[date, date]]) -> bool:
    """
    Simple utility to check if any date periods overlap.
    """
    sorted_periods = sorted([p for p in periods if p[0] and p[1]], key=lambda x: x[0])
    for i in range(len(sorted_periods) - 1):
        if sorted_periods[i][1] > sorted_periods[i+1][0]:
            return True
    return False
# --- Reordering ---

def reorder_projects(db: Session, ordered_ids: list[int]):
    for i, id in enumerate(ordered_ids):
        project = db.query(models.Project).filter(models.Project.id == id).first()
        if project:
            project.sort_order = i
    db.commit()
    return True

def reorder_tasks(db: Session, ordered_ids: list[int]):
    for i, id in enumerate(ordered_ids):
        task = db.query(models.Task).filter(models.Task.id == id).first()
        if task:
            task.sort_order = i
    db.commit()
    return True

def reorder_subtasks(db: Session, ordered_ids: list[int]):
    for i, id in enumerate(ordered_ids):
        subtask = db.query(models.Subtask).filter(models.Subtask.id == id).first()
        if subtask:
            subtask.sort_order = i
    db.commit()
    return True
