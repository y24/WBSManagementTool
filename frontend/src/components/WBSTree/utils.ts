import { InitialData } from '../../types';

export const getStatus = (id: number, initialData: InitialData | null) => 
  initialData?.statuses.find(s => s.id === id);

export const getWarning = (item: any) => {
  const warnings = [];
  if (item.planned_start_date && item.planned_end_date && item.planned_start_date > item.planned_end_date) {
    warnings.push("計画期間の開始日が終了日より後になっています。");
  }
  if (item.actual_start_date && item.actual_end_date && item.actual_start_date > item.actual_end_date) {
    warnings.push("実績期間の開始日が終了日より後になっています。");
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
