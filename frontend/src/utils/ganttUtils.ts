import { format, differenceInCalendarDays, parseISO, isValid, startOfMonth, endOfMonth, getDaysInMonth, startOfWeek, addWeeks, differenceInCalendarWeeks, addDays } from 'date-fns';
import { GanttScale } from '../types/wbs';

export const GANTT_CELL_WIDTH = {
  day: 24,
  week: 120,
  month: 120,
};

/**
 * スケールに応じたセル幅を取得する
 */
export const getScaleCellWidth = (scale: GanttScale): number => {
  return GANTT_CELL_WIDTH[scale] || 24;
};

/**
 * 日付から X 座標を計算する
 */
export const getDateX = (date: Date | string, baseDate: Date, scale: GanttScale): number => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d) || !isValid(baseDate)) return 0;

  const cellWidth = getScaleCellWidth(scale);

  if (scale === 'day') {
    return differenceInCalendarDays(d, baseDate) * cellWidth;
  }

  if (scale === 'week') {
    const startOfBaseWeek = startOfWeek(baseDate, { weekStartsOn: 1 }); // 月曜開始
    const weeksDiff = differenceInCalendarWeeks(d, startOfBaseWeek, { weekStartsOn: 1 });
    const dayOfWeek = (differenceInCalendarDays(d, startOfWeek(d, { weekStartsOn: 1 }))); // 0~6
    return (weeksDiff * cellWidth) + (dayOfWeek / 7) * cellWidth;
  }

  if (scale === 'month') {
    const startOfBaseMonth = startOfMonth(baseDate);
    const monthsDiff = (d.getFullYear() - startOfBaseMonth.getFullYear()) * 12 + (d.getMonth() - startOfBaseMonth.getMonth());
    const daysInMonth = getDaysInMonth(d);
    const dayOfMonth = d.getDate() - 1; // 0~n-1
    return (monthsDiff * cellWidth) + (dayOfMonth / daysInMonth) * cellWidth;
  }

  return 0;
};

/**
 * 期間からバーの幅を計算する
 */
export const getDateWidth = (start: Date | string, end: Date | string, scale: GanttScale): number => {
  const s = typeof start === 'string' ? parseISO(start) : start;
  const e = typeof end === 'string' ? parseISO(end) : end;
  if (!isValid(s) || !isValid(e)) return 0;

  const cellWidth = getScaleCellWidth(scale);

  if (scale === 'day') {
    return (differenceInCalendarDays(e, s) + 1) * cellWidth;
  }

  // 1日分(24h)の幅をスケールに合わせて加算する
  const oneDayWidth = scale === 'week' ? (cellWidth / 7) : (cellWidth / 30); // 簡易計算
  
  // より正確には、終了日の「翌日の開始位置」から「開始日の開始位置」を引く
  const nextDayOfEnd = addDays(e, 1);
  return Math.max(0, getDateX(nextDayOfEnd, s, scale) - getDateX(s, s, scale));
};

/**
 * 表示用の日付単位配列を生成する
 */
export const getGanttUnits = (startDate: string, endDate: string, scale: GanttScale): Date[] => {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValid(start) || !isValid(end)) return [];

    const units: Date[] = [];
    let current = start;

    if (scale === 'day') {
      const totalDays = differenceInCalendarDays(end, start) + 1;
      return Array.from({ length: totalDays }).map((_, i) => addDays(start, i));
    }

    if (scale === 'week') {
      current = startOfWeek(start, { weekStartsOn: 1 });
      while (current <= end) {
        units.push(current);
        current = addWeeks(current, 1);
      }
    }

    if (scale === 'month') {
      current = startOfMonth(start);
      while (current <= end) {
        units.push(current);
        const next = new Date(current);
        next.setMonth(next.getMonth() + 1);
        current = next;
      }
    }

    return units;
  } catch {
    return [];
  }
};
