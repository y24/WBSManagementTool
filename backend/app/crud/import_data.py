import pandas as pd
import io
from sqlalchemy.orm import Session
from datetime import date
from decimal import Decimal
from typing import List, Dict, Optional, Tuple
from .. import models, schemas
from .project import create_project
from .task import create_task
from .subtask import create_subtask
from .master import get_statuses, get_members, get_subtask_types

COLUMN_MAPPING = {
    "階層": "level",
    "名称": "name",  # Used for Project/Task name
    "サブタスク種別": "type",
    "サブタスク詳細": "subtask_detail",
    "チケットID": "ticket_id",
    "ステータス": "status",
    "担当者": "assignee",
    "レビュー日数": "review_days",
    "計画開始": "planned_start",
    "計画終了": "planned_end",
    "予定工数": "planned_effort",
    "工数比率": "workload",
    "メモ": "memo"
}

def generate_template() -> io.BytesIO:
    columns = list(COLUMN_MAPPING.keys())
    sample_data = [
        [0, "新規プロジェクトA", "", "", "", "未着手", "田中", "", "2024-04-01", "2024-04-30", "", "", "プロジェクトのメモ"],
        [1, "基本設計", "", "", "", "未着手", "田中", "", "2024-04-01", "2024-04-10", "", "", "タスクのメモ"],
        [2, "", "設計", "画面遷移図作成", "123", "未着手", "佐藤", 1, "2024-04-01", "2024-04-03", 2, 100, "サブタスクのメモ"],
        [2, "", "設計", "DB設計", "124", "未着手", "佐藤", 0, "2024-04-04", "2024-04-05", 1, 100, ""],
        [1, "詳細設計", "", "", "", "未着手", "鈴木", "", "", "", "", "", ""],
        [2, "", "開発", "クラス設計", "", "未着手", "鈴木", 0, "", "", "", 100, "日付未入力は自動計算されます"],
    ]
    df = pd.DataFrame(sample_data, columns=columns)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Import')
    output.seek(0)
    return output

def validate_and_preview(db: Session, file_content: bytes) -> schemas.ImportPreviewResponse:
    try:
        df = pd.read_excel(io.BytesIO(file_content))
    except Exception as e:
        return schemas.ImportPreviewResponse(rows=[], can_import=False)

    # Convert columns to English keys if they match
    headers = {v: k for k, v in COLUMN_MAPPING.items()}
    df = df.rename(columns={k: v for k, v in COLUMN_MAPPING.items() if k in df.columns})

    # Fetch master data for validation
    db_statuses = {s.status_name: s.id for s in get_statuses(db)}
    db_members = {m.member_name: m.id for m in get_members(db)}
    db_types = {t.type_name: t.id for t in get_subtask_types(db)}

    preview_rows = []
    can_import = True

    current_level = -1
    
    for i, row in df.iterrows():
        errors = []
        row_idx = i + 2  # Excel row (1-indexed + header)
        
        # 1. Basic Validation
        level = row.get("level")
        if pd.isna(level) or level not in [0, 1, 2]:
            errors.append(f"階層が不正です (0, 1, 2を指定してください)")
            level = -1
        
        # Hierarchy check
        if level == 0:
            current_level = 0
        elif level == 1:
            if current_level < 0:
                errors.append("プロジェクト(0)が先頭に必要です")
            current_level = 1
        elif level == 2:
            if current_level < 1:
                errors.append("タスク(1)が上位に必要です")
            current_level = 2

        # Name / Detail validation
        name = ""
        if level == 0 or level == 1:
            name = str(row.get("name", ""))
            if not name or name == "nan":
                errors.append("名称を入力してください")
        elif level == 2:
            name = str(row.get("subtask_detail", ""))
            if not name or name == "nan":
                errors.append("サブタスク詳細を入力してください")

        # Master data validation
        status_name = str(row.get("status", ""))
        status_id = None
        if status_name and status_name != "nan":
            status_id = db_statuses.get(status_name)
            if not status_id:
                errors.append(f"ステータス '{status_name}' がマスタに存在しません")
        elif level == 2:
             errors.append("ステータスを入力してください")

        assignee_name = str(row.get("assignee", ""))
        assignee_id = None
        if assignee_name and assignee_name != "nan":
            assignee_id = db_members.get(assignee_name)
            if not assignee_id:
                errors.append(f"担当者 '{assignee_name}' がマスタに存在しません")

        type_name = str(row.get("type", ""))
        type_id = None
        if level == 2:
            if type_name and type_name != "nan":
                type_id = db_types.get(type_name)
                if not type_id:
                    errors.append(f"種別 '{type_name}' がマスタに存在しません")

        # Date validation
        p_start = row.get("planned_start")
        p_end = row.get("planned_end")
        
        def to_date(val):
            if pd.isna(val): return None
            if isinstance(val, date): return val
            if isinstance(val, (pd.Timestamp, str)):
                try: return pd.to_datetime(val).date()
                except: return None
            return None

        d_start = to_date(p_start)
        d_end = to_date(p_end)
        
        if d_start and d_end and d_start > d_end:
            errors.append("計画開始日が計画終了日より後になっています")

        # Decimal / Int validation
        effort = row.get("planned_effort")
        if not pd.isna(effort):
            try: effort = Decimal(str(effort))
            except: errors.append("予定工数は数値で入力してください")
        else:
            effort = None

        workload = row.get("workload")
        if not pd.isna(workload):
            try: workload = int(workload)
            except: errors.append("工数比率は数値で入力してください")
        else:
            workload = 100

        ticket_id = row.get("ticket_id")
        if not pd.isna(ticket_id):
            try: ticket_id = int(ticket_id)
            except: 
                # Keep as string for now if it's not a numeric ID? 
                # Let's check models.py: Project/Task/Subtask all have ticket_id as Integer.
                errors.append("チケットIDは数値(ID)で入力してください")
        else:
            ticket_id = None

        if errors:
            can_import = False

        preview_rows.append(schemas.ImportPreviewRow(
            row_index=row_idx,
            level=int(level) if level != -1 else -1,
            name=name,
            status=status_name if status_name != "nan" else None,
            assignee=assignee_name if assignee_name != "nan" else None,
            type=type_name if type_name != "nan" else None,
            ticket_id=str(ticket_id) if ticket_id is not None else None,
            planned_start=d_start,
            planned_end=d_end,
            planned_effort=effort,
            workload=workload,
            memo=str(row.get("memo")) if not pd.isna(row.get("memo")) else None,
            errors=errors
        ))

    return schemas.ImportPreviewResponse(rows=preview_rows, can_import=can_import)

