from sqlalchemy.orm import Session
from .. import models, schemas
from .recalc import recalculate_project_dates, recalculate_project_status

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
