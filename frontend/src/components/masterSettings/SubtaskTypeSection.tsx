import type { MstSubtaskType } from '../../types';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, TrashIcon, XIcon, sectionIconStyle, GpIcon } from './icons';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface NewSubtaskType {
  type_name: string;
  azure_devops_work_item_type: string;
}

interface SubtaskTypeSectionProps {
  subtaskTypes: MstSubtaskType[];
  showAddSubtaskType: boolean;
  setShowAddSubtaskType: (value: boolean) => void;
  newSubtaskType: NewSubtaskType;
  setNewSubtaskType: (value: NewSubtaskType) => void;
  createSubtaskType: () => void;
  isEditing: (id: number, field: string) => boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  saveEdit: (endpoint: string, id: number, payload: Record<string, unknown>) => void;
  cancelEdit: () => void;
  startEdit: (id: number, field: string, currentValue: string, colorValue?: string) => void;
  deleteItem: (endpoint: string, id: number, name: string) => void;
  onDragEnd: (result: DropResult) => void;
  isSubtaskTypeListExpanded: boolean;
  setIsSubtaskTypeListExpanded: (value: boolean) => void;
}

export function SubtaskTypeSection({
  subtaskTypes,
  showAddSubtaskType,
  setShowAddSubtaskType,
  newSubtaskType,
  setNewSubtaskType,
  createSubtaskType,
  isEditing,
  editValue,
  setEditValue,
  saveEdit,
  cancelEdit,
  startEdit,
  deleteItem,
  onDragEnd,
  isSubtaskTypeListExpanded,
  setIsSubtaskTypeListExpanded,
}: SubtaskTypeSectionProps) {
  const displayedSubtaskTypes = isSubtaskTypeListExpanded ? subtaskTypes : subtaskTypes.slice(0, 8);

  return (
    <section className="master-section">
      <div className="master-section-header">
        <h3 className="master-section-title">
          <span className="master-section-icon" style={sectionIconStyle('linear-gradient(135deg, #3b82f6, #06b6d4)')}>T</span>
          サブタスク種別一覧
        </h3>
        <button className="master-add-btn" onClick={() => setShowAddSubtaskType(!showAddSubtaskType)} title="新規追加">
          <PlusIcon />
        </button>
      </div>

      {showAddSubtaskType && (
        <div className="master-add-form">
          <div className="master-add-form-row">
            <input
              type="text"
              className="master-input"
              placeholder="種別名"
              value={newSubtaskType.type_name}
              onChange={e => setNewSubtaskType({ ...newSubtaskType, type_name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createSubtaskType()}
              autoFocus
            />
            <input
              type="text"
              className="master-input master-subtask-work-item-type-input"
              placeholder="Work Item Type"
              value={newSubtaskType.azure_devops_work_item_type}
              onChange={e => setNewSubtaskType({ ...newSubtaskType, azure_devops_work_item_type: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createSubtaskType()}
              title="候補絞り込みに使うAzure DevOpsのWork Item Type"
            />
            <button className="master-confirm-btn" onClick={createSubtaskType}><CheckIcon /></button>
            <button className="master-cancel-btn" onClick={() => setShowAddSubtaskType(false)}><XIcon /></button>
          </div>
        </div>
      )}

      <div className="master-subtask-type-list-header" aria-hidden="true">
        <span>種別</span>
        <span>Azure DevOps Work Item Type</span>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="subtask-types-list">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className="master-list"
            >
              {displayedSubtaskTypes.map((t, index) => (
                <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`master-list-item master-subtask-type-row master-sortable-chip-row ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <div className="master-list-item-content master-sortable-chip-content">
                        <div {...provided.dragHandleProps} className="master-drag-handle mr-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                          <GpIcon />
                        </div>
                        {isEditing(t.id, 'subtask_type') ? (
                          <div className="master-edit-inline">
                            <input
                              className="master-input master-input-sm"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit('/masters/subtask-types', t.id, { type_name: editValue });
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              autoFocus
                            />
                            <button className="master-confirm-btn" onClick={() => saveEdit('/masters/subtask-types', t.id, { type_name: editValue })}>
                              <CheckIcon />
                            </button>
                            <button className="master-cancel-btn" onClick={cancelEdit}><XIcon /></button>
                          </div>
                        ) : (
                          <span className="master-chip master-chip-blue master-chip-static">
                            <span className="master-chip-text">{t.type_name}</span>
                          </span>
                        )}
                      </div>
                      {!isEditing(t.id, 'subtask_type') && (
                        <input
                          type="text"
                          className="master-input master-subtask-work-item-type-input"
                          defaultValue={t.azure_devops_work_item_type ?? ''}
                          placeholder="未設定"
                          title="候補絞り込みに使うAzure DevOpsのWork Item Type"
                          onMouseDown={e => e.stopPropagation()}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                            if (e.key === 'Escape') {
                              e.currentTarget.value = t.azure_devops_work_item_type ?? '';
                              e.currentTarget.blur();
                            }
                          }}
                          onBlur={e => {
                            const nextType = e.currentTarget.value.trim();
                            const currentType = t.azure_devops_work_item_type ?? '';
                            if (nextType !== currentType) {
                              saveEdit('/masters/subtask-types', t.id, { azure_devops_work_item_type: nextType || null });
                            }
                          }}
                        />
                      )}
                      {!isEditing(t.id, 'subtask_type') && (
                        <div className="master-actions">
                          <button className="master-action-btn master-edit" onClick={() => startEdit(t.id, 'subtask_type', t.type_name)} title="編集"><PencilIcon /></button>
                          <button className="master-action-btn master-delete" onClick={() => deleteItem('/masters/subtask-types', t.id, t.type_name)} title="削除"><TrashIcon /></button>
                        </div>
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

      {subtaskTypes.length > 8 && (
        <button
          className="master-list-expand-btn"
          onClick={() => setIsSubtaskTypeListExpanded(!isSubtaskTypeListExpanded)}
        >
          {isSubtaskTypeListExpanded ? (
            <>
              <ChevronUpIcon />
              閉じる
            </>
          ) : (
            <>
              <ChevronDownIcon />
              すべての種別を表示 ({subtaskTypes.length}件)
            </>
          )}
        </button>
      )}
    </section>
  );
}
