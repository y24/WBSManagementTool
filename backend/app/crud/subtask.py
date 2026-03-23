from sqlalchemy.orm import Session
from .. import models, schemas
from .recalc import recalculate_task_dates, recalculate_task_status
from ..utils import date_utils
from .master import get_holidays

def _calculate_subtask_effort(db: Session, db_subtask: models.Subtask, update_data: dict = None):
    # Check if auto_effort is already set or being set to True
    is_auto = db_subtask.is_auto_effort
    if update_data and "is_auto_effort" in update_data:
        is_auto = update_data["is_auto_effort"]
        
    if not is_auto:
        return

    holidays = [h.holiday_date for h in get_holidays(db)]
    
    def get_val(key):
        if update_data and key in update_data:
            return update_data[key]
        return getattr(db_subtask, key)

    p_start = get_val("planned_start_date")
    p_end = get_val("planned_end_date")
    p_effort = get_val("planned_effort_days")
    workload = get_val("workload_percent")
    if workload is None: workload = 100
    workload_factor = workload / 100.0
    
    a_start = get_val("actual_start_date")
    a_end = get_val("actual_end_date")

    # Check if auto_effort is being turned ON
    is_turning_on = False
    if update_data and "is_auto_effort" in update_data and update_data["is_auto_effort"] and not db_subtask.is_auto_effort:
        is_turning_on = True

    # logic for planned
    if p_start:
        # If dates are updated OR auto_effort is being turned on, prioritize calculating effort
        if not update_data or "planned_start_date" in update_data or "planned_end_date" in update_data or is_turning_on or "workload_percent" in (update_data or {}):
            if p_end:
                raw_days = date_utils.get_business_days_count(p_start, p_end, holidays)
                # 四捨五入
                db_subtask.planned_effort_days = int(raw_days * workload_factor * 10 + 0.5) / 10.0
            elif is_turning_on and p_effort is not None:
                db_subtask.planned_end_date = date_utils.add_business_days(p_start, float(p_effort), holidays)
        elif update_data and "planned_effort_days" in update_data:
            if p_effort is not None:
                db_subtask.planned_end_date = date_utils.add_business_days(p_start, float(p_effort), holidays)

    # logic for actual
    if a_start and a_end:
        if not update_data or "actual_start_date" in update_data or "actual_end_date" in update_data or is_turning_on or "workload_percent" in (update_data or {}):
            raw_days = date_utils.get_business_days_count(a_start, a_end, holidays)
            # 四捨五入
            db_subtask.actual_effort_days = int(raw_days * workload_factor * 10 + 0.5) / 10.0

# --- Subtasks ---
def create_subtask(db: Session, subtask: schemas.SubtaskCreate):
    db_subtask = models.Subtask(**subtask.dict())
    
    # Calculate effort BEFORE adding to session or commit if needed?
    # Actually we need DB to get holidays if we use the helper.
    _calculate_subtask_effort(db, db_subtask)
    
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
    
    update_dict = subtask.dict(exclude_unset=True)
    
    # Calculate effort changes
    _calculate_subtask_effort(db, db_subtask, update_dict)
    
    for key, value in update_dict.items():
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

def reorder_subtasks(db: Session, ordered_ids: list[int]):
    for i, id in enumerate(ordered_ids):
        subtask = db.query(models.Subtask).filter(models.Subtask.id == id).first()
        if subtask:
            subtask.sort_order = i
    db.commit()
    return True
