from app import schemas
from app.routers.api import get_initial_data, set_system_setting, update_member


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


def test_devops_sync_status_conditions_default_actual_end_done(db_session):
    initial_data = get_initial_data(db_session)

    assert initial_data["azure_devops_sync_status_conditions"] == '{"actual_end_date": [4]}'


def test_devops_sync_status_conditions_round_trip(db_session):
    setting = set_system_setting(
        "azure_devops_sync_status_conditions",
        schemas.SystemSettingUpdate(setting_value='{"actual_end_date":[4]}'),
        db_session,
    )
    assert setting.setting_value == '{"actual_end_date":[4]}'

    initial_data = get_initial_data(db_session)
    assert initial_data["azure_devops_sync_status_conditions"] == '{"actual_end_date":[4]}'


def test_member_color_round_trip_in_initial_data(db_session):
    member = update_member(
        1,
        schemas.MemberUpdate(color_code="#64748b"),
        db_session,
    )
    assert member.color_code == "#64748b"

    initial_data = get_initial_data(db_session)
    assert initial_data["members"][0].color_code == "#64748b"
