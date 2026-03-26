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
  is_system_reserved: boolean;
}

export interface MstSubtaskType extends MasterBase {
  type_name: string;
}

export interface MstMember extends MasterBase {
  member_name: string;
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
  markers: Marker[];
  ticket_url_template?: string | null;
  status_mapping_new?: string | null;
  status_mapping_blocked?: string | null;
  status_mapping_done?: string | null;
}
