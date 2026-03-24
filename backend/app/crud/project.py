from sqlalchemy.orm import Session
from datetime import date
from .. import models, schemas
from .recalc import recalculate_project_dates, recalculate_project_status
from .base import get_status_ids_by_category

# --- Projects ---
def create_project(db: Session, project: schemas.ProjectCreate):
    from sqlalchemy import func
    project_dict = project.model_dump()
    if project_dict.get("sort_order") == 0:
        max_order = db.query(func.max(models.Project.sort_order)).filter(models.Project.is_deleted == False).scalar()
        project_dict["sort_order"] = (max_order + 1) if max_order is not None else 0
        
    db_project = models.Project(**project_dict)
    
    # Auto-set dates based on status
    done_ids = get_status_ids_by_category(db, "done")
    # Ongoing = [2, 3] (In Progress, In Review)
    
    if db_project.status_id in ([2, 3] + done_ids) and db_project.actual_start_date is None:
        db_project.actual_start_date = date.today()
        
    if db_project.status_id in done_ids and db_project.actual_end_date is None:
        db_project.actual_end_date = date.today()
        
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

def update_project(db: Session, project_id: int, project: schemas.ProjectUpdate):
    db_project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.is_deleted == False).first()
    if not db_project:
        return None
    
    update_dict = project.dict(exclude_unset=True)
    
    # Auto-set dates if status is being changed
    new_status_id = update_dict.get("status_id")
    if new_status_id is not None and new_status_id != db_project.status_id:
        done_ids = get_status_ids_by_category(db, "done")
        if new_status_id in done_ids:
            if "actual_end_date" not in update_dict and db_project.actual_end_date is None:
                update_dict["actual_end_date"] = date.today()

    for key, value in update_dict.items():
        setattr(db_project, key, value)
    
    db.commit()
    
    # Recalculate if auto-date is enabled
    if db_project.is_auto_planned_date or db_project.is_auto_actual_date:
        recalculate_project_dates(db, project_id)
    
    # Always recalculate status
    recalculate_project_status(db, project_id)
        
    db.refresh(db_project)
    return db_project

def delete_project(db: Session, project_id: int):
    db_project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if db_project:
        db_project.is_deleted = True
        db.commit()
    return db_project

def reorder_projects(db: Session, ordered_ids: list[int]):
    for i, id in enumerate(ordered_ids):
        project = db.query(models.Project).filter(models.Project.id == id).first()
        if project:
            project.sort_order = i
    db.commit()
    return True
