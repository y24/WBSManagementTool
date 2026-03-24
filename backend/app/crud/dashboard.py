from datetime import date, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models, schemas
from .wbs import get_wbs_data
from decimal import Decimal

def get_dashboard_data(db: Session) -> schemas.DashboardData:
    today = date.today()
    # Find Monday of this week (assume Monday is start of week)
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)

    # 1. KPIs
    # Ongoing projects (Active statuses)
    active_statuses = db.query(models.MstStatus).filter(
        models.MstStatus.status_name.notin_(["Done", "Removed"])
    ).all()
    active_status_ids = [s.id for s in active_statuses]
    
    done_status = db.query(models.MstStatus).filter(models.MstStatus.status_name == "Done").first()
    removed_status = db.query(models.MstStatus).filter(models.MstStatus.status_name == "Removed").first()
    in_review_status = db.query(models.MstStatus).filter(models.MstStatus.status_name == "In Review").first()
    
    done_id = done_status.id if done_status else -1
    removed_id = removed_status.id if removed_status else -1
    in_review_id = in_review_status.id if in_review_status else -1

    ongoing_projects_count = db.query(models.Project).filter(
        models.Project.is_deleted == False,
        models.Project.status_id.in_(active_status_ids)
    ).count()

    overdue_subtasks_count = db.query(models.Subtask).join(models.Task).join(models.Project).filter(
        models.Subtask.is_deleted == False,
        models.Subtask.planned_end_date < today,
        models.Subtask.status_id != done_id,
        models.Subtask.status_id != removed_id,
        models.Task.is_deleted == False,
        models.Project.is_deleted == False,
        models.Project.status_id.in_(active_status_ids)
    ).count()

    # Get all subtasks for active projects to process in Python for more complex logic
    all_subtasks_base = db.query(models.Subtask).join(models.Task).join(models.Project).filter(
        models.Subtask.is_deleted == False,
        models.Subtask.status_id != removed_id,
        models.Task.is_deleted == False,
        models.Project.is_deleted == False,
        models.Project.status_id.in_(active_status_ids)
    ).all()

    review_delay_count = 0
    this_week_end_count = 0
    for s in all_subtasks_base:
        # Scheduled to end this week
        if s.planned_end_date and monday <= s.planned_end_date <= sunday:
            if s.status_id != done_id:
                this_week_end_count += 1
            
        # Review start delay: should have started review but hasn't
        if s.status_id != done_id and s.status_id != in_review_id:
            if s.planned_end_date and s.review_days is not None and s.review_start_date is None:
                review_start_deadline = s.planned_end_date - timedelta(days=int(float(s.review_days)))
                if review_start_deadline < today:
                    review_delay_count += 1

    kpis = schemas.DashboardKPIs(
        ongoing_projects_count=ongoing_projects_count,
        overdue_subtasks_count=overdue_subtasks_count,
        review_delay_count=review_delay_count,
        this_week_end_count=this_week_end_count
    )

    # 2. Project Progress
    projects_wbs = get_wbs_data(db)
    
    # Filter: Exclude Done and Removed projects from the progress chart
    project_progress = [
        schemas.ProjectProgressData(
            project_name=p.project_name,
            progress_percent=p.progress_percent
        ) for p in projects_wbs if not p.is_deleted and p.status_id not in [done_id, removed_id]
    ]
    # Sort by progress descending or just name
    project_progress.sort(key=lambda x: x.progress_percent, reverse=True)

    # 3. Assignee Delays
    assignee_delays_map = {}
    for s in all_subtasks_base:
        if s.planned_end_date and s.planned_end_date < today and s.status_id != done_id:
            name = s.assignee.member_name if s.assignee else "未割当"
            assignee_delays_map[name] = assignee_delays_map.get(name, 0) + 1
    
    assignee_delays = [
        schemas.AssigneeDelayData(member_name=name, delay_count=count)
        for name, count in assignee_delays_map.items()
    ]
    assignee_delays.sort(key=lambda x: x.delay_count, reverse=True)

    # 4. Status Counts
    status_counts_map = {}
    for s in all_subtasks_base:
        status_name = s.status.status_name
        if status_name not in status_counts_map:
            status_counts_map[status_name] = {
                "count": 0,
                "color": s.status.color_code
            }
        status_counts_map[status_name]["count"] += 1
    
    status_counts = [
        schemas.StatusCountData(status_name=name, count=data["count"], color_code=data["color"])
        for name, data in status_counts_map.items()
    ]

    # 5. Review Delays (Started but exceeding review days, or not started but past review start deadline)
    review_delays_list = []
    for s in all_subtasks_base:
        if s.status_id == done_id:
            continue
        
        if s.review_days:
            # Case A: Review started but exceeding review days
            if s.review_start_date:
                actual_review_days = (today - s.review_start_date).days
                if actual_review_days > float(s.review_days):
                    review_delays_list.append(schemas.ReviewDelaySubtask(
                        id=s.id,
                        task_name=s.task.task_name,
                        subtask_detail=(f"{s.subtask_type.type_name}({s.subtask_detail})" if s.subtask_detail else s.subtask_type.type_name) if s.subtask_type else (s.subtask_detail or "名称未設定"),
                        planned_end_date=s.planned_end_date,
                        progress_percent=s.progress_percent or 0,
                        assignee_name=s.assignee.member_name if s.assignee else None,
                        review_days=float(s.review_days),
                        review_start_date=s.review_start_date,
                        delay_days=float(actual_review_days) - float(s.review_days)
                    ))
            # Case B: Review not started and past review start deadline
            elif s.status_id != in_review_id and s.planned_end_date:
                # review_start_deadline = planned_end_date - review_days
                review_start_deadline = s.planned_end_date - timedelta(days=int(float(s.review_days)))
                if today > review_start_deadline:
                    review_delays_list.append(schemas.ReviewDelaySubtask(
                        id=s.id,
                        task_name=s.task.task_name,
                        subtask_detail=(f"{s.subtask_type.type_name}({s.subtask_detail})" if s.subtask_detail else s.subtask_type.type_name) if s.subtask_type else (s.subtask_detail or "名称未設定"),
                        planned_end_date=s.planned_end_date,
                        progress_percent=s.progress_percent or 0,
                        assignee_name=s.assignee.member_name if s.assignee else None,
                        review_days=float(s.review_days),
                        review_start_date=None,
                        delay_days=float((today - review_start_deadline).days)
                    ))

    review_delays_list.sort(key=lambda x: x.delay_days, reverse=True)
    review_delays = review_delays_list

    # 6. Low Progress Soon-to-Finish
    low_progress_soon = []
    for s in all_subtasks_base:
        if s.planned_end_date and monday <= s.planned_end_date <= sunday:
            if s.status_id != done_id and (s.progress_percent or 0) < 50:
                low_progress_soon.append(schemas.SubtaskSummary(
                    id=s.id,
                    task_name=s.task.task_name,
                    subtask_detail=(f"{s.subtask_type.type_name}({s.subtask_detail})" if s.subtask_detail else s.subtask_type.type_name) if s.subtask_type else (s.subtask_detail or "名称未設定"),
                    planned_end_date=s.planned_end_date,
                    progress_percent=s.progress_percent or 0,
                    assignee_name=s.assignee.member_name if s.assignee else None
                ))
    low_progress_soon.sort(key=lambda x: x.planned_end_date)

    # 7. Assignee Summary
    members = db.query(models.MstMember).filter(models.MstMember.is_active == True).all()
    assignee_summary = []
    for m in members:
        m_subtasks = [s for s in all_subtasks_base if s.assignee_id == m.id]
        total_count = len(m_subtasks)
        this_week_end = len([s for s in m_subtasks if s.planned_end_date and monday <= s.planned_end_date <= sunday and s.status_id != done_id])
        overdue = len([s for s in m_subtasks if s.planned_end_date and s.planned_end_date < today and s.status_id != done_id])
        
        # Concurrent: Status is In Progress or (actual_start_date is set and actual_end_date is null)
        concurrent = 0
        for s in m_subtasks:
            if s.status.status_name in ["In Progress", "In Review"]:
                concurrent += 1
            elif s.actual_start_date and not s.actual_end_date and s.status_id != done_id:
                concurrent += 1
        
        assignee_summary.append(schemas.AssigneeSummary(
            member_name=m.member_name,
            total_count=total_count,
            this_week_end_count=this_week_end,
            overdue_count=overdue,
            concurrent_count=concurrent
        ))

    # Sort by Delay desc, then Run desc (and name for deterministic order).
    assignee_summary.sort(
        key=lambda x: (-x.overdue_count, -x.concurrent_count, x.member_name)
    )

    # 8. Project Effort (Top 5 by absolute deviation)
    project_effort_list = [
        schemas.ProjectEffortData(
            project_name=p.project_name,
            planned_effort=float(p.planned_effort_total),
            actual_effort=float(p.actual_effort_total)
        ) for p in projects_wbs
    ]
    # Sort by absolute deviation
    project_effort_list.sort(key=lambda x: abs(x.actual_effort - x.planned_effort), reverse=True)
    project_effort = project_effort_list[:5]

    # 9. Task Deviation & 10. Assignee Error & 11. Trend
    # Fetch all relevant subtasks to calculate task-level stats
    # Including Done projects for trend analysis
    all_subtasks_for_stats = db.query(models.Subtask).join(models.Task).join(models.Project).filter(
        models.Subtask.is_deleted == False,
        models.Task.is_deleted == False,
        models.Project.is_deleted == False,
        models.Subtask.status_id != removed_id
    ).all()

    task_stats = {}
    for s in all_subtasks_for_stats:
        tid = s.task_id
        if tid not in task_stats:
            task_stats[tid] = {
                "name": s.task.task_name,
                "project": s.task.project.project_name,
                "planned": 0.0,
                "actual": 0.0,
                "assignee": s.task.assignee.member_name if s.task.assignee else (s.assignee.member_name if s.assignee else "未割当"),
                "completed_date": s.task.actual_end_date
            }
        task_stats[tid]["planned"] += float(s.planned_effort_days or 0)
        task_stats[tid]["actual"] += float(s.actual_effort_days or 0)

    task_deviations_list = []
    assignee_errors = {}
    trend_data = {}

    for tid, stats in task_stats.items():
        if stats["planned"] > 0:
            dev_rate = (stats["actual"] - stats["planned"]) / stats["planned"] * 100
            
            task_deviations_list.append(schemas.TaskDeviationData(
                task_name=stats["name"],
                project_name=stats["project"],
                planned_effort=stats["planned"],
                actual_effort=stats["actual"],
                deviation_rate=dev_rate
            ))
            
            name = stats["assignee"]
            if name not in assignee_errors: assignee_errors[name] = []
            assignee_errors[name].append(dev_rate)
            
            if stats["completed_date"]:
                period = stats["completed_date"].strftime("%Y-%m")
                if period not in trend_data: trend_data[period] = []
                trend_data[period].append(dev_rate)

    task_deviations_list.sort(key=lambda x: abs(x.deviation_rate), reverse=True)
    task_deviations = task_deviations_list[:10]

    assignee_estimate_errors = [
        schemas.AssigneeEstimateErrorData(
            member_name=name,
            avg_deviation_rate=sum(devs) / len(devs),
            task_count=len(devs)
        ) for name, devs in assignee_errors.items()
    ]
    assignee_estimate_errors.sort(key=lambda x: abs(x.avg_deviation_rate), reverse=True)

    sorted_p_keys = sorted(trend_data.keys(), reverse=True)[:6]
    sorted_p_keys.reverse()
    estimate_accuracy_trend = [
        schemas.EstimateAccuracyTrendData(
            period=p,
            avg_deviation_rate=sum(trend_data[p]) / len(trend_data[p]),
            task_count=len(trend_data[p])
        ) for p in sorted_p_keys
    ]

    return schemas.DashboardData(
        kpis=kpis,
        project_progress=project_progress,
        assignee_delays=assignee_delays,
        status_counts=status_counts,
        review_delays=review_delays,
        low_progress_soon_to_finish=low_progress_soon,
        assignee_summary=assignee_summary,
        project_effort=project_effort,
        task_deviations=task_deviations,
        assignee_estimate_errors=assignee_estimate_errors,
        estimate_accuracy_trend=estimate_accuracy_trend
    )
