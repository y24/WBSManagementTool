from sqlalchemy.orm import Session, selectinload
from .. import models, schemas
from .base import check_overlap

def get_wbs_data(db: Session, project_ids: list[int] = None, include_removed: bool = False):
    query = db.query(models.Project)
    if not include_removed:
        query = query.filter(models.Project.is_deleted == False)
        
    if project_ids:
        query = query.filter(models.Project.id.in_(project_ids))
    
    if not include_removed:
        query = query.options(
            selectinload(models.Project.tasks.and_(models.Task.is_deleted == False)).selectinload(models.Task.status),
            selectinload(models.Project.tasks.and_(models.Task.is_deleted == False)).selectinload(models.Task.subtasks.and_(models.Subtask.is_deleted == False)).selectinload(models.Subtask.status),
            selectinload(models.Project.status)
        )
    else:
        query = query.options(
            selectinload(models.Project.tasks).selectinload(models.Task.status),
            selectinload(models.Project.tasks).selectinload(models.Task.subtasks).selectinload(models.Subtask.status),
            selectinload(models.Project.status)
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
            
            is_task_removed = t.status and t.status.status_name == "Removed"
            
            t_wbs = schemas.TaskWBS.from_orm(t)
            t_wbs.planned_effort_total = sum((s.planned_effort_days or 0) for s in t.subtasks if not s.is_deleted and (s.status and s.status.status_name != "Removed"))
            t_wbs.actual_effort_total = sum((s.actual_effort_days or 0) for s in t.subtasks if not s.is_deleted and (s.status and s.status.status_name != "Removed"))
            
            if not is_task_removed:
                p_planned_effort += t_wbs.planned_effort_total
                p_actual_effort += t_wbs.actual_effort_total
            
            # Subtask overlap check
            subtask_periods = [(s.planned_start_date, s.planned_end_date) for s in t.subtasks if not s.is_deleted and (s.status and s.status.status_name != "Removed")]
            t_wbs.is_overlapping = check_overlap(subtask_periods)
            
            if not is_task_removed and t_wbs.planned_start_date and t_wbs.planned_end_date:
                task_periods.append((t_wbs.planned_start_date, t_wbs.planned_end_date))
                
            tasks_wbs.append(t_wbs)
            
        p_wbs.tasks = tasks_wbs
        p_wbs.planned_effort_total = p_planned_effort
        p_wbs.actual_effort_total = p_actual_effort
        
        # Task level overlap check for project
        p_wbs.is_overlapping = check_overlap(task_periods)
        result.append(p_wbs)
        
    return result
