from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload
from .. import models, schemas
from .base import check_overlap

def get_wbs_data(db: Session, project_ids: list[int] = None, include_done: bool = False, include_removed: bool = False):
    from .base import get_status_ids_by_category
    done_ids = get_status_ids_by_category(db, "done")
    
    removed_status = db.query(models.MstStatus).filter(models.MstStatus.status_name == "Removed").first()
    removed_id = removed_status.id if removed_status else 7
    
    query = db.query(models.Project)
    
    # Base soft-delete filter (ALWAYS exclude soft-deleted items from WBS)
    query = query.filter(models.Project.is_deleted == False)
    
    # Project status level filters
    exclude_project_status_ids = []
    if not include_done:
        # Avoid excluding items that are both 'Done' and 'Removed' if include_removed is True
        for d_id in done_ids:
            if d_id != removed_id:
                exclude_project_status_ids.append(d_id)
    if not include_removed:
        exclude_project_status_ids.append(removed_id)
        
    if exclude_project_status_ids:
        query = query.filter((models.Project.status_id == None) | (~models.Project.status_id.in_(exclude_project_status_ids)))
        
    if project_ids:
        query = query.filter(models.Project.id.in_(project_ids))
    
    # Task/Subtask level filters (ALWAYS exclude soft-deleted items)
    task_filter = models.Task.is_deleted == False
    subtask_filter = models.Subtask.is_deleted == False
    
    if not include_removed:
        task_filter = task_filter & ((models.Task.status_id == None) | (models.Task.status_id != removed_id))
        subtask_filter = subtask_filter & ((models.Subtask.status_id == None) | (models.Subtask.status_id != removed_id))

    query = query.options(
        selectinload(models.Project.tasks.and_(task_filter)).selectinload(models.Task.status),
        selectinload(models.Project.tasks.and_(task_filter)).selectinload(models.Task.subtasks.and_(subtask_filter)).selectinload(models.Subtask.status),
        selectinload(models.Project.status)
    )
        
    projects = query.order_by(models.Project.sort_order, models.Project.id).all()
    
    # Map to schema with calculated fields
    result = []
    for p in projects:
        p_wbs = schemas.ProjectWBS.from_orm(p)
        
        tasks_wbs = []
        p_planned_effort = Decimal('0')
        p_actual_effort = Decimal('0')
        task_periods = []
        
        valid_tasks_for_recalc = []
        for t in p.tasks:
            if t.is_deleted: continue
            
            is_task_removed = t.status and t.status.status_name == "Removed"
            
            t_wbs = schemas.TaskWBS.from_orm(t)
            valid_subtasks = [s for s in t.subtasks if not s.is_deleted and (s.status and s.status.status_name != "Removed")]
            t_wbs.planned_effort_total = sum((s.planned_effort_days or Decimal('0')) for s in valid_subtasks)
            t_wbs.actual_effort_total = sum((s.actual_effort_days or Decimal('0')) for s in valid_subtasks)
            t_wbs.work_days_total = sum((s.work_days or Decimal('0')) for s in valid_subtasks)
            
            # Weighted progress for Task
            if t_wbs.planned_effort_total > 0:
                # We use planned_effort_days as weight. 
                # Note: planned_effort_days already includes workload_percent (effort = duration * workload_percent / 100)
                weighted_sum = sum((Decimal(str(s.progress_percent or 0)) * (s.planned_effort_days or Decimal('0'))) for s in valid_subtasks)
                t_wbs.progress_percent = int(round(float(weighted_sum) / float(t_wbs.planned_effort_total)))
            elif valid_subtasks:
                # Fallback: if all subtasks have no planned effort (e.g. no dates), 
                # use workload_percent as the weight for calculating progress.
                total_workload = sum(s.workload_percent for s in valid_subtasks)
                if total_workload > 0:
                    weighted_sum = sum((s.progress_percent or 0) * s.workload_percent for s in valid_subtasks)
                    t_wbs.progress_percent = int(round(float(weighted_sum) / float(total_workload)))
                else:
                    # Final fallback to simple average
                    t_wbs.progress_percent = int(round(sum(s.progress_percent or 0 for s in valid_subtasks) / len(valid_subtasks)))
            else:
                t_wbs.progress_percent = 0

            if not is_task_removed:
                p_planned_effort += t_wbs.planned_effort_total
                p_actual_effort += t_wbs.actual_effort_total
                p_work_days_total = getattr(p_wbs, 'work_days_total', Decimal('0')) + t_wbs.work_days_total
                p_wbs.work_days_total = p_work_days_total
                valid_tasks_for_recalc.append(t_wbs)
            
            # Subtask overlap check
            subtask_periods = [(s.planned_start_date, s.planned_end_date) for s in valid_subtasks]
            t_wbs.is_overlapping = check_overlap(subtask_periods)
            
            if not is_task_removed and t_wbs.planned_start_date and t_wbs.planned_end_date:
                task_periods.append((t_wbs.planned_start_date, t_wbs.planned_end_date))
                
            tasks_wbs.append(t_wbs)
            
        p_wbs.tasks = tasks_wbs
        p_wbs.planned_effort_total = p_planned_effort
        p_wbs.actual_effort_total = p_actual_effort
        
        # Weighted progress for Project
        if p_wbs.planned_effort_total > 0:
            weighted_sum = sum((Decimal(str(t.progress_percent or 0)) * (t.planned_effort_total or Decimal('0'))) for t in valid_tasks_for_recalc)
            p_wbs.progress_percent = int(round(float(weighted_sum) / float(p_wbs.planned_effort_total)))
        elif valid_tasks_for_recalc:
            p_wbs.progress_percent = int(round(sum(t.progress_percent or 0 for t in valid_tasks_for_recalc) / len(valid_tasks_for_recalc)))
        else:
            p_wbs.progress_percent = 0
        
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
            work_days=orig_p.work_days,
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
                work_days=orig_t.work_days,
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
                    work_days=orig_s.work_days,
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
            work_days=orig_t.work_days,
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
                work_days=orig_s.work_days,
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
            work_days=orig_s.work_days,
            ticket_id=orig_s.ticket_id,
            memo=orig_s.memo,
            sort_order=max_sort + 1,
            is_auto_effort=orig_s.is_auto_effort,
            workload_percent=orig_s.workload_percent
        )
        db.add(new_s)

    db.commit()
    return True

