import type { MstSubtaskType } from '../../types';
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon, sectionIconStyle, GpIcon } from './icons';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface NewSubtaskType {
  type_name: string;
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
}: SubtaskTypeSectionProps) {
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
              onChange={e => setNewSubtaskType({ type_name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createSubtaskType()}
              autoFocus
            />
            <button className="master-confirm-btn" onClick={createSubtaskType}><CheckIcon /></button>
            <button className="master-cancel-btn" onClick={() => setShowAddSubtaskType(false)}><XIcon /></button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="subtask-types-list" direction="horizontal">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className="master-list master-list-chips"
            >
              {subtaskTypes.map((t, index) => (
                <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`master-chip master-chip-blue ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      {isEditing(t.id, 'subtask_type') ? (
                        <div className="master-edit-inline" {...(snapshot.isDragging ? { onClick: (e) => e.stopPropagation() } : {})}>
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
                        <>
                          <div className="master-drag-handle opacity-40">
                            <GpIcon />
                          </div>
                          <div className="master-chip-main">
                            <span className="master-chip-text">{t.type_name}</span>
                            <div className="master-chip-actions">
                              <button className="master-chip-btn" onClick={() => startEdit(t.id, 'subtask_type', t.type_name)} title="編集"><PencilIcon /></button>
                              <button className="master-chip-btn master-chip-btn-del" onClick={() => deleteItem('/masters/subtask-types', t.id, t.type_name)} title="削除"><TrashIcon /></button>
                            </div>
                          </div>
                        </>
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
    </section>
  );
}
