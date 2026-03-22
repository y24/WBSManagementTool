from sqlalchemy.orm import Session
from .. import models, schemas
from .recalc import recalculate_task_dates, recalculate_task_status, recalculate_project_dates

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
        # Affects project even if not auto-date for THIS task
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

def reorder_tasks(db: Session, ordered_ids: list[int]):
    for i, id in enumerate(ordered_ids):
        task = db.query(models.Task).filter(models.Task.id == id).first()
        if task:
            task.sort_order = i
    db.commit()
    return True
