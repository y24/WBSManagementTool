import os
import json
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class AzureDevOpsSettings:
    organization: str = ""
    # project は省略可能。空文字の場合は organization レベルの URL を使用する。
    # Work Item ID は organization 単位で一意なため project 指定は不要。
    project: str = ""
    pat: str = ""
    api_version: str = "7.1"
    batch_size: int = 200
    request_timeout_seconds: int = 30
    clear_remote_when_local_null: bool = False
    suppress_notifications: bool = False
    use_mock: bool = True
    sync_status_conditions: Dict[str, List[int]] = field(default_factory=dict)
    field_mapping: Dict[str, str] = field(
        default_factory=lambda: {
            "planned_start_date": "Microsoft.VSTS.Scheduling.StartDate",
            "planned_end_date": "Microsoft.VSTS.Scheduling.TargetDate",
            "actual_start_date": "Custom.ActualStartDate",
            "actual_end_date": "Custom.ActualEndDate",
            "azure_devops_assigned_to": "System.AssignedTo",
            "azure_devops_state": "System.State",
        }
    )


def load_settings() -> AzureDevOpsSettings:
    s = AzureDevOpsSettings(
        organization=os.getenv("AZURE_DEVOPS_ORGANIZATION", ""),
        project=os.getenv("AZURE_DEVOPS_PROJECT", ""),  # 省略可 → org レベル URL
        # AZURE_DEVOPS_PAT は .env に書かず Windows ユーザー環境変数で管理する
        pat=os.getenv("AZURE_DEVOPS_PAT", ""),
        api_version=os.getenv("AZURE_DEVOPS_API_VERSION", "7.1"),
        batch_size=int(os.getenv("AZURE_DEVOPS_BATCH_SIZE", "200")),
        request_timeout_seconds=int(os.getenv("AZURE_DEVOPS_TIMEOUT_SECONDS", "30")),
        clear_remote_when_local_null=os.getenv(
            "AZURE_DEVOPS_CLEAR_REMOTE_WHEN_NULL", "false"
        ).lower()
        == "true",
        suppress_notifications=os.getenv(
            "AZURE_DEVOPS_SUPPRESS_NOTIFICATIONS", "false"
        ).lower()
        == "true",
        use_mock=os.getenv("AZURE_DEVOPS_USE_MOCK", "true").lower() == "true",
    )

    field_mapping_env = os.getenv("AZURE_DEVOPS_FIELD_MAPPING")
    if field_mapping_env:
        try:
            parsed_mapping = json.loads(field_mapping_env)
            if isinstance(parsed_mapping, dict):
                s.field_mapping.update(parsed_mapping)
        except json.JSONDecodeError:
            pass

    status_conditions_env = os.getenv("AZURE_DEVOPS_SYNC_STATUS_CONDITIONS")
    if status_conditions_env:
        try:
            parsed = json.loads(status_conditions_env)
            if isinstance(parsed, dict):
                s.sync_status_conditions = {
                    key: [int(status_id) for status_id in value]
                    for key, value in parsed.items()
                    if isinstance(value, list)
                }
        except (TypeError, ValueError, json.JSONDecodeError):
            pass

    return s


_settings: AzureDevOpsSettings | None = None


def get_settings() -> AzureDevOpsSettings:
    global _settings
    if _settings is None:
        _settings = load_settings()
    return _settings


def reset_settings() -> None:
    """Force reload on next get_settings() call. Useful in tests."""
    global _settings
    _settings = None
