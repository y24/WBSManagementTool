export interface MasterBase {
  id: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MstStatus extends MasterBase {
  status_name: string;
  color_code: string;
  azure_devops_state?: string | null;
  is_system_reserved: boolean;
}

export interface MstSubtaskType extends MasterBase {
  type_name: string;
}

export interface MstMember extends MasterBase {
  member_name: string;
  color_code: string;
  exclude_from_resource_view: boolean;
  azure_devops_unique_name?: string | null;
  azure_devops_display_name?: string | null;
}

export interface AzureDevOpsUser {
  descriptor: string;
  display_name: string;
  unique_name: string;
  mail_address?: string | null;
}

export interface MstHoliday extends MasterBase {
  holiday_date: string;
  holiday_name: string;
}

export interface Marker extends MasterBase {
  marker_date: string;
  name: string;
  note?: string | null;
  color: string;
}

export interface InitialData {
  statuses: MstStatus[];
  subtask_types: MstSubtaskType[];
  members: MstMember[];
  holidays: MstHoliday[];
  ticket_url_template?: string | null;
  status_mapping_new?: string | null;
  status_mapping_blocked?: string | null;
  status_mapping_done?: string | null;
  load_rate_critical_low?: string | null;
  load_rate_warning_low?: string | null;
  load_rate_normal_high?: string | null;
  load_rate_warning_high?: string | null;
  load_rate_overload?: string | null;
  schedule_variance_normal?: string | null;
  schedule_variance_warning?: string | null;
  schedule_variance_critical?: string | null;
  azure_devops_sync_status_conditions?: string | null;
}
