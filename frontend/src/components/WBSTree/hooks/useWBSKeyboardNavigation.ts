import { useState, useCallback, useMemo, useEffect } from 'react';
import { Project, Task, Subtask } from '../../../types/wbs';

export type WBSField = 
  | 'name' | 'status' | 'progress' | 'assignee' 
  | 'work_days' | 'review_days' | 'planned_start' | 'planned_end' | 'planned_effort'
  | 'actual_start' | 'review_start' | 'actual_end' | 'actual_effort';

export interface FocusPoint {
  rowId: string;
  field: WBSField;
}

interface UseWBSKeyboardNavigationProps {
  projects: Project[];
  expandedProjects: Record<number, boolean>;
  expandedTasks: Record<number, boolean>;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
}

export const useWBSKeyboardNavigation = ({
  projects,
  expandedProjects,
  expandedTasks,
  hidePlanningColumns = false,
  isPlanningMode = false
}: UseWBSKeyboardNavigationProps) => {
  const [focus, setFocus] = useState<FocusPoint | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // 全てのフィールド順序
  const allFields: WBSField[] = [
    'name', 'status', 'progress', 'assignee',
    'work_days', 'review_days', 'planned_start', 'planned_end', 'planned_effort',
    'actual_start', 'review_start', 'actual_end', 'actual_effort'
  ];

  // 現在のモードで有効なフィールドリスト
  const visibleFields = useMemo(() => {
    return allFields.filter(f => {
      if (hidePlanningColumns && ['work_days', 'review_days', 'planned_start', 'planned_end', 'planned_effort'].includes(f)) return false;
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

  // 特定のセルが読み取り専用かどうかを判定
  const isReadOnly = useCallback((rowId: string, field: WBSField): boolean => {
    const row = visibleRows.find(r => r.id === rowId);
    if (!row) return true;

    const { type, data } = row;

    // 基本的なリードオンリーチェック
    if (type === 'project' || type === 'task') {
      // 名称以外は基本自動計算（プロジェクト・タスク）
      if (field !== 'name' && field !== 'assignee' && field !== 'status') {
        // 進捗率は入力可能
        if (field === 'progress') return false;
        // それ以外（日付、工数など）はプロジェクト/タスクレベルでは自動計算
        return true;
      }
    }

    if (type === 'subtask') {
      const s = data as Subtask;
      if (field === 'review_start' && Number(s.review_days) === 0) return true;
      if (field === 'planned_effort' && s.is_auto_effort) return true;
      if (field === 'actual_effort' && s.is_auto_effort) return true;
    }

    return false;
  }, [visibleRows]);

  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right' | 'next' | 'prev') => {
    if (!focus) {
      if (visibleRows.length > 0) setFocus({ rowId: visibleRows[0].id, field: visibleFields[0] });
      return;
    }

    const currentRowIndex = visibleRows.findIndex(r => r.id === focus.rowId);
    const currentFieldIndex = visibleFields.indexOf(focus.field);

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

        const nextRowId = visibleRows[r].id;
        const nextField = visibleFields[f];

        if (!isReadOnly(nextRowId, nextField)) {
          return { rowId: nextRowId, field: nextField };
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
  }, [focus, visibleRows, visibleFields, isReadOnly]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) return;

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
        if (focus && !isReadOnly(focus.rowId, focus.field)) {
          e.preventDefault();
          setIsEditing(true);
        }
        break;
      case 'Escape':
        setFocus(null);
        break;
    }
  }, [isEditing, moveFocus, focus, isReadOnly]);

  return {
    focus,
    setFocus,
    isEditing,
    setIsEditing,
    handleKeyDown,
    visibleRows,
    visibleFields
  };
};
