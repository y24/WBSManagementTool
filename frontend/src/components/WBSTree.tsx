import React, { useRef, useEffect, useState, forwardRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Project } from '../types/wbs';
import { InitialData } from '../types';

// Sub-components
import ProjectRow from './WBSTree/ProjectRow';
import TaskRow from './WBSTree/TaskRow';
import SubtaskRow from './WBSTree/SubtaskRow';
import DetailModal from './WBSTree/DetailModal';
import FloatingMenu from './WBSTree/FloatingMenu';
import ConfirmModal from './WBSTree/ConfirmModal';
import ShiftDatesModal from './WBSTree/ShiftDatesModal';
import WBSHeader from './WBSTree/WBSHeader';

// Hooks
import { useWBSSelection } from './WBSTree/hooks/useWBSSelection';
import { useWBSTreeState } from './WBSTree/hooks/useWBSTreeState';
import { useWBSUpdates } from './WBSTree/hooks/useWBSUpdates';
import { useWBSCreation } from './WBSTree/hooks/useWBSCreation';
import { useWBSTreeActions } from './WBSTree/hooks/useWBSTreeActions';
import { useWBSDragDrop } from './WBSTree/hooks/useWBSDragDrop';
import { useDetailModal } from './WBSTree/hooks/useDetailModal';

interface WBSTreeProps {
  projects: Project[];
  initialData: InitialData | null;
  onUpdate: () => void;
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

  // Tree State Hook (Expansion logic is handled by props passed from App, but resizing and level toggles are here)
  const treeState = useWBSTreeState(projects);
  const { nameWidth, assigneeWidth, startResizing, handleProjectLevel: baseHandleProjectLevel, handleTaskLevel: baseHandleTaskLevel, handleSubtaskLevel: baseHandleSubtaskLevel } = treeState;

  // Wrap level handlers to update the props
  const handleProjectLevel = () => {
    const newExpandedProjects: Record<number, boolean> = {};
    projects.forEach(p => { newExpandedProjects[p.id] = false; });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks({});
  };

