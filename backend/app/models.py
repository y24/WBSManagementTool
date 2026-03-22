from sqlalchemy import Column, Integer, String, Boolean, Date, Numeric, Text, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from .database import Base

# --- Master Tables ---

class MstSubtaskType(Base):
    __tablename__ = "mst_subtask_types"

    id = Column(Integer, primary_key=True, index=True)
    type_name = Column(String(100), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("type_name <> ''", name="check_type_name_empty"),
        CheckConstraint("sort_order >= 0", name="check_type_name_sort"),
    )

class MstStatus(Base):
    __tablename__ = "mst_statuses"

    id = Column(Integer, primary_key=True, index=True)
    status_name = Column(String(50), nullable=False)
    color_code = Column(String(20), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("status_name <> ''", name="check_status_name_empty"),
        CheckConstraint("sort_order >= 0", name="check_status_sort"),
    )

class MstMember(Base):
    __tablename__ = "mst_members"

    id = Column(Integer, primary_key=True, index=True)
    member_name = Column(String(100), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("member_name <> ''", name="check_member_name_empty"),
        CheckConstraint("sort_order >= 0", name="check_member_sort"),
    )

class MstHoliday(Base):
    __tablename__ = "mst_holidays"

    id = Column(Integer, primary_key=True, index=True)
    holiday_date = Column(Date, nullable=False, unique=True, index=True)
    holiday_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("holiday_name <> ''", name="check_holiday_name_empty"),
    )

class SystemSetting(Base):
    __tablename__ = "system_settings"

    setting_key = Column(String(100), primary_key=True)
    setting_value = Column(Text, nullable=False)
    description = Column(String(300))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


# --- Business Tables ---

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(200), nullable=False)
    planned_start_date = Column(Date, nullable=True)
    planned_end_date = Column(Date, nullable=True)
    actual_start_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)
    is_auto_planned_date = Column(Boolean, nullable=False, default=False)
    is_auto_actual_date = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    tasks = relationship("Task", back_populates="project", order_by="Task.sort_order, Task.id")

    __table_args__ = (
        CheckConstraint("project_name <> ''", name="check_project_name_empty"),
        CheckConstraint("sort_order >= 0", name="check_project_sort"),
        CheckConstraint("planned_start_date IS NULL OR planned_end_date IS NULL OR planned_end_date >= planned_start_date", name="check_project_planned_dates"),
        CheckConstraint("actual_start_date IS NULL OR actual_end_date IS NULL OR actual_end_date >= actual_start_date", name="check_project_actual_dates"),
    )

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    task_name = Column(String(200), nullable=False)
    planned_start_date = Column(Date, nullable=True)
    planned_end_date = Column(Date, nullable=True)
    actual_start_date = Column(Date, nullable=True)
    actual_end_date = Column(Date, nullable=True)
    is_auto_planned_date = Column(Boolean, nullable=False, default=False)
    is_auto_actual_date = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    is_deleted = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    project = relationship("Project", back_populates="tasks")
    subtasks = relationship("Subtask", back_populates="task", order_by="Subtask.sort_order, Subtask.id")

    __table_args__ = (
        CheckConstraint("task_name <> ''", name="check_task_name_empty"),
        CheckConstraint("sort_order >= 0", name="check_task_sort"),
        CheckConstraint("planned_start_date IS NULL OR planned_end_date IS NULL OR planned_end_date >= planned_start_date", name="check_task_planned_dates"),
        CheckConstraint("actual_start_date IS NULL OR actual_end_date IS NULL OR actual_end_date >= actual_start_date", name="check_task_actual_dates"),
    )

class Subtask(Base):
    __tablename__ = "subtasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, index=True)
    subtask_type_id = Column(Integer, ForeignKey("mst_subtask_types.id"), nullable=False)
    subtask_detail = Column(String(300), nullable=True)
    status_id = Column(Integer, ForeignKey("mst_statuses.id"), nullable=False, index=True)
    progress_percent = Column(Integer, nullable=True)
    assignee_id = Column(Integer, ForeignKey("mst_members.id"), nullable=True, index=True)
    
    planned_start_date = Column(Date, nullable=True, index=True)
    planned_end_date = Column(Date, nullable=True, index=True)
    actual_start_date = Column(Date, nullable=True, index=True)
    actual_end_date = Column(Date, nullable=True, index=True)
    
    planned_effort_days = Column(Numeric(8, 2), nullable=True)
    actual_effort_days = Column(Numeric(8, 2), nullable=True)
    review_days = Column(Numeric(8, 2), nullable=True)
    
    ticket_id = Column(Integer, nullable=True)
    memo = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_deleted = Column(Boolean, nullable=False, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    task = relationship("Task", back_populates="subtasks")
    subtask_type = relationship("MstSubtaskType")
    status = relationship("MstStatus")
    assignee = relationship("MstMember")

    __table_args__ = (
        CheckConstraint("progress_percent IS NULL OR (progress_percent BETWEEN 0 AND 100)", name="check_subtask_progress"),
        CheckConstraint("planned_effort_days IS NULL OR planned_effort_days >= 0", name="check_subtask_planned_effort"),
        CheckConstraint("actual_effort_days IS NULL OR actual_effort_days >= 0", name="check_subtask_actual_effort"),
        CheckConstraint("review_days IS NULL OR review_days >= 0", name="check_subtask_review_days"),
        CheckConstraint("ticket_id IS NULL OR ticket_id >= 0", name="check_subtask_ticket_id"),
        CheckConstraint("sort_order >= 0", name="check_subtask_sort"),
        CheckConstraint("planned_start_date IS NULL OR planned_end_date IS NULL OR planned_end_date >= planned_start_date", name="check_subtask_planned_dates"),
        CheckConstraint("actual_start_date IS NULL OR actual_end_date IS NULL OR actual_end_date >= actual_start_date", name="check_subtask_actual_dates"),
    )
