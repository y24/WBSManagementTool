from sqlalchemy.orm import Session
from datetime import date
from .. import models

# --- System Settings Constants ---
SETTING_TICKET_URL = "ticket_url_template"
SETTING_STATUS_NEW = "status_mapping_new"
SETTING_STATUS_BLOCKED = "status_mapping_blocked"
SETTING_STATUS_DONE = "status_mapping_done"

def get_system_setting(db: Session, key: str):
    return db.query(models.SystemSetting).filter(models.SystemSetting.setting_key == key).first()

def set_system_setting(db: Session, key: str, value: str, description: str = None):
    db_setting = db.query(models.SystemSetting).filter(models.SystemSetting.setting_key == key).first()
    if db_setting:
        db_setting.setting_value = value
    else:
        db_setting = models.SystemSetting(setting_key=key, setting_value=value, description=description)
        db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

def get_status_ids_by_category(db: Session, category: str) -> list[int]:
    key = {
        "new": SETTING_STATUS_NEW,
        "blocked": SETTING_STATUS_BLOCKED,
        "done": SETTING_STATUS_DONE
    }.get(category)
    if not key: return []
    
    setting = get_system_setting(db, key)
    if setting and setting.setting_value:
        try:
            return [int(sid.strip()) for sid in setting.setting_value.split(",") if sid.strip().isdigit()]
        except ValueError:
            pass
            
    # Defaults based on seed.py: 1:New, 4:Done, 5:Blocked, 7:Removed
    if category == "new": return [1, 7]
    if category == "blocked": return [5]
    if category == "done": return [4, 7]
    return []

def check_overlap(periods: list[tuple[date, date]]) -> bool:
    """
    Simple utility to check if any date periods overlap.
    """
    sorted_periods = sorted([p for p in periods if p[0] and p[1]], key=lambda x: x[0])
    for i in range(len(sorted_periods) - 1):
        if sorted_periods[i][1] > sorted_periods[i+1][0]:
            return True
    return False