def clear_actuals(db: Session, req: schemas.ClearActualsRequest):
    from .recalc import recalculate_task_dates, recalculate_task_status, recalculate_project_dates, recalculate_project_status
    
    # Get all projects, tasks, subtasks to be cleared
    p_ids = set(req.project_ids)
    t_ids = set(req.task_ids)
    s_ids = set(req.subtask_ids)

    affected_task_ids = set()
    affected_project_ids = set()

    # 1. Clear Projects (and their descendants)
    for pid in p_ids:
        project = db.query(models.Project).filter(models.Project.id == pid).first()
        if not project: continue
        
        project.actual_start_date = None
        project.actual_end_date = None
        
        for task in project.tasks:
            task.actual_start_date = None
            task.actual_end_date = None
            for subtask in task.subtasks:
                subtask.actual_start_date = None
                subtask.review_start_date = None
                subtask.actual_end_date = None
                subtask.actual_effort_days = None
                subtask.progress_percent = None
                
    # 2. Clear Tasks (and their subtasks)
    for tid in t_ids:
        # If parent project is already being cleared, skip
        task = db.query(models.Task).filter(models.Task.id == tid).first()
        if not task or task.project_id in p_ids: continue
        
        task.actual_start_date = None
        task.actual_end_date = None
        for subtask in task.subtasks:
            subtask.actual_start_date = None
            subtask.review_start_date = None
            subtask.actual_end_date = None
            subtask.actual_effort_days = None
            subtask.progress_percent = None
        
        affected_project_ids.add(task.project_id)
            
    # 3. Clear Subtasks
    for sid in s_ids:
        subtask = db.query(models.Subtask).filter(models.Subtask.id == sid).first()
        if not subtask: continue
        
        # If parent task or project is already being cleared, skip
        if subtask.task_id in t_ids: continue
        parent_task = db.query(models.Task).filter(models.Task.id == subtask.task_id).first()
        if not parent_task or parent_task.project_id in p_ids: continue
        
        subtask.actual_start_date = None
        subtask.review_start_date = None
        subtask.actual_end_date = None
        subtask.actual_effort_days = None
        subtask.progress_percent = None
        
        affected_task_ids.add(subtask.task_id)

    db.commit()
    
    # Trigger recalculations for items whose children were cleared but themselves weren't
    for tid in affected_task_ids:
        recalculate_task_dates(db, tid)
        recalculate_task_status(db, tid)
    
    for pid in affected_project_ids:
        recalculate_project_dates(db, pid)
        recalculate_project_status(db, pid)

    return True

