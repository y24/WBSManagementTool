from pydantic import BaseModel, Field
from typing import List, Optional, Union
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
    progress_percent: Optional[int] = Field(0, ge=0, le=100)
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    review_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    planned_effort_days: Optional[Union[Decimal, float, int]] = None
    actual_effort_days: Optional[Union[Decimal, float, int]] = None
    work_days: Optional[Union[Decimal, float, int]] = None
    review_days: Optional[Union[Decimal, float, int]] = None
    ticket_id: Optional[int] = None
    link_url: Optional[str] = None
    memo: Optional[str] = None
    is_auto_effort: bool = True
    workload_percent: int = 100
    sort_order: int = 0

class SubtaskCreate(SubtaskBase):
    task_id: int
    subtask_type_id: Optional[int] = None
    status_id: int = 1
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
    planned_effort_days: Optional[Union[Decimal, float, int]] = None
    actual_effort_days: Optional[Union[Decimal, float, int]] = None
    work_days: Optional[Union[Decimal, float, int]] = None
    review_days: Optional[Union[Decimal, float, int]] = None
    ticket_id: Optional[int] = None
    link_url: Optional[str] = None
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
    link_url: Optional[str] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: bool = True
    is_auto_actual_date: bool = True
    work_days: Optional[Union[Decimal, float, int]] = None
    sort_order: int = 0
    status_id: Optional[int] = 1
    assignee_id: Optional[int] = None

class TaskCreate(TaskBase):
    project_id: int

class TaskUpdate(BaseModel):
    task_name: Optional[str] = None
    detail: Optional[str] = None
    ticket_id: Optional[int] = None
    link_url: Optional[str] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: Optional[bool] = None
    is_auto_actual_date: Optional[bool] = None
    work_days: Optional[Union[Decimal, float, int]] = None
    sort_order: Optional[int] = None
    status_id: Optional[int] = None
    assignee_id: Optional[int] = None

class Task(TaskBase):
    id: int
    project_id: int
    work_days: Optional[Union[Decimal, float, int]]
    is_deleted: bool
    status_id: Optional[int]
    assignee_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    subtasks: List[Subtask] = []
    model_config = { "from_attributes": True }

class TaskWBS(Task):
    planned_effort_total: Union[Decimal, float, int] = Decimal('0.0')
    actual_effort_total: Union[Decimal, float, int] = Decimal('0.0')
    progress_percent: Optional[int] = 0
    work_days_total: Union[Decimal, float, int] = Decimal('0.0')
    is_overlapping: bool = False

# --- Projects ---
class ProjectBase(BaseModel):
    project_name: str
    detail: Optional[str] = None
    ticket_id: Optional[int] = None
    link_url: Optional[str] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: bool = True
    is_auto_actual_date: bool = True
    work_days: Optional[Union[Decimal, float, int]] = None
    sort_order: int = 0
    status_id: Optional[int] = 1
    assignee_id: Optional[int] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    detail: Optional[str] = None
    ticket_id: Optional[int] = None
    link_url: Optional[str] = None
    memo: Optional[str] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    is_auto_planned_date: Optional[bool] = None
    is_auto_actual_date: Optional[bool] = None
    work_days: Optional[Union[Decimal, float, int]] = None
    sort_order: Optional[int] = None
    status_id: Optional[int] = None
    assignee_id: Optional[int] = None

class Project(ProjectBase):
    id: int
    work_days: Optional[Union[Decimal, float, int]]
    is_deleted: bool
    status_id: Optional[int]
    assignee_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    tasks: List[Task] = []
    model_config = { "from_attributes": True }

class ProjectWBS(Project):
    tasks: List[TaskWBS] = []
    planned_effort_total: Union[Decimal, float, int] = Decimal('0.0')
    actual_effort_total: Union[Decimal, float, int] = Decimal('0.0')
    progress_percent: Optional[int] = 0
    work_days_total: Union[Decimal, float, int] = Decimal('0.0')
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

