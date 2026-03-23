import { InitialData } from '../../types';

export const getStatus = (id: number, initialData: InitialData | null) => 
  initialData?.statuses.find(s => s.id === id);

export const getWarning = (item: any, initialData?: InitialData | null) => {
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
    if (status && status.status_name !== 'Done' && status.status_name !== 'Removed' && item.planned_end_date) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const plannedEnd = new Date(item.planned_end_date);
      
      if (today > plannedEnd) {
        warnings.push("完了予定日を過ぎていますが未完了です。");
      } else if (item.review_days && item.review_days > 0) {
        if (status.status_name !== 'In Review') {
          const reviewStartDeadline = new Date(plannedEnd);
          reviewStartDeadline.setDate(reviewStartDeadline.getDate() - Math.ceil(item.review_days));
          if (today >= reviewStartDeadline) {
            warnings.push("レビュー開始期限を過ぎていますがレビュー中になっていません。");
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
  let cleaned = s.replace(/[\/\-\.]/g, '');
  if (cleaned.length === 8) {
    const year = cleaned.slice(0, 4);
    const month = cleaned.slice(4, 6);
    const day = cleaned.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, '-');
  return null;
};

export const formatDisplayDate = (dateStr: string, type: string) => {
  if (!dateStr || type !== 'date') return dateStr;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
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

  return Array.from(disabled);
};
export const shouldHighlightField = (
  type: 'project' | 'task' | 'subtask',
  field: string,
  value: any,
  statusId: number | null | undefined,
  initialData: InitialData | null
) => {
  if (!statusId || !initialData) return false;
  const status = initialData.statuses.find(s => s.id === statusId);
  if (!status) return false;

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
    return field === 'actual_end_date';
  };

  if (status.status_name === 'New') {
    if (isNewRequirement(field) && isUnset(value)) return true;
  } else if (status.status_name === 'In Progress') {
    if ((isNewRequirement(field) || isInProgressRequirement(field)) && isUnset(value)) return true;
  } else if (status.status_name === 'Done') {
    if ((isNewRequirement(field) || isInProgressRequirement(field) || isDoneRequirement(field)) && isUnset(value)) return true;
  } else if (status.status_name === 'In Review') {
    // Treat In Review like In Progress or similar?
    // User didn't specify In Review, but it's likely closer to In Progress but with more requirements.
    // Let's stick to user's specified ones first.
    if ((isNewRequirement(field) || isInProgressRequirement(field)) && isUnset(value)) return true;
  }

  return false;
};
