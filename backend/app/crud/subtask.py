from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal
from typing import Optional, List, Dict
from .. import models, schemas
from .recalc import recalculate_task_dates, recalculate_task_status
from ..utils import date_utils
from .master import get_holidays
from .base import get_status_ids_by_category

def _calculate_subtask_effort(db: Session, db_subtask: models.Subtask, update_data: Optional[Dict] = None):
    # Check if auto_effort is already set or being set to True
    is_auto = db_subtask.is_auto_effort
    if update_data and "is_auto_effort" in update_data:
        is_auto = update_data["is_auto_effort"]
        
    if not is_auto:
        return

    holidays = [h.holiday_date for h in get_holidays(db)]
    
    def get_val(key):
        if update_data and key in update_data:
            return update_data[key]
        return getattr(db_subtask, key)

    p_start = get_val("planned_start_date")
    p_end = get_val("planned_end_date")
    p_effort = get_val("planned_effort_days")
    p_review = get_val("review_days")
    workload = get_val("workload_percent")
    if workload is None: workload = 100
    # Avoid division by zero: assume at least 1% if it's 0 (most tasks have some workload)
    workload_factor = max(0.01, workload / 100.0)
    
    a_start = get_val("actual_start_date")
    a_end = get_val("actual_end_date")
    r_start = get_val("review_start_date")

    # Check if auto_effort is being turned ON
    is_turning_on = False
    if update_data and "is_auto_effort" in update_data and update_data["is_auto_effort"] and not db_subtask.is_auto_effort:
        is_turning_on = True

    # logic for planned
    if p_start:
        # If dates are updated OR auto_effort is being turned on, prioritize calculating effort
        if not update_data or any(k in (update_data or {}) for k in ["planned_start_date", "planned_end_date", "workload_percent", "is_auto_effort", "review_days"]):
            if p_end:
                raw_days = date_utils.get_business_days_count(p_start, p_end, holidays)
                # 予定工数 = (計画期間の営業日数 * 負荷率) - レビュー日数
                effort = max(0.0, raw_days * workload_factor - float(p_review or 0))
                # 四捨五入して1桁
                db_subtask.planned_effort_days = Decimal(str(int(effort * 10 + 0.5) / 10.0))
            elif is_turning_on and p_effort is not None:
                # 工数から終了日を逆算: 予定終了日 = (予定工数 + レビュー日数) / 負荷率
                total_duration = (float(p_effort) + float(p_review or 0)) / workload_factor
                db_subtask.planned_end_date = date_utils.add_business_days(p_start, total_duration, holidays)
        elif update_data and "planned_effort_days" in update_data:
            if p_effort is not None:
                # 同様に逆算
                total_duration = (float(p_effort) + float(p_review or 0)) / workload_factor
                db_subtask.planned_end_date = date_utils.add_business_days(p_start, total_duration, holidays)

    # logic for actual
    if a_start and a_end:
        if not update_data or any(k in (update_data or {}) for k in ["actual_start_date", "actual_end_date", "workload_percent", "is_auto_effort", "review_start_date"]):
            raw_days = date_utils.get_business_days_count(a_start, a_end, holidays)
            
            # 実績のレビュー期間（営業日数）を算出
            review_biz_days = 0.0
            if r_start and r_start <= a_end:
                # レビュー開始〜実績終了までの営業日数を差し引く
                # 制約により r_start >= a_start は保証されている
                review_start_for_calc = max(a_start, r_start)
                review_biz_days = date_utils.get_business_days_count(review_start_for_calc, a_end, holidays)
            
            # 実績工数 = (全体の営業日数 - レビュー営業日数) * 負荷率
            effort = max(0.0, (raw_days - review_biz_days) * workload_factor)
            # 四捨五入して1桁
            db_subtask.actual_effort_days = Decimal(str(int(effort * 10 + 0.5) / 10.0))

def refresh_subtasks_actual_end_date(db: Session, project_ids: Optional[List[int]] = None):
    """
    Update actual_end_date to today for all subtasks with 'In Progress' or 'In Review' status (ID 2, 3).
    This ensures that for ongoing tasks, the actual end date tracks today.
    """
    query = db.query(models.Subtask).join(models.Task).filter(
        models.Subtask.status_id.in_([2, 3]),
        models.Subtask.is_deleted == False
    )
    if project_ids:
        query = query.filter(models.Task.project_id.in_(project_ids))
    
    subtasks = query.all()
    today = date.today()
    
    affected_task_ids = set()
    changed = False
    for s in subtasks:
        if s.actual_end_date != today:
            s.actual_end_date = today
            # Ensure actual_start_date is not the future relative to actual_end_date (today)
            if s.actual_start_date and s.actual_start_date > today:
                s.actual_start_date = today
                
            _calculate_subtask_effort(db, s)
            affected_task_ids.add(s.task_id)
            changed = True
            
    if changed:
        db.commit()
        for tid in affected_task_ids:
            recalculate_task_dates(db, tid)

