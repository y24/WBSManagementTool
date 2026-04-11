import React, { useRef, useEffect, useState, forwardRef, useCallback } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { Project } from '../types/wbs';
import { InitialData } from '../types';

// Sub-components
import DetailModal from './WBSTree/DetailModal';
import FloatingMenu from './WBSTree/FloatingMenu';
import ConfirmModal from './WBSTree/ConfirmModal';
import ShiftDatesModal from './WBSTree/ShiftDatesModal';
import WBSHeader from './WBSTree/WBSHeader';
import WBSTreeRows from './WBSTree/WBSTreeRows';

// Hooks
import { useWBSSelection } from './WBSTree/hooks/useWBSSelection';
import { useWBSTreeState } from './WBSTree/hooks/useWBSTreeState';
import { useWBSUpdates } from './WBSTree/hooks/useWBSUpdates';
import { useWBSCreation } from './WBSTree/hooks/useWBSCreation';
import { useWBSTreeActions } from './WBSTree/hooks/useWBSTreeActions';
import { useWBSDragDrop } from './WBSTree/hooks/useWBSDragDrop';
import { useDetailModal } from './WBSTree/hooks/useDetailModal';
import { useWBSKeyboardNavigation } from './WBSTree/hooks/useWBSKeyboardNavigation';
import { useWBSTreeExpansion } from './WBSTree/hooks/useWBSTreeExpansion';
import { useWBSNewItemEffect } from './WBSTree/hooks/useWBSNewItemEffect';

