from sqlalchemy import func
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
def duplicate_items(db: Session, req: schemas.DuplicateRequest):
    # Get all projects, tasks, subtasks to be duplicated
    # Filter out children if parent is also selected to be duplicated
    
    # 1. Calculate effective items to duplicate
    # Projects: duplicate as are
    p_ids = set(req.project_ids)
    
    # Tasks: duplicate only if parent project is NOT selected
    t_ids = []
    for t_id in req.task_ids:
        task = db.query(models.Task).filter(models.Task.id == t_id).first()
        if task and task.project_id not in p_ids:
            t_ids.append(t_id)
    t_ids = set(t_ids)
            
    # Subtasks: duplicate only if parent task is NOT selected AND parent project is NOT selected
    s_ids = []
    for s_id in req.subtask_ids:
        subtask = db.query(models.Subtask).filter(models.Subtask.id == s_id).first()
        if subtask:
            task = db.query(models.Task).filter(models.Task.id == subtask.task_id).first()
            if task and task.id not in t_ids and task.project_id not in p_ids:
                s_ids.append(s_id)
                
    # 2. Execution
    
    # Duplicate Projects
    for pid in p_ids:
        orig_p = db.query(models.Project).filter(models.Project.id == pid).first()
        if not orig_p: continue
        
        # New sort order: Max + 1
        max_sort = db.query(func.max(models.Project.sort_order)).scalar() or 0
        
        new_p = models.Project(
            project_name=orig_p.project_name,
            detail=orig_p.detail,
            ticket_id=orig_p.ticket_id,
            memo=orig_p.memo,
            planned_start_date=orig_p.planned_start_date,
            planned_end_date=orig_p.planned_end_date,
            actual_start_date=orig_p.actual_start_date,
            actual_end_date=orig_p.actual_end_date,
            is_auto_planned_date=orig_p.is_auto_planned_date,
            is_auto_actual_date=orig_p.is_auto_actual_date,
            sort_order=max_sort + 1,
            status_id=orig_p.status_id,
            assignee_id=orig_p.assignee_id
        )
        db.add(new_p)
        db.flush()
        
        # Duplicate Tasks under this Project
        for orig_t in orig_p.tasks:
            if orig_t.is_deleted: continue
            new_t = models.Task(
                project_id=new_p.id,
                task_name=orig_t.task_name,
                detail=orig_t.detail,
                ticket_id=orig_t.ticket_id,
                memo=orig_t.memo,
                planned_start_date=orig_t.planned_start_date,
                planned_end_date=orig_t.planned_end_date,
                actual_start_date=orig_t.actual_start_date,
                actual_end_date=orig_t.actual_end_date,
                is_auto_planned_date=orig_t.is_auto_planned_date,
                is_auto_actual_date=orig_t.is_auto_actual_date,
                sort_order=orig_t.sort_order,
                status_id=orig_t.status_id,
                assignee_id=orig_t.assignee_id
            )
            db.add(new_t)
            db.flush()
            
            # Duplicate Subtasks under this Task
            for orig_s in orig_t.subtasks:
                if orig_s.is_deleted: continue
                new_s = models.Subtask(
                    task_id=new_t.id,
                    subtask_type_id=orig_s.subtask_type_id,
                    subtask_detail=orig_s.subtask_detail,
                    status_id=orig_s.status_id,
                    progress_percent=orig_s.progress_percent,
                    assignee_id=orig_s.assignee_id,
                    planned_start_date=orig_s.planned_start_date,
                    planned_end_date=orig_s.planned_end_date,
                    actual_start_date=orig_s.actual_start_date,
                    review_start_date=orig_s.review_start_date,
                    actual_end_date=orig_s.actual_end_date,
                    planned_effort_days=orig_s.planned_effort_days,
                    actual_effort_days=orig_s.actual_effort_days,
                    review_days=orig_s.review_days,
                    ticket_id=orig_s.ticket_id,
                    memo=orig_s.memo,
                    sort_order=orig_s.sort_order,
                    is_auto_effort=orig_s.is_auto_effort,
                    workload_percent=orig_s.workload_percent
                )
                db.add(new_s)

    # Duplicate Tasks (standalone)
    for tid in t_ids:
        orig_t = db.query(models.Task).filter(models.Task.id == tid).first()
        if not orig_t: continue
        
        # New sort order: same project, max + 1
        max_sort = db.query(func.max(models.Task.sort_order)).filter(models.Task.project_id == orig_t.project_id).scalar() or 0
        
        new_t = models.Task(
            project_id=orig_t.project_id,
            task_name=orig_t.task_name,
            detail=orig_t.detail,
            ticket_id=orig_t.ticket_id,
            memo=orig_t.memo,
            planned_start_date=orig_t.planned_start_date,
            planned_end_date=orig_t.planned_end_date,
            actual_start_date=orig_t.actual_start_date,
            actual_end_date=orig_t.actual_end_date,
            is_auto_planned_date=orig_t.is_auto_planned_date,
            is_auto_actual_date=orig_t.is_auto_actual_date,
            sort_order=max_sort + 1,
            status_id=orig_t.status_id,
            assignee_id=orig_t.assignee_id
        )
        db.add(new_t)
        db.flush()
        
        for orig_s in orig_t.subtasks:
            if orig_s.is_deleted: continue
            new_s = models.Subtask(
                task_id=new_t.id,
                subtask_type_id=orig_s.subtask_type_id,
                subtask_detail=orig_s.subtask_detail,
                status_id=orig_s.status_id,
                progress_percent=orig_s.progress_percent,
                assignee_id=orig_s.assignee_id,
                planned_start_date=orig_s.planned_start_date,
                planned_end_date=orig_s.planned_end_date,
                actual_start_date=orig_s.actual_start_date,
                review_start_date=orig_s.review_start_date,
                actual_end_date=orig_s.actual_end_date,
                planned_effort_days=orig_s.planned_effort_days,
                actual_effort_days=orig_s.actual_effort_days,
                review_days=orig_s.review_days,
                ticket_id=orig_s.ticket_id,
                memo=orig_s.memo,
                sort_order=orig_s.sort_order,
                is_auto_effort=orig_s.is_auto_effort,
                workload_percent=orig_s.workload_percent
            )
            db.add(new_s)

    # Duplicate Subtasks (standalone)
    for sid in s_ids:
        orig_s = db.query(models.Subtask).filter(models.Subtask.id == sid).first()
        if not orig_s: continue
        
        # New sort order: same task, max + 1
        max_sort = db.query(func.max(models.Subtask.sort_order)).filter(models.Subtask.task_id == orig_s.task_id).scalar() or 0
        
        new_s = models.Subtask(
            task_id=orig_s.task_id,
            subtask_type_id=orig_s.subtask_type_id,
            subtask_detail=orig_s.subtask_detail,
            status_id=orig_s.status_id,
            progress_percent=orig_s.progress_percent,
            assignee_id=orig_s.assignee_id,
            planned_start_date=orig_s.planned_start_date,
            planned_end_date=orig_s.planned_end_date,
            actual_start_date=orig_s.actual_start_date,
            review_start_date=orig_s.review_start_date,
            actual_end_date=orig_s.actual_end_date,
            planned_effort_days=orig_s.planned_effort_days,
            actual_effort_days=orig_s.actual_effort_days,
            review_days=orig_s.review_days,
            ticket_id=orig_s.ticket_id,
            memo=orig_s.memo,
            sort_order=max_sort + 1,
            is_auto_effort=orig_s.is_auto_effort,
            workload_percent=orig_s.workload_percent
        )
        db.add(new_s)

    db.commit()
    return True
