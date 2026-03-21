from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas
from ..database import get_db

router = APIRouter()

# --- WBS Aggregation ---
@router.get("/wbs", response_model=schemas.WBSResponse)
def read_wbs(
    project_ids: List[int] = Query(default=None),
    include_removed: bool = False,
    weeks: int = 8,
    db: Session = Depends(get_db)
):
    projects = crud.get_wbs_data(db, project_ids, include_removed)
    
    # Dynamic gantt range calculation
    from datetime import date, timedelta
    today = date.today()
    
    all_dates = []
    for p in projects:
        if p.planned_start_date: all_dates.append(p.planned_start_date)
        if p.planned_end_date: all_dates.append(p.planned_end_date)
        if p.actual_start_date: all_dates.append(p.actual_start_date)
        if p.actual_end_date: all_dates.append(p.actual_end_date)
        
    start_point = min(all_dates) if all_dates else today
    end_point = max(all_dates) if all_dates else today
    
    # Add 1 week buffer before and after (or use defaults if no dates)
    start_date = min(start_point - timedelta(days=7), today - timedelta(days=7))
    target_end = max(end_point + timedelta(days=14), today + timedelta(days=weeks*7))
    
    gantt_range = schemas.GanttRange(
        start_date=start_date,
        end_date=target_end,
        today=today
    )
    
    return {
        "filters": {
            "project_ids": project_ids or [],
            "include_removed": include_removed,
            "weeks": weeks
        },
        "gantt_range": gantt_range,
        "projects": projects
    }

# --- Projects ---
@router.post("/projects", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db=db, project=project)

@router.patch("/projects/{project_id}", response_model=schemas.Project)
def update_project(project_id: int, project: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    db_proj = crud.update_project(db, project_id, project)
    if not db_proj: raise HTTPException(status_code=404, detail="Project not found")
    return db_proj

@router.delete("/projects/{project_id}", response_model=schemas.Project)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_proj = crud.delete_project(db, project_id)
    if not db_proj: raise HTTPException(status_code=404, detail="Project not found")
    return db_proj

# --- Tasks ---
@router.post("/tasks", response_model=schemas.Task)
def create_task(task: schemas.TaskCreate, db: Session = Depends(get_db)):
    return crud.create_task(db=db, task=task)

@router.patch("/tasks/{task_id}", response_model=schemas.Task)
def update_task(task_id: int, task: schemas.TaskUpdate, db: Session = Depends(get_db)):
    db_task = crud.update_task(db, task_id, task)
    if not db_task: raise HTTPException(status_code=404, detail="Task not found")
    return db_task

@router.delete("/tasks/{task_id}", response_model=schemas.Task)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    db_task = crud.delete_task(db, task_id)
    if not db_task: raise HTTPException(status_code=404, detail="Task not found")
    return db_task

# --- Subtasks ---
@router.post("/subtasks", response_model=schemas.Subtask)
def create_subtask(subtask: schemas.SubtaskCreate, db: Session = Depends(get_db)):
    return crud.create_subtask(db=db, subtask=subtask)

@router.patch("/subtasks/{subtask_id}", response_model=schemas.Subtask)
def update_subtask(subtask_id: int, subtask: schemas.SubtaskUpdate, db: Session = Depends(get_db)):
    db_subtask = crud.update_subtask(db, subtask_id, subtask)
    if not db_subtask: raise HTTPException(status_code=404, detail="Subtask not found")
    return db_subtask

@router.delete("/subtasks/{subtask_id}", response_model=schemas.Subtask)
def delete_subtask(subtask_id: int, db: Session = Depends(get_db)):
    db_subtask = crud.delete_subtask(db, subtask_id)
    if not db_subtask: raise HTTPException(status_code=404, detail="Subtask not found")
    return db_subtask

# --- Masters ---
@router.get("/initial-data")
def get_initial_data(db: Session = Depends(get_db)):
    return {
        "statuses": crud.get_statuses(db),
        "subtask_types": crud.get_subtask_types(db),
        "members": crud.get_members(db)
    }
