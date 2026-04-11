import React from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Project, Task, Subtask } from '../../types/wbs';
import { InitialData } from '../../types';
import ProjectRow from './ProjectRow';
import TaskRow from './TaskRow';
import SubtaskRow from './SubtaskRow';

interface WBSTreeRowsProps {
  projects: Project[];
  initialData: InitialData | null;
  expandedProjects: Record<number, boolean>;
  expandedTasks: Record<number, boolean>;
  checkedIds: Record<string, boolean>;
  nameWidth: number;
  assigneeWidth: number;
  hidePlanningColumns: boolean;
  isPlanningMode: boolean;
  focusedField: { rowId: string; field: string } | null;
  onToggleCheckProject: (project: Project, isShift?: boolean) => void;
  onToggleCheckTask: (task: Task, isShift?: boolean) => void;
  onToggleCheckSubtask: (subtaskId: number, isShift?: boolean) => void;
  onToggleExpandProject: (id: number, recursive?: boolean) => void;
  onToggleExpandTask: (id: number, recursive?: boolean) => void;
  onUpdateField: (type: any, id: number, field: string, value: any) => Promise<void>;
  onAddTask: (projectId: number) => Promise<void>;
  onAddSubtask: (taskId: number) => Promise<void>;
  onEditDetail: (type: any, data: any) => void;
  onFocusChange: (rowId: string, field: string) => void;
  onEditingChange: (isEditing: boolean) => void;
  isEditing: boolean;
  onTabNavigation?: (direction: 'next' | 'prev', autoEdit: boolean) => void;
}

const WBSTreeRows: React.FC<WBSTreeRowsProps> = ({
  projects,
  initialData,
  expandedProjects,
  expandedTasks,
  checkedIds,
  nameWidth,
  assigneeWidth,
  hidePlanningColumns,
  isPlanningMode,
  focusedField,
  onToggleCheckProject,
  onToggleCheckTask,
  onToggleCheckSubtask,
  onToggleExpandProject,
  onToggleExpandTask,
  onUpdateField,
  onAddTask,
  onAddSubtask,
  onEditDetail,
  onFocusChange,
  onEditingChange,
  isEditing,
  onTabNavigation
}) => {
  return (
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
                          onToggleCheck={onToggleCheckProject}
                          onToggleExpand={onToggleExpandProject}
                          expanded={expandedProjects[project.id] !== false}
                          onUpdateField={onUpdateField}
                          onAddTask={onAddTask}
                          onEditDetail={onEditDetail}
                          initialData={initialData}
                          provided={provided}
                          hidePlanningColumns={hidePlanningColumns}
                          isPlanningMode={isPlanningMode}
                          focusedField={focusedField?.rowId === `p-${project.id}` ? (focusedField.field as any) : null}
                          onFocusChange={onFocusChange}
                          onEditingChange={onEditingChange}
                          isEditing={isEditing}
                          onTabNavigation={onTabNavigation}
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
                                          onToggleCheck={onToggleCheckTask}
                                          onToggleExpand={onToggleExpandTask}
                                          expanded={expandedTasks[task.id] !== false}
                                          onUpdateField={onUpdateField}
                                          onAddSubtask={onAddSubtask}
                                          onEditDetail={onEditDetail}
                                          initialData={initialData}
                                          provided={provided}
                                          hidePlanningColumns={hidePlanningColumns}
                                          isPlanningMode={isPlanningMode}
                                          focusedField={focusedField?.rowId === `t-${task.id}` ? (focusedField.field as any) : null}
                                          onFocusChange={onFocusChange}
                                          onEditingChange={onEditingChange}
                                          isEditing={isEditing}
                                          onTabNavigation={onTabNavigation}
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
                                                    onToggleCheck={onToggleCheckSubtask}
                                                    initialData={initialData}
                                                    onUpdateField={onUpdateField}
                                                    onEditDetail={onEditDetail}
                                                    provided={provided}
                                                    hidePlanningColumns={hidePlanningColumns}
                                                    isPlanningMode={isPlanningMode}
                                                    focusedField={focusedField?.rowId === `s-${subtask.id}` ? (focusedField.field as any) : null}
                                                    onFocusChange={onFocusChange}
                                                    onEditingChange={onEditingChange}
                                                    isEditing={isEditing}
                                                    onTabNavigation={onTabNavigation}
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
  );
};

export default React.memo(WBSTreeRows);
