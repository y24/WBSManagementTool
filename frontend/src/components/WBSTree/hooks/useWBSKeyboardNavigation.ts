import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Project, Task, Subtask } from '../../../types/wbs';
import { InitialData } from '../../../types';
import { parseDateFromInput } from '../utils';

export type WBSField = 
  | 'name' | 'status' | 'progress' | 'assignee' | 'workload_percent'
  | 'work_days' | 'review_days' | 'planned_start' | 'planned_end' | 'planned_effort'
  | 'actual_start' | 'review_start' | 'actual_end' | 'actual_effort';

export interface FocusPoint {
  rowId: string;
  field: WBSField;
}

interface UseWBSKeyboardNavigationProps {
  projects: Project[];
  initialData: InitialData | null;
  expandedProjects: Record<number, boolean>;
  expandedTasks: Record<number, boolean>;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
  onUpdateField?: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any, options?: { forceConfirm?: boolean }) => void;
}

export const useWBSKeyboardNavigation = ({
  projects,
  initialData,
  expandedProjects,
  expandedTasks,
  hidePlanningColumns = false,
  isPlanningMode = false,
  onUpdateField
}: UseWBSKeyboardNavigationProps) => {
  const [focus, setFocus] = useState<FocusPoint | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 最新の値を非等価再描画なしで参照するためのRef
  const projectsRef = useRef(projects);
  const initialDataRef = useRef(initialData);
  const onUpdateFieldRef = useRef(onUpdateField);
  const focusRef = useRef(focus);

  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { initialDataRef.current = initialData; }, [initialData]);
  useEffect(() => { onUpdateFieldRef.current = onUpdateField; }, [onUpdateField]);
  useEffect(() => { focusRef.current = focus; }, [focus]);

  // 全てのフィールド順序
  const allFields: WBSField[] = [
    'name', 'status', 'progress', 'assignee', 'workload_percent',
    'work_days', 'review_days', 'planned_start', 'planned_end', 'planned_effort',
    'actual_start', 'review_start', 'actual_end', 'actual_effort'
  ];

  // 現在のモードで有効なフィールドリスト
  const visibleFields = useMemo(() => {
    return allFields.filter(f => {
      if (hidePlanningColumns && ['workload_percent', 'work_days', 'review_days', 'planned_start', 'planned_end', 'planned_effort'].includes(f)) return false;
      if (isPlanningMode && ['actual_start', 'review_start', 'actual_end', 'actual_effort'].includes(f)) return false;
      return true;
    });
  }, [hidePlanningColumns, isPlanningMode]);

  // 現在表示（展開）されている全行のフラットリスト
  const visibleRows = useMemo(() => {
    const rows: { id: string; type: 'project' | 'task' | 'subtask'; data: any }[] = [];
    projects.forEach(p => {
      rows.push({ id: `p-${p.id}`, type: 'project', data: p });
      if (expandedProjects[p.id] !== false) {
        p.tasks.forEach(t => {
          rows.push({ id: `t-${t.id}`, type: 'task', data: t });
          if (expandedTasks[t.id] !== false) {
            t.subtasks.forEach(s => {
              rows.push({ id: `s-${s.id}`, type: 'subtask', data: s });
            });
          }
        });
      }
    });
    return rows;
  }, [projects, expandedProjects, expandedTasks]);

  // 特定のセルが読み取り専用かどうかを判定 (パフォーマンスのため、行オブジェクトを直接受け取る)
  const isReadOnlyRow = useCallback((row: { type: 'project' | 'task' | 'subtask'; data: any }, field: WBSField): boolean => {
    const { type, data } = row;

    // 基本的なリードオンリーチェック
    if (type === 'project' || type === 'task') {
      const p = data as (Project | Task);
      // 名称、担当者、ステータスは入力可能
      if (field === 'name' || field === 'assignee' || field === 'status') return false;

      // 進捗率はプロジェクト・タスクレベルでは常に自動計算のためスキップ
      if (field === 'progress') return true;

      // 工数比率はサブタスクのみ
      if (field === 'workload_percent') return true;

      // 日付は自動設定がONの場合はスキップ（入力不可）
      if (field === 'planned_start' || field === 'planned_end') return !!p.is_auto_planned_date;
      if (field === 'actual_start' || field === 'actual_end') return !!p.is_auto_actual_date;

      // それ以外（工数など）は常に自動算出
      return true;
    }

    if (type === 'subtask') {
      const s = data as Subtask;
      if (field === 'review_start' && Number(s.review_days) === 0) return true;
      if (field === 'planned_effort' && s.is_auto_effort) return true;
      if (field === 'actual_effort' && s.is_auto_effort) return true;
    }

    return false;
  }, []);

  const isReadOnly = useCallback((rowId: string, field: WBSField): boolean => {
    const row = visibleRows.find(r => r.id === rowId);
    if (!row) return true;
    return isReadOnlyRow(row, field);
  }, [visibleRows, isReadOnlyRow]);

  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => {
    const currentFocus = focusRef.current;
    if (!currentFocus) {
      if (visibleRows.length > 0) setFocus({ rowId: visibleRows[0].id, field: visibleFields[0] });
      return;
    }

    const currentRowIndex = visibleRows.findIndex(r => r.id === currentFocus.rowId);
    const currentFieldIndex = visibleFields.indexOf(currentFocus.field);

    if (currentRowIndex === -1 || currentFieldIndex === -1) return;

    let nextRowIndex = currentRowIndex;
    let nextFieldIndex = currentFieldIndex;

    const findNextValid = (rowStep: number, fieldStep: number, wrap: boolean) => {
      let r = currentRowIndex;
      let f = currentFieldIndex;

      while (true) {
        if (fieldStep !== 0) {
          f += fieldStep;
          if (f >= visibleFields.length) {
            if (wrap) {
              f = 0;
              r += 1;
            } else {
              f = visibleFields.length - 1;
              break;
            }
          } else if (f < 0) {
            if (wrap) {
              f = visibleFields.length - 1;
              r -= 1;
            } else {
              f = 0;
              break;
            }
          }
        } else if (rowStep !== 0) {
          r += rowStep;
        } else {
          // Both steps are 0, should not happen but break to be safe
          break;
        }

        if (r < 0 || r >= visibleRows.length) break;

        const row = visibleRows[r];
        const nextField = visibleFields[f];

        if (!isReadOnlyRow(row, nextField)) {
          return { rowId: row.id, field: nextField };
        }

        // 行移動の場合は、その列が読み取り専用ならさらにその方向に探し続ける
        // ただし、無限ループ防止のため一度だけ元の列で検証したらbreakするのではなく、
        // 明示的なrowStepがある場合は次の行へ進む
        if (fieldStep === 0 && rowStep !== 0) {
          continue; 
        }

        // ラップ移動（Tab）の場合は、有効なセルが見つかるまで回し続ける
        if (wrap) {
          continue;
        }

        // それ以外（矢印左右で読み取り専用に当たった場合）はそこで止まるか、
        // あるいはさらに隣を探すか。Excelは選択自体はできる。
        // ここでは「非活性はスキップ」という要件なので、さらに探し続ける。
        if (fieldStep !== 0) {
          continue;
        }

        break;
      }
      return null;
    };

    let next: FocusPoint | null = null;
    switch (direction) {
      case 'up': next = findNextValid(-1, 0, false); break;
      case 'down': next = findNextValid(1, 0, false); break;
      case 'left': next = findNextValid(0, -1, false); break;
      case 'right': next = findNextValid(0, 1, false); break;
      case 'next': next = findNextValid(0, 1, true); break;
      case 'prev': next = findNextValid(0, -1, true); break;
    }

    if (next) {
      setFocus(next);
      // スクロール処理
      const element = document.querySelector(`[data-wbs-id="${next.rowId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
  }, [visibleRows, visibleFields, isReadOnlyRow]); // focus への依存を削除

  // 値を解決するヘルパー
  const getDisplayValue = useCallback((row: { type: string; data: any }, field: WBSField) => {
    const { type, data } = row;
    const currentInitialData = initialDataRef.current;
    if (!currentInitialData) return '';

    switch (field) {
      case 'name':
        if (type === 'subtask') {
          const st = currentInitialData.subtask_types.find(t => t.id === data.subtask_type_id);
          return st?.type_name || '';
        } else {
          return type === 'project' ? data.project_name : data.task_name;
        }
      case 'status':
        const status = currentInitialData.statuses.find(s => s.id === data.status_id);
        return status?.status_name || '';
      case 'assignee':
        const member = currentInitialData.members.find(m => m.id === data.assignee_id);
        return member?.member_name || '';
      case 'planned_start': return data.planned_start_date || '';
      case 'planned_end': return data.planned_end_date || '';
      case 'actual_start': return data.actual_start_date || '';
      case 'actual_end': return data.actual_end_date || '';
      case 'review_start': return data.review_start_date || '';
      case 'progress': return data.progress_percent != null ? String(data.progress_percent) : '';
      case 'workload_percent': return data.workload_percent != null ? String(data.workload_percent) : '';
      case 'work_days': return data.work_days != null ? String(data.work_days) : '';
      case 'review_days': return data.review_days != null ? String(data.review_days) : '';
      case 'planned_effort': return data.planned_effort_days != null ? String(data.planned_effort_days) : (data.planned_effort_total != null ? String(data.planned_effort_total) : '');
      case 'actual_effort': return data.actual_effort_days != null ? String(data.actual_effort_days) : (data.actual_effort_total != null ? String(data.actual_effort_total) : '');
      default: return '';
    }
  }, []);

  // クリップボード・コピーイベント (ブラウザの許可ダイアログ回避)
  const handleCopy = useCallback((e: React.ClipboardEvent) => {
    if (isEditing) return; // 編集中の場合はブラウザのデフォルト挙動（Input内の選択範囲コピー）に任せる

    const currentFocus = focusRef.current;
    if (!currentFocus) return;

    const row = visibleRows.find(r => r.id === currentFocus.rowId);
    if (!row) return;

    const exportValue = getDisplayValue(row, currentFocus.field);
    if (exportValue) {
      e.clipboardData.setData('text/plain', exportValue);
      e.preventDefault();
    }
  }, [visibleRows, isEditing, getDisplayValue]);

  // 値の貼り付け実行ロジック
  const executePaste = useCallback((text: string) => {
    const currentFocus = focusRef.current;
    const currentOnUpdateField = onUpdateFieldRef.current;
    const currentInitialData = initialDataRef.current;

    if (!currentFocus || !currentOnUpdateField || !currentInitialData || isReadOnly(currentFocus.rowId, currentFocus.field)) return;

    const row = visibleRows.find(r => r.id === currentFocus.rowId);
    if (!row) return;
    const { type, data } = row;

    let dbField = '';
    let newValue: any = text;

    // フィールドマッピング
    switch (currentFocus.field) {
      case 'name':
        if (type === 'project') dbField = 'project_name';
        else if (type === 'task') dbField = 'task_name';
        else {
          dbField = 'subtask_type_id';
          const id = parseInt(text, 10);
          if (!isNaN(id) && currentInitialData.subtask_types.some(t => t.id === id)) {
            newValue = id;
          } else {
            const st = currentInitialData.subtask_types.find(t => t.type_name === text);
            if (st) newValue = st.id;
            else return;
          }
        }
        break;
      case 'status':
        dbField = 'status_id';
        const sid = parseInt(text, 10);
        if (!isNaN(sid) && currentInitialData.statuses.some(s => s.id === sid)) {
          newValue = sid;
        } else {
          const s = currentInitialData.statuses.find(s => s.status_name === text);
          if (s) newValue = s.id;
          else return;
        }
        break;
      case 'assignee':
        dbField = 'assignee_id';
        if (text === '未設定' || text === '') {
          newValue = null;
        } else {
          const mid = parseInt(text, 10);
          if (!isNaN(mid) && currentInitialData.members.some(m => m.id === mid)) {
            newValue = mid;
          } else {
            const m = currentInitialData.members.find(m => m.member_name === text);
            if (m) newValue = m.id;
            else return;
          }
        }
        break;
      case 'progress': dbField = 'progress_percent'; newValue = parseInt(text.replace('%', ''), 10); break;
      case 'workload_percent': dbField = 'workload_percent'; newValue = parseInt(text.replace('%', ''), 10); break;
      case 'work_days': dbField = 'work_days'; newValue = parseFloat(text); break;
      case 'review_days': dbField = 'review_days'; newValue = parseFloat(text); break;
      case 'planned_start': dbField = 'planned_start_date'; newValue = parseDateFromInput(text); break;
      case 'planned_end': dbField = 'planned_end_date'; newValue = parseDateFromInput(text); break;
      case 'actual_start': dbField = 'actual_start_date'; newValue = parseDateFromInput(text); break;
      case 'actual_end': dbField = 'actual_end_date'; newValue = parseDateFromInput(text); break;
      case 'review_start': dbField = 'review_start_date'; newValue = parseDateFromInput(text); break;
      case 'planned_effort': dbField = 'planned_effort_days'; newValue = parseFloat(text); break;
      case 'actual_effort': dbField = 'actual_effort_days'; newValue = parseFloat(text); break;
    }

    if (dbField && newValue !== undefined && newValue !== '') {
      if (typeof newValue === 'number' && isNaN(newValue)) return;
      currentOnUpdateField(type, data.id, dbField, newValue, { forceConfirm: true });
    }
  }, [visibleRows, isReadOnly]);

  // クリップボード・貼り付けイベント
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (isEditing) return; // 編集中の場合はブラウザのデフォルト挙動に任せる

    const text = e.clipboardData.getData('text/plain');
    if (text) {
      executePaste(text);
      e.preventDefault();
    }
  }, [isEditing, executePaste]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) return;

    // Ctrl+C, Ctrl+V
    // これらのキーはブラウザの copy/paste イベントを火花させるため、
    // ここで preventDefault せず、ON COPY / ON PASTE ハンドラ側で処理する。
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V') {
        return;
      }
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        moveFocus('up');
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus('down');
        break;
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus('left');
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus('right');
        break;
      case 'Tab':
        e.preventDefault();
        moveFocus(e.shiftKey ? 'prev' : 'next');
        break;
      case 'Enter':
      case 'F2':
        {
          const currentFocus = focusRef.current;
          if (currentFocus && !isReadOnly(currentFocus.rowId, currentFocus.field)) {
            e.preventDefault();
            setIsEditing(true);
          }
        }
        break;
    }
  }, [isEditing, moveFocus, isReadOnly]); // focus への依存を削除

  const moveFocusAndEdit = useCallback((direction: 'next' | 'prev', autoEdit: boolean = true) => {
    moveFocus(direction);
    if (autoEdit) {
      // 次のセルへ移動した後、少し遅延させてから編集モードをONにする
      // (セルの移動自体が非同期に反映される可能性があるため)
      setTimeout(() => {
        setIsEditing(true);
      }, 10);
    }
  }, [moveFocus]);

  return useMemo(() => ({
    focus,
    setFocus,
    isEditing,
    setIsEditing,
    handleKeyDown,
    handleCopy,
    handlePaste,
    moveFocusAndEdit,
    visibleRows,
    visibleFields
  }), [focus, isEditing, handleKeyDown, handleCopy, handlePaste, moveFocusAndEdit, visibleRows, visibleFields]);
};