def clear_plans_actuals(db: Session, req: schemas.ClearPlansActualsRequest):
    from .recalc import recalculate_task_dates, recalculate_task_status, recalculate_project_dates, recalculate_project_status
    
    # Get all projects, tasks, subtasks to be cleared
    p_ids = set(req.project_ids)
    t_ids = set(req.task_ids)
    s_ids = set(req.subtask_ids)

    affected_task_ids = set()
    affected_project_ids = set()

    # 1. Clear Projects (and their descendants)
    for pid in p_ids:
        project = db.query(models.Project).filter(models.Project.id == pid).first()
        if not project: continue
        
        project.planned_start_date = None
        project.planned_end_date = None
        project.actual_start_date = None
        project.actual_end_date = None
        project.work_days = None
        project.status_id = 1
        
        for task in project.tasks:
            task.planned_start_date = None
            task.planned_end_date = None
            task.actual_start_date = None
            task.actual_end_date = None
            task.work_days = None
            task.status_id = 1
            for subtask in task.subtasks:
                subtask.planned_start_date = None
                subtask.planned_end_date = None
                subtask.actual_start_date = None
                subtask.review_start_date = None
                subtask.actual_end_date = None
                subtask.planned_effort_days = None
                subtask.actual_effort_days = None
                subtask.work_days = None
                subtask.review_days = None
                subtask.progress_percent = None
                subtask.status_id = 1
                
    # 2. Clear Tasks (and their subtasks)
    for tid in t_ids:
        # If parent project is already being cleared, skip
        task = db.query(models.Task).filter(models.Task.id == tid).first()
        if not task or task.project_id in p_ids: continue
        
        task.planned_start_date = None
        task.planned_end_date = None
        task.actual_start_date = None
        task.actual_end_date = None
        task.work_days = None
        task.status_id = 1
        for subtask in task.subtasks:
            subtask.planned_start_date = None
            subtask.planned_end_date = None
            subtask.actual_start_date = None
            subtask.review_start_date = None
            subtask.actual_end_date = None
            subtask.planned_effort_days = None
            subtask.actual_effort_days = None
            subtask.work_days = None
            subtask.review_days = None
            subtask.progress_percent = None
            subtask.status_id = 1
        
        affected_project_ids.add(task.project_id)
            
    # 3. Clear Subtasks
    for sid in s_ids:
        subtask = db.query(models.Subtask).filter(models.Subtask.id == sid).first()
        if not subtask: continue
        
        # If parent task or project is already being cleared, skip
        if subtask.task_id in t_ids: continue
        parent_task = db.query(models.Task).filter(models.Task.id == subtask.task_id).first()
        if not parent_task or parent_task.project_id in p_ids: continue
        
        subtask.planned_start_date = None
        subtask.planned_end_date = None
        subtask.actual_start_date = None
        subtask.review_start_date = None
        subtask.actual_end_date = None
        subtask.planned_effort_days = None
        subtask.actual_effort_days = None
        subtask.work_days = None
        subtask.review_days = None
        subtask.progress_percent = None
        subtask.status_id = 1
        
        affected_task_ids.add(subtask.task_id)

    db.commit()
    
    # Trigger recalculations
    for tid in affected_task_ids:
        recalculate_task_dates(db, tid)
        recalculate_task_status(db, tid)
    
    for pid in affected_project_ids:
        recalculate_project_dates(db, pid)
        recalculate_project_status(db, pid)

    return True

