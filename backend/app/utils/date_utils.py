from datetime import date, timedelta
from typing import List

def is_business_day(target_date: date, holidays: List[date]) -> bool:
    """
    Check if a date is a business day (not weekend and not a holiday).
    """
    if target_date.weekday() >= 5:  # 5: Saturday, 6: Sunday
        return False
    return target_date not in holidays

def get_business_days_count(start_date: date, end_date: date, holidays: List[date]) -> float:
    """
    Calculate the number of business days between start_date and end_date (inclusive).
    """
    if not start_date or not end_date:
        return 0.0
    if start_date > end_date:
        return 0.0
    
    count = 0
    curr = start_date
    while curr <= end_date:
        if is_business_day(curr, holidays):
            count += 1
        curr += timedelta(days=1)
    
    return float(count)

def add_business_days(start_date: date, effort_days: float, holidays: List[date]) -> date:
    """
    Add business days to a start date to find the end date.
    effort_days is treated as the number of working days required.
    1.0 means the task starts and ends on the same business day.
    """
    if not start_date or effort_days <= 0:
        return start_date
    
    # We treat effort_days as the inclusive count of business days.
    # So effort=1 means end_date = start_date (if start_date is a biz day).
    
    # First, find the first business day on or after start_date
    curr = start_date
    while not is_business_day(curr, holidays):
        curr += timedelta(days=1)
    
    remaining = effort_days
    # If effort is 1, we stay on this day.
    # If effort is > 1, we need to find subsequent business days.
    while remaining > 1:
        curr += timedelta(days=1)
        if is_business_day(curr, holidays):
            remaining -= 1
            
    return curr