# --- Subtasks ---
def create_subtask(db: Session, subtask: schemas.SubtaskCreate):
    from sqlalchemy import func
    subtask_dict = subtask.model_dump()
    if subtask_dict.get("progress_percent") is None:
        subtask_dict["progress_percent"] = 0
        
    if subtask_dict.get("sort_order") == 0:
        max_order = db.query(func.max(models.Subtask.sort_order)).filter(
            models.Subtask.task_id == subtask_dict["task_id"],
            models.Subtask.is_deleted == False
        ).scalar()
        subtask_dict["sort_order"] = (max_order + 1) if max_order is not None else 0
        
    db_subtask = models.Subtask(**subtask_dict)
    
    # Auto-set dates based on status
    # 1. actual_start_date for In Progress (2), In Review (3) or Done (4)
    # Get status categories
    done_ids = get_status_ids_by_category(db, "done")
    # Actually 2, 3 are not in categories yet, keep them hardcoded or just keep as is if they are standard
    # Ongoing = [2, 3] (In Progress, In Review)
    
    if db_subtask.status_id in ([2, 3] + done_ids) and db_subtask.actual_start_date is None:
        db_subtask.actual_start_date = date.today()
    
    # 2. actual_end_date for In Progress (2) or In Review (3)
    if db_subtask.status_id in [2, 3]:
        db_subtask.actual_end_date = date.today()
        # Guarantee actual_start_date <= actual_end_date
        if db_subtask.actual_start_date and db_subtask.actual_start_date > db_subtask.actual_end_date:
            db_subtask.actual_start_date = db_subtask.actual_end_date

    # 3. actual_end_date for Done
    if db_subtask.status_id in done_ids and db_subtask.actual_end_date is None:
        db_subtask.actual_end_date = date.today()
    
    # 4. review_start_date for In Review (3)
    if db_subtask.status_id == 3 and db_subtask.review_start_date is None:
        db_subtask.review_start_date = date.today()
    
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
    
    old_task_id = db_subtask.task_id
    update_dict = subtask.dict(exclude_unset=True)
    
    # Auto-set dates if status is being changed
    # ... (existing status logic) ...
    new_status_id = update_dict.get("status_id")
    if new_status_id is not None and new_status_id != db_subtask.status_id:
        done_ids = get_status_ids_by_category(db, "done")

        # 1. actual_start_date for In Progress (2), In Review (3) or Done
        if new_status_id in ([2, 3] + done_ids):
            if "actual_start_date" not in update_dict and db_subtask.actual_start_date is None:
                update_dict["actual_start_date"] = date.today()
        
        # 1.5. actual_end_date for In Progress (2) or In Review (3)
        if new_status_id in [2, 3]:
            if "actual_end_date" not in update_dict:
                update_dict["actual_end_date"] = date.today()
            
            # Guarantee actual_start_date <= actual_end_date
            a_start = update_dict.get("actual_start_date") or db_subtask.actual_start_date
            a_end = update_dict.get("actual_end_date")
            if a_start and a_end and a_start > a_end:
                update_dict["actual_start_date"] = a_end

        # 2. actual_end_date for Done
        if new_status_id in done_ids:
            if "actual_end_date" not in update_dict and db_subtask.actual_end_date is None:
                update_dict["actual_end_date"] = date.today()
        
        # 3. review_start_date for In Review (3)
        if new_status_id == 3:
            if "review_start_date" not in update_dict and db_subtask.review_start_date is None:
                update_dict["review_start_date"] = date.today()
                
        # 4. Clear actual_end_date if moving AWAY from Done
        if db_subtask.status_id in done_ids and new_status_id not in done_ids:
            if "actual_end_date" not in update_dict:
                update_dict["actual_end_date"] = None
    
    # Calculate effort changes
    _calculate_subtask_effort(db, db_subtask, update_dict)
    
    for key, value in update_dict.items():
        setattr(db_subtask, key, value)
    db.commit()
    
    new_task_id = db_subtask.task_id
    
    # Always trigger recalculation for parent task
    recalculate_task_dates(db, new_task_id)
    recalculate_task_status(db, new_task_id)
    
    if new_task_id != old_task_id:
        recalculate_task_dates(db, old_task_id)
        recalculate_task_status(db, old_task_id)
    
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