interface WBSTreeProps {
  projects: Project[];
  initialData: InitialData | null;
  onUpdate: () => void;
  onLocalUpdate?: (type: 'project' | 'task' | 'subtask', id: number, updates: Record<string, any>) => void;
  expandedProjects: Record<number, boolean>;
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  expandedTasks: Record<number, boolean>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const WBSTree = forwardRef<HTMLDivElement, WBSTreeProps>(({
  projects,
  initialData,
  onUpdate,
  onLocalUpdate,
  expandedProjects,
  setExpandedProjects,
  expandedTasks,
  setExpandedTasks,
  hidePlanningColumns = false,
  isPlanningMode = false,
  onScroll
}, ref) => {
  const [saving, setSaving] = useState(false);
  const [menuRendered, setMenuRendered] = useState(false);

  // Selection Hook
  const selection = useWBSSelection(projects);
  const { checkedIds, setCheckedIds, toggleCheckProject, toggleCheckTask, toggleCheckSubtask, totalSelectedCount, selectedIds, selectedCounts, minimalIds, clearSelection } = selection;

  // Tree State Hook
  const { nameWidth, assigneeWidth, startResizing } = useWBSTreeState();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Expansion Hook
  const { handleProjectLevel, handleTaskLevel, handleSubtaskLevel, toggleProjectExpand, toggleTaskExpand } = useWBSTreeExpansion({
    projects,
    setExpandedProjects,
    setExpandedTasks
  });

  // ref merge
  useEffect(() => {
    if (typeof ref === 'function') ref(containerRef.current);
    else if (ref) (ref as any).current = containerRef.current;
  }, [ref]);

  // Keyboard Navigation Hook
  const keyboardNav = useWBSKeyboardNavigation({
    projects,
    expandedProjects,
    expandedTasks,
    hidePlanningColumns,
    isPlanningMode
  });
  const { focus, setFocus, isEditing, handleKeyDown, setIsEditing, moveFocusAndEdit } = keyboardNav;

  // focus handle
  const handleCellClick = useCallback((rowId: string, field: string) => {
    setFocus({ rowId, field: field as any });
    // setTimeoutを使用して、コンポーネントの再描画後にフォーカス状態を確認する。
    // EditableInputなどがautoFocusでフォーカスを得た場合、ここでのコンテナへのフォーカス強制を回避する。
    setTimeout(() => {
      const active = document.activeElement;
      const isInteractive = active && (
        active.tagName === 'INPUT' || 
        active.tagName === 'SELECT' || 
        active.tagName === 'TEXTAREA' || 
        active.tagName === 'BUTTON' ||
        active.hasAttribute('contenteditable')
      );
      if (!isInteractive) {
        containerRef.current?.focus();
      }
    }, 0);
  }, [setFocus]);

  // Actions Hook
  const actions = useWBSTreeActions({
    projects,
    selectedIds,
    minimalIds,
    selectedCounts,
    totalSelectedCount,
    checkedIds,
    onUpdate,
    setSaving,
    clearSelection
  });
  const { isConfirmModalOpen, setIsConfirmModalOpen, confirmData, isShiftDatesModalOpen, setIsShiftDatesModalOpen, currentMinDate, handleDeleteSelected, handleClearActualsSelected, handleClearPlansActualsSelected, handleDuplicateSelected, handleShiftDatesSelected, executeShiftDates, setConfirmData } = actions;

  // Updates Hook
  const { handleUpdate, findItem } = useWBSUpdates({ projects, initialData, onUpdate, onLocalUpdate, setSaving, checkedIds, setConfirmData, setIsConfirmModalOpen });

  // Creation Hook
  const creation = useWBSCreation(onUpdate, initialData, setExpandedProjects, setExpandedTasks, setSaving);
  const { lastAddedId, setLastAddedId, handleAddTask, handleAddSubtask } = creation;

  // Detail Modal Hook
  const detailModal = useDetailModal({ onUpdate, onLocalUpdate, setSaving, checkedIds, setIsConfirmModalOpen, setConfirmData, findItem });
  const { editingItem, setEditingItem, detailValue, setDetailValue, ticketIdValue, setTicketIdValue, linkUrlValue, setLinkUrlValue, memoValue, setMemoValue, workloadPercentValue, setWorkloadPercentValue, openDetailModal, handleDetailSave } = detailModal;

  // Drag Drop Hook
  const { onDragEnd } = useWBSDragDrop(projects, onUpdate, setSaving);

  // New item scroll effect
  useWBSNewItemEffect(projects, lastAddedId, setLastAddedId);

  // Floating menu rendered effect
  useEffect(() => {
    if (Object.values(checkedIds).some(Boolean)) {
      setMenuRendered(true);
    } else {
      const timer = setTimeout(() => setMenuRendered(false), 400);
      return () => clearTimeout(timer);
    }
  }, [checkedIds]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex-1 w-full overflow-y-auto overflow-x-scroll bg-white dark:bg-slate-900 border-r dark:border-slate-800 relative no-scrollbar transition-colors outline-none focus:ring-1 focus:ring-blue-200/50"
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (isConfirmModalOpen || isShiftDatesModalOpen || editingItem) return;
        handleKeyDown(e);
      }}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('button, input, textarea, a, select, [role="button"]');
        if (!isInteractive) {
          containerRef.current?.focus();
        }
      }}
    >
      <div className="min-w-max">
        {saving && (
          <div className="absolute top-1 right-2 z-50">
            <span className="text-[10px] text-blue-500 font-medium">Saving...</span>
          </div>
        )}

        <WBSHeader
          nameWidth={nameWidth}
          assigneeWidth={assigneeWidth}
          startResizing={startResizing}
          handleProjectLevel={handleProjectLevel}
          handleTaskLevel={handleTaskLevel}
          handleSubtaskLevel={handleSubtaskLevel}
          hidePlanningColumns={hidePlanningColumns}
          isPlanningMode={isPlanningMode}
        />

        <DragDropContext onDragEnd={onDragEnd}>
          <WBSTreeRows
            projects={projects}
            initialData={initialData}
            expandedProjects={expandedProjects}
            expandedTasks={expandedTasks}
            checkedIds={checkedIds}
            nameWidth={nameWidth}
            assigneeWidth={assigneeWidth}
            hidePlanningColumns={hidePlanningColumns}
            isPlanningMode={isPlanningMode}
            focusedField={focus}
            onToggleCheckProject={toggleCheckProject}
            onToggleCheckTask={toggleCheckTask}
            onToggleCheckSubtask={toggleCheckSubtask}
            onToggleExpandProject={toggleProjectExpand}
            onToggleExpandTask={toggleTaskExpand}
            onUpdateField={handleUpdate}
            onAddTask={handleAddTask}
            onAddSubtask={handleAddSubtask}
            onEditDetail={openDetailModal}
            onFocusChange={handleCellClick}
            onEditingChange={setIsEditing}
            isEditing={isEditing}
            onTabNavigation={moveFocusAndEdit}
          />
        </DragDropContext>

        {projects.length === 0 && (
          <div className="p-8 text-center text-gray-500 dark:text-slate-500 w-full col-span-full">
            上部のボタンからプロジェクトを追加してください。
          </div>
        )}
      </div>

      {editingItem && (
        <DetailModal
          editingType={editingItem.type}
          editingName={editingItem.name}
          detailValue={detailValue}
          setDetailValue={setDetailValue}
          ticketIdValue={ticketIdValue}
          setTicketIdValue={setTicketIdValue}
          memoValue={memoValue}
          setMemoValue={setMemoValue}
          linkUrlValue={linkUrlValue}
          setLinkUrlValue={setLinkUrlValue}
          workloadPercentValue={workloadPercentValue}
          setWorkloadPercentValue={setWorkloadPercentValue}
          ticketUrlTemplate={initialData?.ticket_url_template}
          onClose={() => setEditingItem(null)}
          onSave={handleDetailSave}
        />
      )}

      <FloatingMenu
        totalSelectedCount={totalSelectedCount}
        onDelete={handleDeleteSelected}
        onDuplicate={handleDuplicateSelected}
        onClearActuals={handleClearActualsSelected}
        onClearPlansActuals={handleClearPlansActualsSelected}
        onShiftDates={handleShiftDatesSelected}
        onClear={() => setCheckedIds({})}
        menuRendered={menuRendered}
        loading={saving}
      />

      <ShiftDatesModal
        isOpen={isShiftDatesModalOpen}
        onClose={() => setIsShiftDatesModalOpen(false)}
        onConfirm={executeShiftDates}
        currentMinDate={currentMinDate}
        totalSelectedCount={totalSelectedCount}
      />

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        totalCount={confirmData.total}
        title={confirmData.title}
        description={confirmData.detail}
        confirmText={confirmData.confirmText}
        variant={confirmData.variant}
        onConfirm={confirmData.onConfirm}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
});

export default WBSTree;
