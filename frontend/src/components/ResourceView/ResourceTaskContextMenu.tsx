import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Check, Loader2, Percent, UserRound, X } from 'lucide-react';
import { InitialData } from '../../types';
import { Subtask } from '../../types/wbs';
import { wbsOps } from '../../api/wbsOperations';
import { showErrorToastUnlessNetworkError } from '../../utils/toast';
import { getSubtaskStatusAutoUpdates } from '../../utils/subtaskStatusAutoUpdates';

export type ContextMenuSubtask = Subtask & {
  project_name?: string;
  task_name?: string;
  subtask_type_name?: string;
};

interface ResourceTaskContextMenuProps {
  subtask: ContextMenuSubtask;
  initialData: InitialData | null;
  x: number;
  y: number;
  onClose: () => void;
  onRefresh: () => void;
  onLocalUpdate?: (type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, unknown>) => void;
}

const quickProgressValues = [0, 25, 50, 75, 100];
const quickWorkloadValues = [25, 50, 75, 100];

const normalizeColor = (color: string | null | undefined, fallback: string) => {
  let normalized = color || fallback;
  if (!normalized.startsWith('#')) normalized = `#${normalized}`;
  if (normalized.length === 4) {
    normalized = `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }
  return normalized;
};

const clampPosition = (x: number, y: number, actualHeight?: number) => {
  const width = 320;
  const height = actualHeight ?? 540;
  const margin = 12;
  return {
    left: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - width - margin)),
    top: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - height - margin)),
  };
};

export default function ResourceTaskContextMenu({
  subtask,
  initialData,
  x,
  y,
  onClose,
  onRefresh,
  onLocalUpdate,
}: ResourceTaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [draftTask, setDraftTask] = useState(subtask);
  const [progressInput, setProgressInput] = useState(String(subtask.progress_percent ?? 0));
  const [workloadInput, setWorkloadInput] = useState(String(subtask.workload_percent ?? 100));
  const [savingField, setSavingField] = useState<string | null>(null);
  const [adjustedPosition, setAdjustedPosition] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => {
    setDraftTask(subtask);
    setProgressInput(String(subtask.progress_percent ?? 0));
    setWorkloadInput(String(subtask.workload_percent ?? 100));
  }, [subtask]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    const handleScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    window.addEventListener('mousedown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const position = useMemo(() => clampPosition(x, y), [x, y]);

  React.useLayoutEffect(() => {
    if (!menuRef.current) return;
    const actualHeight = menuRef.current.offsetHeight;
    if (actualHeight > 0) {
      setAdjustedPosition(clampPosition(x, y, actualHeight));
    }
  }, [x, y]);

  const statusById = useMemo(
    () => new Map(initialData?.statuses.map(status => [status.id, status]) ?? []),
    [initialData],
  );
  const memberById = useMemo(
    () => new Map(initialData?.members.map(member => [member.id, member]) ?? []),
    [initialData],
  );

  const currentStatus = statusById.get(draftTask.status_id);
  const currentMember = draftTask.assignee_id ? memberById.get(draftTask.assignee_id) : null;
  const isSaving = savingField !== null;

  const saveUpdates = useCallback(async (field: string, updates: Record<string, unknown>) => {
    if (Object.keys(updates).length === 0) return;

    setSavingField(field);
    setDraftTask(prev => ({ ...prev, ...updates }));
    onLocalUpdate?.('subtask', draftTask.id, updates);

    try {
      await wbsOps.updateSubtask(draftTask.id, updates);
      onRefresh();
    } catch (error) {
      console.error(error);
      showErrorToastUnlessNetworkError(error, '保存に失敗しました。');
      onRefresh();
    } finally {
      setSavingField(null);
    }
  }, [draftTask.id, onLocalUpdate, onRefresh]);

  const handleStatusChange = (statusId: number) => {
    if (statusId === draftTask.status_id || isSaving) return;
    saveUpdates('status', {
      status_id: statusId,
      ...getSubtaskStatusAutoUpdates(draftTask, statusId, initialData),
    });
  };

  const handleAssigneeChange = (assigneeId: number | null) => {
    if (assigneeId === (draftTask.assignee_id ?? null) || isSaving) return;
    saveUpdates('assignee', { assignee_id: assigneeId });
  };

  const commitProgress = (rawValue = progressInput) => {
    const value = Number.parseInt(rawValue, 10);
    if (Number.isNaN(value)) {
      setProgressInput(String(draftTask.progress_percent ?? 0));
      return;
    }
    const clampedValue = Math.min(100, Math.max(0, value));
    setProgressInput(String(clampedValue));
    if (clampedValue === (draftTask.progress_percent ?? 0) || isSaving) return;
    saveUpdates('progress', { progress_percent: clampedValue });
  };

  const commitWorkload = (rawValue = workloadInput) => {
    const value = Number.parseInt(rawValue, 10);
    if (Number.isNaN(value)) {
      setWorkloadInput(String(draftTask.workload_percent ?? 100));
      return;
    }
    const clampedValue = Math.min(100, Math.max(1, value));
    setWorkloadInput(String(clampedValue));
    if (clampedValue === (draftTask.workload_percent ?? 100) || isSaving) return;
    saveUpdates('workload', { workload_percent: clampedValue });
  };

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[11000] w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900 dark:ring-white/10"
      style={{ left: (adjustedPosition ?? position).left, top: (adjustedPosition ?? position).top }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-slate-900 dark:text-slate-100" title={draftTask.subtask_detail || draftTask.subtask_type_name}>
            {draftTask.subtask_type_name || 'サブタスク'}{draftTask.subtask_detail ? `: ${draftTask.subtask_detail}` : ''}
          </div>
          <div className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400" title={`${draftTask.project_name} / ${draftTask.task_name}`}>
            {draftTask.project_name} / {draftTask.task_name}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[calc(100vh-140px)] overflow-y-auto p-3">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Activity size={13} />
              ステータス
            </div>
            {savingField === 'status' && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {initialData?.statuses.map(status => {
              const isSelected = status.id === draftTask.status_id;
              return (
                <button
                  key={status.id}
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleStatusChange(status.id)}
                  className={`flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors disabled:cursor-wait disabled:opacity-70 ${
                    isSelected
                      ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                  title={status.status_name}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: normalizeColor(status.color_code, '#94a3b8') }} />
                  <span className="min-w-0 flex-1 truncate">{status.status_name}</span>
                  {isSelected && <Check size={13} className="shrink-0 text-slate-500" />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Percent size={13} />
              進捗率
            </div>
            {savingField === 'progress' && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={progressInput}
              disabled={isSaving}
              onChange={(event) => setProgressInput(event.target.value)}
              onBlur={() => commitProgress()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitProgress();
                }
              }}
              className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-right text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-slate-500 transition-all dark:bg-slate-400"
                style={{ width: `${Math.min(100, Math.max(0, Number(draftTask.progress_percent ?? 0)))}%` }}
              />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {quickProgressValues.map(value => (
              <button
                key={value}
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setProgressInput(String(value));
                  commitProgress(String(value));
                }}
                className={`rounded border px-1.5 py-1 text-[11px] transition-colors disabled:cursor-wait disabled:opacity-70 ${
                  value === (draftTask.progress_percent ?? 0)
                    ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {value}%
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <Percent size={13} />
              工数比率
            </div>
            {savingField === 'workload' && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={workloadInput}
              disabled={isSaving}
              onChange={(event) => setWorkloadInput(event.target.value)}
              onBlur={() => commitWorkload()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitWorkload();
                }
              }}
              className="h-8 w-20 rounded-md border border-slate-200 bg-white px-2 text-right text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500"
            />
            <span className="text-sm text-slate-500 dark:text-slate-400">%</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-400 transition-all dark:bg-blue-500"
                style={{ width: `${Math.min(100, Math.max(0, Number(draftTask.workload_percent ?? 100)))}%` }}
              />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {quickWorkloadValues.map(value => (
              <button
                key={value}
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setWorkloadInput(String(value));
                  commitWorkload(String(value));
                }}
                className={`rounded border px-1.5 py-1 text-[11px] transition-colors disabled:cursor-wait disabled:opacity-70 ${
                  value === (draftTask.workload_percent ?? 100)
                    ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {value}%
              </button>
            ))}
          </div>
        </section>

        <section className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <UserRound size={13} />
              担当者
            </div>
            {savingField === 'assignee' && <Loader2 size={14} className="animate-spin text-slate-400" />}
          </div>
          <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
            {[{ id: null, member_name: '未設定', color_code: '#94a3b8' }, ...(initialData?.members ?? [])].map(member => {
              const isSelected = (member.id ?? null) === (draftTask.assignee_id ?? null);
              return (
                <button
                  key={member.id ?? 'unassigned'}
                  type="button"
                  disabled={isSaving}
                  onClick={() => handleAssigneeChange(member.id ?? null)}
                  className={`flex w-full min-w-0 items-center gap-2 px-2.5 py-2 text-left text-[12px] transition-colors disabled:cursor-wait disabled:opacity-70 ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                      : 'bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                  title={member.member_name}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: normalizeColor(member.color_code, '#94a3b8') }} />
                  <span className="min-w-0 flex-1 truncate">{member.member_name}</span>
                  {isSelected && <Check size={13} className="shrink-0 text-slate-500" />}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
