from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal

# --- Masters ---
class SubtaskTypeBase(BaseModel):
    type_name: str
    sort_order: int = 0
    is_active: bool = True

class SubtaskTypeCreate(SubtaskTypeBase):
    pass

class SubtaskTypeUpdate(BaseModel):
    type_name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class SubtaskType(SubtaskTypeBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = { "from_attributes": True }

class StatusBase(BaseModel):
    status_name: str
    color_code: str
    sort_order: int = 0
    is_active: bool = True
    is_system_reserved: bool = False

class StatusCreate(StatusBase):
    pass

class StatusUpdate(BaseModel):
    status_name: Optional[str] = None
    color_code: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    is_system_reserved: Optional[bool] = None

class Status(StatusBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = { "from_attributes": True }

class MemberBase(BaseModel):
    member_name: str
    sort_order: int = 0
    is_active: bool = True

class MemberCreate(MemberBase):
    pass

class MemberUpdate(BaseModel):
    member_name: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class Member(MemberBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = { "from_attributes": True }

# --- Holiday ---
class HolidayBase(BaseModel):
    holiday_date: date
    holiday_name: str
    is_active: bool = True

class HolidayCreate(HolidayBase):
    pass

class HolidayUpdate(BaseModel):
    holiday_date: Optional[date] = None
    holiday_name: Optional[str] = None
    is_active: Optional[bool] = None

class Holiday(HolidayBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = { "from_attributes": True }

# --- Subtasks ---
class SubtaskBase(BaseModel):
    subtask_detail: Optional[str] = None
    progress_percent: Optional[int] = Field(None, ge=0, le=100)
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    review_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    planned_effort_days: Optional[Decimal] = None
    actual_effort_days: Optional[Decimal] = None
    review_days: Optional[Decimal] = None
    ticket_id: Optional[int] = None
    memo: Optional[str] = None
    is_auto_effort: bool = True
    workload_percent: int = 100
    sort_order: int = 0

class SubtaskCreate(SubtaskBase):
    task_id: int
    subtask_type_id: Optional[int] = None
    status_id: int
    assignee_id: Optional[int] = None

class SubtaskUpdate(BaseModel):
    subtask_type_id: Optional[int] = None
    status_id: Optional[int] = None
    assignee_id: Optional[int] = None
    subtask_detail: Optional[str] = None
    progress_percent: Optional[int] = Field(None, ge=0, le=100)
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    review_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    planned_effort_days: Optional[Decimal] = None
    actual_effort_days: Optional[Decimal] = None
    review_days: Optional[Decimal] = None
    ticket_id: Optional[int] = None
    memo: Optional[str] = None
    is_auto_effort: Optional[bool] = None
    workload_percent: Optional[int] = None
    sort_order: Optional[int] = None

class Subtask(SubtaskBase):
    id: int
    task_id: int
    subtask_type_id: Optional[int]
    status_id: int
    assignee_id: Optional[int]
    is_auto_effort: bool
    workload_percent: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime
    model_config = { "from_attributes": True }

# --- Tasks ---
class TaskBase(BaseModel):
    task_name: str
    detail: Optional[str] = None
    ticket_id: Optional[int] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: bool = True
    is_auto_actual_date: bool = True
    sort_order: int = 0
    status_id: Optional[int] = None
    assignee_id: Optional[int] = None

class TaskCreate(TaskBase):
    project_id: int

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    detail: Optional[str] = None
    ticket_id: Optional[int] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: Optional[bool] = None
    is_auto_actual_date: Optional[bool] = None
    sort_order: Optional[int] = None
    status_id: Optional[int] = None
    assignee_id: Optional[int] = None

class Task(TaskBase):
    id: int
    project_id: int
    is_deleted: bool
    status_id: Optional[int]
    assignee_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    subtasks: List[Subtask] = []
    model_config = { "from_attributes": True }

class TaskWBS(Task):
    planned_effort_total: float = 0.0
    actual_effort_total: float = 0.0
    is_overlapping: bool = False

# --- Projects ---
class ProjectBase(BaseModel):
    project_name: str
    detail: Optional[str] = None
    ticket_id: Optional[int] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: bool = True
    is_auto_actual_date: bool = True
    sort_order: int = 0
    status_id: Optional[int] = None
    assignee_id: Optional[int] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    detail: Optional[str] = None
    ticket_id: Optional[int] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: Optional[bool] = None
    is_auto_actual_date: Optional[bool] = None
    sort_order: Optional[int] = None
    status_id: Optional[int] = None
    assignee_id: Optional[int] = None

class Project(ProjectBase):
    id: int
    is_deleted: bool
    status_id: Optional[int]
    assignee_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    tasks: List[Task] = []
    model_config = { "from_attributes": True }

class ProjectWBS(Project):
    tasks: List[TaskWBS] = []
    planned_effort_total: float = 0.0
    actual_effort_total: float = 0.0
    is_overlapping: bool = False

# --- Response Models ---
class ReorderRequest(BaseModel):
    ordered_ids: List[int]

class SubtaskMoveRequest(BaseModel):
    to_task_id: int
    to_sort_order: int

class GanttRange(BaseModel):
    start_date: Optional[date]
    end_date: Optional[date]
    today: date

class WBSResponse(BaseModel):
    filters: dict
    gantt_range: GanttRange
    projects: List[ProjectWBS]

# --- System Settings ---
class SystemSettingUpdate(BaseModel):
    setting_value: str

class SystemSetting(BaseModel):
    setting_key: str
    setting_value: str
    description: Optional[str] = None
    model_config = { "from_attributes": True }

class InitialData(BaseModel):
    statuses: List[Status]
    subtask_types: List[SubtaskType]
    members: List[Member]
    holidays: List[Holiday]
    ticket_url_template: Optional[str] = None
    status_mapping_new: Optional[str] = None
    status_mapping_blocked: Optional[str] = None
    status_mapping_done: Optional[str] = None

# --- Import ---
class ImportPreviewRow(BaseModel):
    row_index: int
    level: int  # 0: Project, 1: Task, 2: Subtask
    name: str   # project_name, task_name, or subtask_detail
    status: Optional[str] = None
    assignee: Optional[str] = None
    type: Optional[str] = None
    ticket_id: Optional[str] = None
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    planned_effort: Optional[Decimal] = None
    workload: Optional[int] = None
    memo: Optional[str] = None
    errors: List[str] = []

class ImportPreviewResponse(BaseModel):
    rows: List[ImportPreviewRow]
    can_import: bool

class ImportExecuteRequest(BaseModel):
    rows: List[ImportPreviewRow]
