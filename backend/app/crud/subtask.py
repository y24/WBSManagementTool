from sqlalchemy.orm import Session
from .. import models, schemas
from .recalc import recalculate_task_dates, recalculate_task_status

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

def reorder_subtasks(db: Session, ordered_ids: list[int]):
    for i, id in enumerate(ordered_ids):
        subtask = db.query(models.Subtask).filter(models.Subtask.id == id).first()
        if subtask:
            subtask.sort_order = i
    db.commit()
    return True
