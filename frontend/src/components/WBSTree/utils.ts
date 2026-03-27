import { InitialData } from '../../types';
import { format, subDays, isWeekend } from 'date-fns';

export const getStatus = (id: number, initialData: InitialData | null) => 
  initialData?.statuses.find(s => s.id === id);

export const isBusinessDay = (date: Date, holidays: string[]) => {
  if (isWeekend(date)) return false;
  const dateStr = format(date, 'yyyy-MM-dd');
  return !holidays.includes(dateStr);
};

export const subtractBusinessDays = (date: Date, days: number, holidays: string[]) => {
  let current = new Date(date);
  current.setHours(0, 0, 0, 0);
  if (days <= 0) return current;

  let businessDaysFound = 0;
  if (isBusinessDay(current, holidays)) {
    businessDaysFound = 1;
  }

  while (businessDaysFound < days) {
    current = subDays(current, 1);
    if (isBusinessDay(current, holidays)) {
      businessDaysFound++;
    }
  }
  return current;
};

export const getBusinessDaysCount = (startDate: Date, endDate: Date, holidays: string[]) => {
  if (startDate > endDate) return 0;
  let count = 0;
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (isBusinessDay(current, holidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

export const addBusinessDays = (startDate: Date, days: number, holidays: string[]) => {
  if (days <= 0) return startDate;
  let current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  
  // Find first business day
  while (!isBusinessDay(current, holidays)) {
    current.setDate(current.getDate() + 1);
  }

  let remaining = days;
  while (remaining > 1) {
    current.setDate(current.getDate() + 1);
    if (isBusinessDay(current, holidays)) {
      remaining--;
    }
  }
  return current;
};

export const calculateReviewCalendarDays = (endDate: Date, reviewDays: number, holidays: string[]) => {
  let remaining = reviewDays;
  let current = new Date(endDate);
  current.setHours(0, 0, 0, 0);
  
  let calendarDays = 0;
  
  while (remaining > 0) {
    const isBiz = isBusinessDay(current, holidays);
    if (isBiz) {
      const take = Math.min(remaining, 1);
      remaining -= take;
      calendarDays += take;
    } else {
      calendarDays += 1;
    }

    if (remaining > 0) {
      current = subDays(current, 1);
      if (!isBiz) {
        // 非営業日を遡った場合は、すでに calendarDays に 1 足しているので何もしない
      } else if (remaining > 0) {
        // 営業日を遡り、まだ残りがある場合は、非営業日チェックへ進む前に
        // calendarDays には影響しない（次のループのtakeか、非営業日カウントで足される）
      }
    }
  }
  
  return calendarDays;
};

export const getWarning = (item: any, initialData?: InitialData | null, isSubtask = false) => {
  const warnings = [];
  if (item.planned_start_date && item.planned_end_date && item.planned_start_date > item.planned_end_date) {
    warnings.push("計画期間の開始日が終了日より後になっています。");
  }
  if (item.actual_start_date && item.actual_end_date && item.actual_start_date > item.actual_end_date) {
    warnings.push("実績期間の開始日が終了日より後になっています。");
  }

  // 遅延判定
  if (initialData && item.status_id) {
    const status = initialData.statuses.find(s => s.id === item.status_id);
    if (status && status.status_name !== 'Done' && status.status_name !== 'Removed') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 開始遅延判定 (サブタスクかつステータスがNewで、開始予定日を過ぎている場合)
      if (isSubtask && status.status_name === 'New' && item.planned_start_date) {
        const plannedStart = new Date(item.planned_start_date);
        if (today > plannedStart) {
          warnings.push("開始予定日を過ぎていますが開始されていません。");
        }
      }

      // 完了遅延判定
      if (item.planned_end_date) {
        const plannedEnd = new Date(item.planned_end_date);
        if (today > plannedEnd) {
          warnings.push("完了予定日を過ぎていますが未完了です。");
        } else if (item.review_days && item.review_days > 0) {
          if (status.status_name !== 'In Review') {
            const holidays = initialData.holidays.map(h => h.holiday_date);
            const reviewStartDeadline = subtractBusinessDays(plannedEnd, Math.ceil(item.review_days), holidays);
            if (today >= reviewStartDeadline) {
              warnings.push("レビュー開始期限を過ぎていますがレビュー中になっていません。");
            }
          }
        }
      }
    }
  }

  return warnings.length > 0 ? warnings.join("\n") : null;
};

export const formatDateForInput = (d: string) => {
  if (!d) return '';
  return d.replace(/-/g, '/');
};

export const parseDateFromInput = (s: string) => {
  if (!s) return null;

  // 区切り文字（/ , - , .）で分割を試みる
  const parts = s.split(/[\/\-\.]/);

  if (parts.length === 3) {
    // YYYY/MM/DD, YY/M/D などの形式
    let [y, m, d] = parts;
    
    // 年の補完 (例: 26 -> 2026)
    if (y.length === 2 && /^\d+$/.test(y)) {
      y = "20" + y;
    }
    
    const year = y.padStart(4, '0');
    const month = m.padStart(2, '0');
    const day = d.padStart(2, '0');
    
    // 数字4桁-2桁-2桁であることを確認
    if (/^\d{4}$/.test(year) && /^\d{2}$/.test(month) && /^\d{2}$/.test(day)) {
      return `${year}-${month}-${day}`;
    }
  } else if (parts.length === 2) {
    // MM/DD 形式 (今の年を補完)
    let [m, d] = parts;
    const year = new Date().getFullYear().toString();
    const month = m.padStart(2, '0');
    const day = d.padStart(2, '0');
    
    if (/^\d{2}$/.test(month) && /^\d{2}$/.test(day)) {
      return `${year}-${month}-${day}`;
    }
  }

  // 区切り文字がない場合かつ数字のみの場合
  let cleaned = s.replace(/\D/g, '');
  
  // 8桁 (YYYYMMDD)
  if (cleaned.length === 8) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  // 4桁 (MMDD) -> 今の年を補完
  if (cleaned.length === 4 && !s.includes('/') && !s.includes('-') && !s.includes('.')) {
    const year = new Date().getFullYear().toString();
    const month = cleaned.slice(0, 2);
    const day = cleaned.slice(2, 4);
    return `${year}-${month}-${day}`;
  }

  // すでに YYYY-MM-DD 形式ならそのまま
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return null;
};

export const formatDisplayDate = (dateStr: string, type: string) => {
  if (!dateStr || type !== 'date') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    // M/d 形式で表示 (スペース節約のため、0を削る)
    const month = parseInt(parts[1], 10).toString();
    const day = parseInt(parts[2], 10).toString();
    return `${month}/${day}`;
  }
  return dateStr;
};

export const getDisabledStatusIds = (type: 'project' | 'task' | 'subtask', item: any, initialData: InitialData | null): number[] => {
  if (!initialData || type === 'subtask') return [];

  const children = type === 'project' ? item.tasks : item.subtasks;
  if (!children || (children as any[]).length === 0) return [];

  const parseMapping = (m: string | null | undefined, defaultVal: number[]) => 
    m ? m.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : defaultVal;

  const newIds = parseMapping(initialData.status_mapping_new, [1, 7]);
  const doneIds = parseMapping(initialData.status_mapping_done, [4, 7]);
  const blockedIds = parseMapping(initialData.status_mapping_blocked, [5]);

  const childStatusIds = (children as any[]).map(c => c.status_id).filter(sid => sid != null);
  if (childStatusIds.length === 0) return [];

  const allNew = childStatusIds.every(sid => newIds.includes(sid));
  const allDone = childStatusIds.every(sid => doneIds.includes(sid));
  const anyBlocked = type === 'task' && childStatusIds.some(sid => blockedIds.includes(sid));

  const disabled = new Set<number>();
  
  if (allNew) {
    initialData.statuses.forEach(s => {
      if (!newIds.includes(s.id)) disabled.add(s.id);
    });
  } else if (allDone) {
    initialData.statuses.forEach(s => {
      if (!doneIds.includes(s.id)) disabled.add(s.id);
    });
  } else if (anyBlocked) {
    initialData.statuses.forEach(s => {
      if (!blockedIds.includes(s.id)) disabled.add(s.id);
    });
  } else {
    initialData.statuses.forEach(s => {
      if (newIds.includes(s.id) || doneIds.includes(s.id)) disabled.add(s.id);
      if (type === 'task' && blockedIds.includes(s.id)) disabled.add(s.id);
    });
  }

  const result = Array.from(disabled);
  const removedStatus = initialData.statuses.find(s => s.status_name === 'Removed');
  if (removedStatus) {
    return result.filter(id => id !== removedStatus.id);
  }

  return result;
};
export const shouldHighlightField = (
  type: 'project' | 'task' | 'subtask',
  field: string,
  value: any,
  item: any,
  initialData: InitialData | null
) => {
  const statusId = item?.status_id;
  if (!statusId || !initialData) return false;
  const status = initialData.statuses.find(s => s.id === statusId);
  if (!status) return false;

  // 自動入力（Auto）設定時はハイライト不要
  if (item?.is_auto_planned_date && (field === 'planned_start_date' || field === 'planned_end_date')) return false;
  if (item?.is_auto_actual_date && (field === 'actual_start_date' || field === 'actual_end_date')) return false;
  if (item?.is_auto_effort && (field === 'planned_effort_days' || field === 'actual_effort_days' || field === 'planned_end_date')) return false;

  const isUnset = (v: any) => v === null || v === undefined || v === '';

  // New status requirements
  const isNewRequirement = (field: string) => {
    if (field === 'assignee_id') return true;
    if (type === 'subtask') {
      return ['subtask_type_id', 'planned_start_date', 'planned_end_date'].includes(field);
    }
    return false;
  };

  // In Progress status requirements
  const isInProgressRequirement = (field: string) => {
    return field === 'actual_start_date';
  };

  // Done status requirements
  const isDoneRequirement = (field: string) => {
    return ['actual_end_date', 'planned_effort_days', 'actual_effort_days'].includes(field);
  };

  if (status.status_name === 'New') {
    if (isNewRequirement(field) && isUnset(value)) return true;
  } else if (status.status_name === 'In Progress') {
    if ((isNewRequirement(field) || isInProgressRequirement(field)) && isUnset(value)) return true;
  } else if (status.status_name === 'Done') {
    if ((isNewRequirement(field) || isInProgressRequirement(field) || isDoneRequirement(field)) && isUnset(value)) return true;
  } else if (status.status_name === 'In Review') {
    if ((isNewRequirement(field) || isInProgressRequirement(field)) && isUnset(value)) return true;
  }

  return false;
};
