from sqlalchemy.orm import Session
from .. import models
from .base import get_status_ids_by_category

def recalculate_project_dates(db: Session, project_id: int):
    """
    Recalculate Project dates based on its Tasks if auto-calculation is enabled.
    """
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not db_project:
        return
    
    # Query tasks explicitly to ensure latest values
    tasks = db.query(models.Task).join(models.MstStatus).filter(
        models.Task.project_id == project_id,
        models.Task.is_deleted == False,
        models.MstStatus.status_name != "Removed"
    ).all()
    
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
    
    # If explicitly marked as Removed (ID 7), don't auto-recalculate from tasks.
    if db_project.status_id == 7:
        return
    
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

def recalculate_task_dates(db: Session, task_id: int):
    """
    Recalculate Task dates based on its Subtasks if auto-calculation is enabled.
    Then triggers Project recalculation.
    """
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return
    
    from ..models import Subtask, MstStatus
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
        
    # Always check if project needs update
    recalculate_project_dates(db, db_task.project_id)

def recalculate_task_status(db: Session, task_id: int):
    """
    Recalculate Task status based on its Subtasks.
    Priority: Blocked > Done (All) > New (All) > In Progress
    """
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task: return
    
    subtasks = db.query(models.Subtask).filter(
        models.Subtask.task_id == task_id,
        models.Subtask.is_deleted == False
    ).all()
    
    if not subtasks: return
    
    if db_task.status_id == 7: # Removed
        recalculate_project_status(db, db_task.project_id)
        return
    
    new_ids = get_status_ids_by_category(db, "new")
    blocked_ids = get_status_ids_by_category(db, "blocked")
    done_ids = get_status_ids_by_category(db, "done")
    
    sub_status_ids = [s.status_id for s in subtasks]
    
    # Priority logic
    if any(sid in blocked_ids for sid in sub_status_ids):
        new_status_id = blocked_ids[0] if blocked_ids else 5 # Blocked
    elif all(sid in done_ids for sid in sub_status_ids):
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