def execute_import(db: Session, rows: List[schemas.ImportPreviewRow]):
    # Fetch master data again for IDs
    db_statuses = {s.status_name: s.id for s in get_statuses(db)}
    db_members = {m.member_name: m.id for m in get_members(db)}
    db_types = {t.type_name: t.id for t in get_subtask_types(db)}

    current_project_id = None
    current_task_id = None

    for r in rows:
        status_id = db_statuses.get(r.status)
        assignee_id = db_members.get(r.assignee)
        
        # Determine auto-calculation flags
        # Requirement: "nothing entered -> auto ON"
        # For Projects/Tasks: IsAutoPlannedDate
        is_auto_planned = (r.planned_start is None or r.planned_end is None)
        
        if r.level == 0:
            # Create Project
            p_data = schemas.ProjectCreate(
                project_name=r.name,
                status_id=status_id,
                assignee_id=assignee_id,
                planned_start_date=r.planned_start,
                planned_end_date=r.planned_end,
                memo=r.memo,
                is_auto_planned_date=is_auto_planned,
                ticket_id=int(r.ticket_id) if r.ticket_id else None
            )
            db_project = create_project(db, p_data)
            current_project_id = db_project.id
            current_task_id = None  # Reset task
            
        elif r.level == 1:
            # Create Task
            t_data = schemas.TaskCreate(
                project_id=current_project_id,
                task_name=r.name,
                status_id=status_id,
                assignee_id=assignee_id,
                planned_start_date=r.planned_start,
                planned_end_date=r.planned_end,
                memo=r.memo,
                is_auto_planned_date=is_auto_planned,
                ticket_id=int(r.ticket_id) if r.ticket_id else None
            )
            db_task = create_task(db, t_data)
            current_task_id = db_task.id
            
        elif r.level == 2:
            # Create Subtask
            # For Subtasks: IsAutoEffort
            # If start, end, OR effort is missing, turn auto ON.
            is_auto_effort = (r.planned_start is None or r.planned_end is None or r.planned_effort is None)
            
            type_id = db_types.get(r.type)
            s_data = schemas.SubtaskCreate(
                task_id=current_task_id,
                subtask_type_id=type_id,
                subtask_detail=r.name,
                status_id=status_id or 1, # Default to first status if not provided (though validated)
                assignee_id=assignee_id,
                planned_start_date=r.planned_start,
                planned_end_date=r.planned_end,
                planned_effort_days=r.planned_effort,
                workload_percent=r.workload or 100,
                memo=r.memo,
                is_auto_effort=is_auto_effort,
                ticket_id=int(r.ticket_id) if r.ticket_id else None
            )
            create_subtask(db, s_data)

    return True
