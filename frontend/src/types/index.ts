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

export interface InitialData {
  statuses: MstStatus[];
  subtask_types: MstSubtaskType[];
  members: MstMember[];
  holidays: MstHoliday[];
  ticket_url_template?: string | null;
}
