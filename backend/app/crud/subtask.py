from sqlalchemy.orm import Session
from .. import models, schemas
from .recalc import recalculate_task_dates, recalculate_task_status
from ..utils import date_utils
from .master import get_holidays

def _calculate_subtask_effort(db: Session, db_subtask: models.Subtask, update_data: dict = None):
    if not db_subtask.is_auto_effort:
        return

    holidays = [h.holiday_date for h in get_holidays(db)]
    
    def get_val(key):
        if update_data and key in update_data:
            return update_data[key]
        return getattr(db_subtask, key)

    p_start = get_val("planned_start_date")
    p_end = get_val("planned_end_date")
    p_effort = get_val("planned_effort_days")
    
    a_start = get_val("actual_start_date")
    a_end = get_val("actual_end_date")

    # logic for planned
    if p_start:
        # If dates are updated, prioritize calculating effort
        if update_data and ("planned_start_date" in update_data or "planned_end_date" in update_data):
            if p_end:
                db_subtask.planned_effort_days = date_utils.get_business_days_count(p_start, p_end, holidays)
        # If only effort is updated (and not dates), calculate end date
        elif update_data and "planned_effort_days" in update_data:
            if p_effort is not None:
                db_subtask.planned_end_date = date_utils.add_business_days(p_start, p_effort, holidays)
        # For initial creation
        elif not update_data:
            if p_end:
                db_subtask.planned_effort_days = date_utils.get_business_days_count(p_start, p_end, holidays)
            elif p_effort is not None:
                db_subtask.planned_end_date = date_utils.add_business_days(p_start, p_effort, holidays)

    # logic for actual
    if a_start and a_end:
        if not update_data or "actual_start_date" in update_data or "actual_end_date" in update_data:
            db_subtask.actual_effort_days = date_utils.get_business_days_count(a_start, a_end, holidays)

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
