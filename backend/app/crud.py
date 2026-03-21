from sqlalchemy.orm import Session
from datetime import date
from . import models, schemas

# --- Masters ---
def get_statuses(db: Session, include_inactive: bool = False):
    query = db.query(models.MstStatus)
    if not include_inactive:
        query = query.filter(models.MstStatus.is_active == True)
    return query.order_by(models.MstStatus.sort_order).all()

def get_subtask_types(db: Session, include_inactive: bool = False):
    query = db.query(models.MstSubtaskType)
    if not include_inactive:
        query = query.filter(models.MstSubtaskType.is_active == True)
    return query.order_by(models.MstSubtaskType.sort_order).all()

def get_members(db: Session, include_inactive: bool = False):
    query = db.query(models.MstMember)
    if not include_inactive:
        query = query.filter(models.MstMember.is_active == True)
    return query.order_by(models.MstMember.sort_order).all()

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
    return db_task

def update_task(db: Session, task_id: int, task: schemas.TaskUpdate):
    db_task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.is_deleted == False).first()
    if not db_task:
        return None
    for key, value in task.dict(exclude_unset=True).items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int):
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if db_task:
        db_task.is_deleted = True
        db.commit()
    return db_task

# --- Subtasks ---
def create_subtask(db: Session, subtask: schemas.SubtaskCreate):
    db_subtask = models.Subtask(**subtask.dict())
    db.add(db_subtask)
    db.commit()
    db.refresh(db_subtask)
    return db_subtask

def update_subtask(db: Session, subtask_id: int, subtask: schemas.SubtaskUpdate):
    db_subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id, models.Subtask.is_deleted == False).first()
    if not db_subtask:
        return None
    for key, value in subtask.dict(exclude_unset=True).items():
        setattr(db_subtask, key, value)
    db.commit()
    db.refresh(db_subtask)
    return db_subtask

def delete_subtask(db: Session, subtask_id: int):
    db_subtask = db.query(models.Subtask).filter(models.Subtask.id == subtask_id).first()
    if db_subtask:
        db_subtask.is_deleted = True
        db.commit()
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
        
    projects = query.order_by(models.Project.sort_order).all()
    return projects