  const handleTaskLevel = () => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => { newExpandedTasks[t.id] = false; });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  };

  const handleSubtaskLevel = () => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => { newExpandedTasks[t.id] = true; });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  };

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
  const { isConfirmModalOpen, setIsConfirmModalOpen, confirmData, isShiftDatesModalOpen, setIsShiftDatesModalOpen, currentMinDate, handleDeleteSelected, handleClearActualsSelected, handleDuplicateSelected, handleShiftDatesSelected, executeShiftDates, setConfirmData } = actions;

  // Updates Hook
  const { handleUpdate, findItem } = useWBSUpdates({ projects, initialData, onUpdate, setSaving, checkedIds, setConfirmData, setIsConfirmModalOpen });

  // Creation Hook
  const creation = useWBSCreation(onUpdate, initialData, setExpandedProjects, setExpandedTasks, setSaving);
  const { lastAddedId, setLastAddedId, handleAddTask, handleAddSubtask } = creation;

  // Detail Modal Hook
  const detailModal = useDetailModal({ onUpdate, setSaving, checkedIds, setIsConfirmModalOpen, setConfirmData, findItem });
  const { editingItem, setEditingItem, detailValue, setDetailValue, ticketIdValue, setTicketIdValue, linkUrlValue, setLinkUrlValue, memoValue, setMemoValue, workloadPercentValue, setWorkloadPercentValue, openDetailModal, handleDetailSave } = detailModal;

  // Drag Drop Hook
  const { onDragEnd } = useWBSDragDrop(projects, onUpdate, setSaving);

  // New item scroll effect
  useEffect(() => {
    if (lastAddedId) {
      let attempts = 0;
      const scrollInterval = setInterval(() => {
        const element = document.querySelector(`[data-wbs-id="${lastAddedId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (lastAddedId.startsWith('p-') || lastAddedId.startsWith('t-')) {
            const nameInput = element.querySelector('.flex-1.min-w-0 > div');
            if (nameInput instanceof HTMLElement) {
              setTimeout(() => { nameInput.click(); }, 300);
            }
          }
          setLastAddedId(null);
          clearInterval(scrollInterval);
        } else if (++attempts > 20) {
          setLastAddedId(null);
          clearInterval(scrollInterval);
        }
      }, 100);
      return () => clearInterval(scrollInterval);
    }
  }, [projects, lastAddedId, setLastAddedId]);

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
      ref={ref}
      className="flex-1 w-full overflow-auto bg-white dark:bg-slate-900 border-r dark:border-slate-800 relative no-scrollbar transition-colors"
      onScroll={onScroll}
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
          <Droppable droppableId="projects-root" type="PROJECT">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="min-w-max">
                {projects.map((project, pIndex) => (
                  <Draggable key={`p-${project.id}`} draggableId={`p-${project.id}`} index={pIndex}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} data-wbs-id={`p-${project.id}`}>
                        <Droppable droppableId={`project-row-drop-${project.id}`} type="TASK">
                          {(rowProvided, rowSnapshot) => (
                            <div 
                              {...rowProvided.droppableProps} 
                              ref={rowProvided.innerRef}
                              className={`transition-all ${rowSnapshot.isDraggingOver ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/20 dark:bg-blue-900/20' : ''}`}
                            >
                              <ProjectRow
                                project={project}
                                nameWidth={nameWidth}
                                assigneeWidth={assigneeWidth}
                                checked={!!checkedIds[`p-${project.id}`]}
                                onToggleCheck={() => toggleCheckProject(project)}
                                onToggleExpand={() => setExpandedProjects(p => ({ ...p, [project.id]: !(p[project.id] !== false) }))}
                                expanded={expandedProjects[project.id] !== false}
                                onUpdateField={handleUpdate}
                                onAddTask={() => handleAddTask(project.id)}
                                onEditDetail={() => openDetailModal('project', project)}
                                initialData={initialData}
                                provided={provided}
                                hidePlanningColumns={hidePlanningColumns}
                                isPlanningMode={isPlanningMode}
                              />
                              {rowProvided.placeholder}
                            </div>
                          )}
                        </Droppable>

                        {expandedProjects[project.id] !== false && (
                          <Droppable droppableId={`project-${project.id}`} type="TASK">
                            {(listProvided, listSnapshot) => (
                              <div 
                                {...listProvided.droppableProps} 
                                ref={listProvided.innerRef}
                                className={listSnapshot.isDraggingOver ? 'bg-blue-50/30 dark:bg-blue-900/10 min-h-[4px]' : ''}
                              >
                                {project.tasks.map((task, tIndex) => (
                                  <Draggable key={`t-${task.id}`} draggableId={`t-${task.id}`} index={tIndex}>
                                    {(provided) => (
                                      <div ref={provided.innerRef} {...provided.draggableProps} data-wbs-id={`t-${task.id}`}>
                                        <Droppable droppableId={`task-row-drop-${task.id}`} type="SUBTASK">
                                          {(rowProvided, rowSnapshot) => (
                                            <div 
                                              {...rowProvided.droppableProps} 
                                              ref={rowProvided.innerRef}
                                              className={`transition-all ${rowSnapshot.isDraggingOver ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/20 dark:bg-blue-900/20' : ''}`}
                                            >
                                              <TaskRow
                                                task={task}
                                                nameWidth={nameWidth}
                                                assigneeWidth={assigneeWidth}
                                                checked={!!checkedIds[`t-${task.id}`]}
                                                onToggleCheck={() => toggleCheckTask(task)}
                                                onToggleExpand={() => setExpandedTasks(t => ({ ...t, [task.id]: !(t[task.id] !== false) }))}
                                                expanded={expandedTasks[task.id] !== false}
                                                onUpdateField={handleUpdate}
                                                onAddSubtask={() => handleAddSubtask(task.id)}
                                                onEditDetail={() => openDetailModal('task', task)}
                                                initialData={initialData}
                                                provided={provided}
                                                hidePlanningColumns={hidePlanningColumns}
                                                isPlanningMode={isPlanningMode}
                                              />
                                              {rowProvided.placeholder}
                                            </div>
                                          )}
                                        </Droppable>

                                        {expandedTasks[task.id] !== false && (
                                          <Droppable droppableId={`task-${task.id}`} type="SUBTASK">
                                            {(listProvided, listSnapshot) => (
                                              <div 
                                                {...listProvided.droppableProps} 
                                                ref={listProvided.innerRef}
                                                className={listSnapshot.isDraggingOver ? 'bg-blue-50/30 dark:bg-blue-900/10 min-h-[4px]' : ''}
                                              >
                                                {task.subtasks.map((subtask, sIndex) => (
                                                  <Draggable key={`s-${subtask.id}`} draggableId={`s-${subtask.id}`} index={sIndex}>
                                                    {(provided) => (
                                                      <div ref={provided.innerRef} {...provided.draggableProps} data-wbs-id={`s-${subtask.id}`}>
                                                        <SubtaskRow
                                                          subtask={subtask}
                                                          nameWidth={nameWidth}
                                                          assigneeWidth={assigneeWidth}
                                                          checked={!!checkedIds[`s-${subtask.id}`]}
                                                          onToggleCheck={() => toggleCheckSubtask(subtask.id)}
                                                          initialData={initialData}
                                                          onUpdateField={handleUpdate}
                                                          onEditDetail={() => openDetailModal('subtask', subtask)}
                                                          provided={provided}
                                                          hidePlanningColumns={hidePlanningColumns}
                                                          isPlanningMode={isPlanningMode}
                                                        />
                                                      </div>
                                                    )}
                                                  </Draggable>
                                                ))}
                                                {listProvided.placeholder}
                                              </div>
                                            )}
                                          </Droppable>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {listProvided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
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