def shift_dates(db: Session, req: schemas.ShiftDatesRequest):
    from ..utils.date_utils import shift_business_days, get_business_days_count, is_business_day
    
    # 1. Collect all affected items and their dates to find the global min_date
    p_ids = set(req.project_ids)
    t_ids = set(req.task_ids)
    s_ids = set(req.subtask_ids)
    
    all_projects = db.query(models.Project).filter(models.Project.id.in_(p_ids)).all()
    all_tasks = db.query(models.Task).filter(models.Task.id.in_(t_ids)).all()
    all_subtasks = db.query(models.Subtask).filter(models.Subtask.id.in_(s_ids)).all()
    
    # Add children to the set of affected items
    affected_projects = list(all_projects)
    affected_tasks = list(all_tasks)
    affected_subtasks = list(all_subtasks)
    
    # Track which IDs are already included to avoid double processing
    processed_p_ids = {p.id for p in affected_projects}
    processed_t_ids = {t.id for t in affected_tasks}
    processed_s_ids = {s.id for s in affected_subtasks}
    
    # Include descendants of projects
    for p in all_projects:
        for t in p.tasks:
            if t.id not in processed_t_ids:
                affected_tasks.append(t)
                processed_t_ids.add(t.id)
            for s in t.subtasks:
                if s.id not in processed_s_ids:
                    affected_subtasks.append(s)
                    processed_s_ids.add(s.id)
                    
    # Include descendants of tasks
    for t in all_tasks:
        for s in t.subtasks:
            if s.id not in processed_s_ids:
                affected_subtasks.append(s)
                processed_s_ids.add(s.id)
                
    # 2. Find min_date among all selected items and their children
    all_dates = []
    for p in affected_projects:
        for d in [p.planned_start_date, p.planned_end_date, p.actual_start_date, p.actual_end_date]:
            if d: all_dates.append(d)
    for t in affected_tasks:
        for d in [t.planned_start_date, t.planned_end_date, t.actual_start_date, t.actual_end_date]:
            if d: all_dates.append(d)
    for s in affected_subtasks:
        for d in [s.planned_start_date, s.planned_end_date, s.actual_start_date, s.review_start_date, s.actual_end_date]:
            if d: all_dates.append(d)
            
    if not all_dates:
        return False
        
    min_date = min(all_dates)
    
    # 3. Calculate offset in business days
    holidays = [h.holiday_date for h in db.query(models.MstHoliday).filter(models.MstHoliday.is_active == True).all()]
    
    # We need a proper business day offset.
    # If new_base_date > min_date, offset is positive business days.
    # If new_base_date < min_date, offset is negative business days.
    
    offset = 0
    if req.new_base_date > min_date:
        # Count business days from min_date to new_base_date
        # Note: if min_date is 3/2 and new_base_date is 3/3, and both are biz days, offset should be 1.
        # get_business_days_count(3/2, 3/3) returns 2.0 (inclusive).
        # So offset = count - 1 if min_date is a biz day?
        # Let's use a simpler loop to find the offset.
        curr = min_date
        while curr < req.new_base_date:
            curr += timedelta(days=1)
            if is_business_day(curr, holidays):
                offset += 1
    elif req.new_base_date < min_date:
        curr = min_date
        while curr > req.new_base_date:
            curr -= timedelta(days=1)
            if is_business_day(curr, holidays):
                offset -= 1
                
    # 4. Apply shift
    for p in affected_projects:
        p.planned_start_date = shift_business_days(p.planned_start_date, offset, holidays)
        p.planned_end_date = shift_business_days(p.planned_end_date, offset, holidays)
        p.actual_start_date = shift_business_days(p.actual_start_date, offset, holidays)
        p.actual_end_date = shift_business_days(p.actual_end_date, offset, holidays)
        
    for t in affected_tasks:
        t.planned_start_date = shift_business_days(t.planned_start_date, offset, holidays)
        t.planned_end_date = shift_business_days(t.planned_end_date, offset, holidays)
        t.actual_start_date = shift_business_days(t.actual_start_date, offset, holidays)
        t.actual_end_date = shift_business_days(t.actual_end_date, offset, holidays)
        
    for s in affected_subtasks:
        s.planned_start_date = shift_business_days(s.planned_start_date, offset, holidays)
        s.planned_end_date = shift_business_days(s.planned_end_date, offset, holidays)
        s.actual_start_date = shift_business_days(s.actual_start_date, offset, holidays)
        s.review_start_date = shift_business_days(s.review_start_date, offset, holidays)
        s.actual_end_date = shift_business_days(s.actual_end_date, offset, holidays)
        
    db.commit()

    # 5. Trigger recalculations for parent items
    from .recalc import recalculate_task_dates, recalculate_task_status, recalculate_project_dates, recalculate_project_status
    
    # Identify parents of affected items to trigger recalculations
    final_affected_task_ids = set()
    final_affected_project_ids = set()
    
    for s in affected_subtasks:
        final_affected_task_ids.add(s.task_id)
    
    for t in affected_tasks:
        final_affected_project_ids.add(t.project_id)
        # Also need to make sure we recalculate this task itself if it has subtasks
        if t.id not in processed_t_ids: # Wait, processed_t_ids includes all affected.
            pass
        final_affected_task_ids.add(t.id)

    # Recalculate tasks first
    for tid in final_affected_task_ids:
        recalculate_task_dates(db, tid)
        recalculate_task_status(db, tid)
        
    db.commit() # Save task changes so project recalc sees them
    
    # Recalculate projects
    for pid in final_affected_project_ids:
        recalculate_project_dates(db, pid)
        recalculate_project_status(db, pid)
        
    db.commit()
    return True