# --- Markers ---
class MarkerBase(BaseModel):
    marker_date: date
    name: str
    note: Optional[str] = None
    color: str = "#ef4444"

class MarkerCreate(MarkerBase):
    pass

class MarkerUpdate(BaseModel):
    marker_date: Optional[date] = None
    name: Optional[str] = None
    note: Optional[str] = None
    color: Optional[str] = None

class Marker(MarkerBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = { "from_attributes": True }

class InitialData(BaseModel):
    statuses: List[Status]
    subtask_types: List[SubtaskType]
    members: List[Member]
    holidays: List[Holiday]
    markers: List[Marker] = []
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
    link_url: Optional[str] = None
    planned_start: Optional[date] = None
    planned_end: Optional[date] = None
    planned_effort: Optional[Union[Decimal, float, int]] = None
    work_days: Optional[Union[Decimal, float, int]] = None
    review_days: Optional[Union[Decimal, float, int]] = None
    workload: Optional[int] = None
    memo: Optional[str] = None
    errors: List[str] = []

class ImportPreviewResponse(BaseModel):
    rows: List[ImportPreviewRow]
    can_import: bool

class ImportExecuteRequest(BaseModel):
    rows: List[ImportPreviewRow]

class DuplicateRequest(BaseModel):
    project_ids: List[int] = []
    task_ids: List[int] = []
    subtask_ids: List[int] = []

class ClearActualsRequest(BaseModel):
    project_ids: List[int] = []
    task_ids: List[int] = []
    subtask_ids: List[int] = []

class ShiftDatesRequest(BaseModel):
    project_ids: List[int] = []
    task_ids: List[int] = []
    subtask_ids: List[int] = []
    new_base_date: date

# --- Dashboard ---

class DashboardKPIs(BaseModel):
    ongoing_projects_count: int
    start_delay_count: int
    overdue_subtasks_count: int
    review_delay_count: int
    this_week_end_count: int

class ProjectProgressData(BaseModel):
    project_name: str
    progress_percent: int

class AssigneeDelayData(BaseModel):
    member_name: str
    delay_count: int

class StatusCountData(BaseModel):
    status_name: str
    count: int
    color_code: str

class SubtaskSummary(BaseModel):
    id: int
    task_name: str
    subtask_detail: str
    planned_end_date: Optional[date]
    progress_percent: int = 0
    assignee_name: Optional[str] = None

class ReviewDelaySubtask(SubtaskSummary):
    review_days: float = 0
    review_start_date: Optional[date] = None
    delay_days: float = 0

class AssigneeSummary(BaseModel):
    member_name: str
    total_count: int
    this_week_end_count: int
    overdue_count: int
    concurrent_count: int

class ProjectEffortData(BaseModel):
    project_name: str
    planned_effort: float
    actual_effort: float

class TaskDeviationData(BaseModel):
    task_name: str
    project_name: str
    planned_effort: float
    actual_effort: float
    deviation_rate: float

class AssigneeEstimateErrorData(BaseModel):
    member_name: str
    avg_deviation_rate: float
    task_count: int

class EstimateAccuracyTrendData(BaseModel):
    period: str
    avg_deviation_rate: float
    task_count: int

class DashboardData(BaseModel):
    kpis: DashboardKPIs
    project_progress: List[ProjectProgressData]
    assignee_delays: List[AssigneeDelayData]
    status_counts: List[StatusCountData]
    review_delays: List[ReviewDelaySubtask]
    low_progress_soon_to_finish: List[SubtaskSummary]
    assignee_summary: List[AssigneeSummary]
    project_effort: List[ProjectEffortData] = []
    task_deviations: List[TaskDeviationData] = []
    assignee_estimate_errors: List[AssigneeEstimateErrorData] = []
    estimate_accuracy_trend: List[EstimateAccuracyTrendData] = []

# --- Shared Filters ---
class SharedFilterCreate(BaseModel):
    filter_data: dict

class SharedFilterResponse(BaseModel):
    token: str
    filter_data: dict
    model_config = { "from_attributes": True }



