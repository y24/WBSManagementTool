from app import schemas
from app.routers.api import get_initial_data, set_system_setting


def test_load_rate_threshold_settings_round_trip(db_session):
    setting = set_system_setting(
        "load_rate_critical_low",
        schemas.SystemSettingUpdate(setting_value="25"),
        db_session,
    )
    assert setting.setting_value == "25"

    initial_data = get_initial_data(db_session)
    assert initial_data["load_rate_critical_low"] == "25"


def test_schedule_variance_threshold_settings_round_trip(db_session):
    setting = set_system_setting(
        "schedule_variance_critical",
        schemas.SystemSettingUpdate(setting_value="45"),
        db_session,
    )
    assert setting.setting_value == "45"

    initial_data = get_initial_data(db_session)
    assert initial_data["schedule_variance_critical"] == "45"


def test_schedule_variance_threshold_defaults(db_session):
    initial_data = get_initial_data(db_session)

    assert initial_data["schedule_variance_normal"] == "10"
    assert initial_data["schedule_variance_warning"] == "20"
    assert initial_data["schedule_variance_critical"] == "40"
