from sqlalchemy.orm import Session
from datetime import date
from .. import models, schemas

# --- Masters ---
def get_statuses(db: Session, include_inactive: bool = False):
    query = db.query(models.MstStatus)
    if not include_inactive:
        query = query.filter(models.MstStatus.is_active == True)
    return query.order_by(models.MstStatus.sort_order, models.MstStatus.id).all()

def get_subtask_types(db: Session, include_inactive: bool = False):
    query = db.query(models.MstSubtaskType)
    if not include_inactive:
        query = query.filter(models.MstSubtaskType.is_active == True)
    return query.order_by(models.MstSubtaskType.sort_order, models.MstSubtaskType.id).all()

def get_members(db: Session, include_inactive: bool = False):
    query = db.query(models.MstMember)
    if not include_inactive:
        query = query.filter(models.MstMember.is_active == True)
    return query.order_by(models.MstMember.sort_order, models.MstMember.id).all()

def get_holidays(db: Session, include_inactive: bool = False):
    query = db.query(models.MstHoliday)
    if not include_inactive:
        query = query.filter(models.MstHoliday.is_active == True)
    return query.order_by(models.MstHoliday.holiday_date).all()

# --- Master CRUD ---
def create_status(db: Session, status: schemas.StatusCreate):
    db_status = models.MstStatus(**status.dict())
    db.add(db_status)
    db.commit()
    db.refresh(db_status)
    return db_status

def update_status(db: Session, status_id: int, status: schemas.StatusUpdate):
    db_status = db.query(models.MstStatus).filter(models.MstStatus.id == status_id).first()
    if not db_status:
        return None
    
    update_data = status.dict(exclude_unset=True)
    # Prevent changing status_name if it is system reserved
    if db_status.is_system_reserved and "status_name" in update_data:
        del update_data["status_name"]
        
    for key, value in update_data.items():
        setattr(db_status, key, value)
    db.commit()
    db.refresh(db_status)
    return db_status

def delete_status(db: Session, status_id: int):
    db_status = db.query(models.MstStatus).filter(models.MstStatus.id == status_id).first()
    if db_status:
        if db_status.is_system_reserved:
            return None # Cannot delete system reserved status
        db_status.is_active = False
        db.commit()
        db.refresh(db_status)
    return db_status

def create_subtask_type(db: Session, subtask_type: schemas.SubtaskTypeCreate):
    db_type = models.MstSubtaskType(**subtask_type.dict())
    db.add(db_type)
    db.commit()
    db.refresh(db_type)
    return db_type

def update_subtask_type(db: Session, type_id: int, subtask_type: schemas.SubtaskTypeUpdate):
    db_type = db.query(models.MstSubtaskType).filter(models.MstSubtaskType.id == type_id).first()
    if not db_type:
        return None
    for key, value in subtask_type.dict(exclude_unset=True).items():
        setattr(db_type, key, value)
    db.commit()
    db.refresh(db_type)
    return db_type

def delete_subtask_type(db: Session, type_id: int):
    db_type = db.query(models.MstSubtaskType).filter(models.MstSubtaskType.id == type_id).first()
    if db_type:
        db_type.is_active = False
        db.commit()
        db.refresh(db_type)
    return db_type

def create_member(db: Session, member: schemas.MemberCreate):
    db_member = models.MstMember(**member.dict())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def update_member(db: Session, member_id: int, member: schemas.MemberUpdate):
    db_member = db.query(models.MstMember).filter(models.MstMember.id == member_id).first()
    if not db_member:
        return None
    for key, value in member.dict(exclude_unset=True).items():
        setattr(db_member, key, value)
    db.commit()
    db.refresh(db_member)
    return db_member

def delete_member(db: Session, member_id: int):
    db_member = db.query(models.MstMember).filter(models.MstMember.id == member_id).first()
    if db_member:
        db_member.is_active = False
        db.commit()
        db.refresh(db_member)
    return db_member

def create_holiday(db: Session, holiday: schemas.HolidayCreate):
    db_holiday = models.MstHoliday(**holiday.dict())
    db.add(db_holiday)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday

def update_holiday(db: Session, holiday_id: int, holiday: schemas.HolidayUpdate):
    db_holiday = db.query(models.MstHoliday).filter(models.MstHoliday.id == holiday_id).first()
    if not db_holiday:
        return None
    for key, value in holiday.dict(exclude_unset=True).items():
        setattr(db_holiday, key, value)
    db.commit()
    db.refresh(db_holiday)
    return db_holiday

def delete_holiday(db: Session, holiday_id: int):
    db_holiday = db.query(models.MstHoliday).filter(models.MstHoliday.id == holiday_id).first()
    if db_holiday:
        db_holiday.is_active = False
        db.commit()
        db.refresh(db_holiday)
    return db_holiday

def sync_holidays(db: Session, holiday_data: list[dict]):
    """
    Sync holidays from a list of dicts: {"date": "YYYY-MM-DD", "name": "Name"}
    Upsert logic: update if date exists, otherwise create.
    """
    updated_count: int = 0
    added_count: int = 0
    
    for item in holiday_data:
        h_date_str = item["date"]
        h_name = item["name"]
        h_date = date.fromisoformat(h_date_str)
        
        # Check if already exists
        db_holiday = db.query(models.MstHoliday).filter(models.MstHoliday.holiday_date == h_date).first()
        
        if db_holiday:
            db_holiday.holiday_name = h_name
            db_holiday.is_active = True # Re-activate if it was inactive
            updated_count += 1
        else:
            new_holiday = models.MstHoliday(
                holiday_date=h_date,
                holiday_name=h_name,
                is_active=True
            )
            db.add(new_holiday)
            added_count += 1
            
    db.commit()
    return {"updated": updated_count, "added": added_count}

def reorder_statuses(db: Session, ordered_ids: list[int]):
    for i, item_id in enumerate(ordered_ids):
        db.query(models.MstStatus).filter(models.MstStatus.id == item_id).update({"sort_order": i})
    db.commit()

def reorder_subtask_types(db: Session, ordered_ids: list[int]):
    for i, item_id in enumerate(ordered_ids):
        db.query(models.MstSubtaskType).filter(models.MstSubtaskType.id == item_id).update({"sort_order": i})
    db.commit()

def reorder_members(db: Session, ordered_ids: list[int]):
    for i, item_id in enumerate(ordered_ids):
        db.query(models.MstMember).filter(models.MstMember.id == item_id).update({"sort_order": i})
    db.commit()
