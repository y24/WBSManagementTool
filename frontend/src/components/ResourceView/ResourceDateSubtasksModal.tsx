import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CheckCircle2, CircleDot, ClipboardList, ExternalLink, X } from 'lucide-react';
import { InitialData } from '../../types';
import { ResourceRow, ResourceSubtask } from '../../pages/mainboard/useResourceData';
import { getDisplayActualEndDate, toDateKey } from '../../utils/ganttDateRange';
import { getResourcePlannedDateRange } from '../../utils/resourcePlanning';

interface ResourceDateSubtasksModalProps {
  date: string;
  data: ResourceRow[];
  initialData: InitialData | null;
  onClose: () => void;
}

type MatchedSubtask = {
  subtask: ResourceSubtask;
  inPlannedRange: boolean;
  inActualRange: boolean;
};

type MemberGroup = {
  assigneeName: string;
  assigneeColor: string;
  tasks: MatchedSubtask[];
};

const normalizeColor = (color: string | null | undefined, fallback: string): string => {
  let normalized = color || fallback;
  if (!normalized.startsWith('#')) normalized = `#${normalized}`;
  if (normalized.length === 4) {
    normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return normalized;
};

const isDateInRange = (date: string, start: string | null, end: string | null): boolean => {
  if (!start || !end) return false;
  const rangeStart = start <= end ? start : end;
  const rangeEnd = start <= end ? end : start;
  return rangeStart <= date && date <= rangeEnd;
};

const formatDateLabel = (date: string): string => {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
};

const getStatusColor = (initialData: InitialData | null, statusId: number): string => {
  const status = initialData?.statuses.find(s => s.id === statusId);
  return normalizeColor(status?.color_code, '#64748b');
};

const ResourceDateSubtasksModal: React.FC<ResourceDateSubtasksModalProps> = ({
  date,
  data,
  initialData,
  onClose,
}) => {
  const doneStatusId = useMemo(
    () => initialData?.status_mapping_done ? Number.parseInt(initialData.status_mapping_done, 10) : null,
    [initialData],
  );

  const removedStatusId = useMemo(
    () => initialData?.statuses.find(s => s.status_name === 'Removed')?.id,
    [initialData],
  );

  const statusNameById = useMemo(
    () => new Map(initialData?.statuses.map(status => [status.id, status.status_name]) ?? []),
    [initialData],
  );

  const groups = useMemo<MemberGroup[]>(() => {
    return data
      .map(row => {
        const tasks = row.subtasks
          .filter(subtask => removedStatusId === undefined || subtask.status_id !== removedStatusId)
          .map<MatchedSubtask | null>(subtask => {
            const plannedRange = getResourcePlannedDateRange(subtask, doneStatusId);
            const inPlannedRange = plannedRange
              ? isDateInRange(date, plannedRange.start, plannedRange.end)
              : false;

            const actualStart = toDateKey(subtask.actual_start_date);
            const actualEnd = getDisplayActualEndDate(subtask);
            const inActualRange = isDateInRange(date, actualStart, actualEnd);

            if (!inPlannedRange && !inActualRange) return null;
            return { subtask, inPlannedRange, inActualRange };
          })
          .filter((task): task is MatchedSubtask => task !== null)
          .sort((a, b) => {
            const aDate = toDateKey(a.subtask.planned_start_date) ?? toDateKey(a.subtask.actual_start_date) ?? '';
            const bDate = toDateKey(b.subtask.planned_start_date) ?? toDateKey(b.subtask.actual_start_date) ?? '';
            if (aDate !== bDate) return aDate.localeCompare(bDate);
            return a.subtask.id - b.subtask.id;
          });

        return {
          assigneeName: row.assignee?.member_name ?? '未アサイン',
          assigneeColor: normalizeColor(row.assignee?.color_code, '#94a3b8'),
          tasks,
        };
      })
      .filter(group => group.tasks.length > 0);
  }, [data, date, doneStatusId, removedStatusId]);

  const totalCount = groups.reduce((sum, group) => sum + group.tasks.length, 0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return createPortal(
    <div
      data-modal-active="true"
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm dark:bg-black/60"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/50">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
              <CalendarDays size={19} className="text-slate-500 dark:text-slate-400" />
              {formatDateLabel(date)}
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              担当者別サブタスク {totalCount}件
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            aria-label="閉じる"
            title="閉じる"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950/60">
          {groups.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              <ClipboardList size={28} className="mb-3 text-slate-400 dark:text-slate-500" />
              <div className="text-sm font-medium">この日に表示できるサブタスクはありません。</div>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map(group => (
                <section key={group.assigneeName} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: group.assigneeColor }}
                    />
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {group.assigneeName}
                    </h4>
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {group.tasks.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.tasks.map(({ subtask, inPlannedRange, inActualRange }) => {
                      const statusName = statusNameById.get(subtask.status_id) ?? '未設定';
                      const statusColor = getStatusColor(initialData, subtask.status_id);
                      const plannedRange = getResourcePlannedDateRange(subtask, doneStatusId);
                      const actualStart = toDateKey(subtask.actual_start_date);
                      const actualEnd = getDisplayActualEndDate(subtask);

                      return (
                        <article
                          key={subtask.id}
                          className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                <ClipboardList size={13} />
                                <span className="truncate">{subtask.project_name}</span>
                              </div>
                              <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                                {subtask.task_name}
                              </div>
                              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                                {subtask.subtask_detail || subtask.subtask_type_name || 'サブタスク'}
                              </div>
                            </div>
                            <span
                              className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow-sm"
                              style={{ backgroundColor: statusColor }}
                              title={statusName}
                            >
                              <CircleDot size={11} />
                              {statusName}
                            </span>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {inPlannedRange && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                <CalendarDays size={12} />
                                予定
                              </span>
                            )}
                            {inActualRange && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                <CheckCircle2 size={12} />
                                実績
                              </span>
                            )}
                            {subtask.subtask_type_name && (
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {subtask.subtask_type_name}
                              </span>
                            )}
                          </div>

                          <dl className="grid grid-cols-2 gap-2 text-[12px]">
                            <div className="rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/70">
                              <dt className="text-slate-400 dark:text-slate-500">予定</dt>
                              <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                                {plannedRange ? `${plannedRange.start} - ${plannedRange.end}` : '-'}
                              </dd>
                            </div>
                            <div className="rounded-md bg-slate-50 px-2 py-1.5 dark:bg-slate-800/70">
                              <dt className="text-slate-400 dark:text-slate-500">実績</dt>
                              <dd className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">
                                {actualStart && actualEnd ? `${actualStart} - ${actualEnd}` : '-'}
                              </dd>
                            </div>
                          </dl>

                          {subtask.link_url && (
                            <a
                              href={subtask.link_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                              <ExternalLink size={12} />
                              リンクを開く
                            </a>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ResourceDateSubtasksModal;
