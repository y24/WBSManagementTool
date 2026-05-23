import hashlib
import json
from datetime import date
from typing import Optional, Union


def normalize_date(value: Optional[Union[date, str]]) -> Optional[str]:
    """Normalize a date value to YYYY-MM-DD string, or None."""
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped[:10] if stripped else None
    return value.isoformat()


def normalize_devops_date(value: Optional[str]) -> Optional[str]:
    """Normalize an Azure DevOps datetime string (ISO 8601 UTC) to YYYY-MM-DD."""
    if not value:
        return None
    return value[:10]


def compute_date_hash(
    planned_start_date: Optional[Union[date, str]],
    planned_end_date: Optional[Union[date, str]],
    actual_start_date: Optional[Union[date, str]],
    actual_end_date: Optional[Union[date, str]],
) -> str:
    """Return SHA-256 hex digest of the four sync date fields."""
    payload = {
        "actual_end_date": normalize_date(actual_end_date),
        "actual_start_date": normalize_date(actual_start_date),
        "planned_end_date": normalize_date(planned_end_date),
        "planned_start_date": normalize_date(planned_start_date),
    }
    json_str = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    return hashlib.sha256(json_str.encode("utf-8")).hexdigest()
