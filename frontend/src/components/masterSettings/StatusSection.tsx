import type { MstStatus } from '../../types';
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon, sectionIconStyle } from './icons';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { GpIcon } from './icons';

interface NewStatus {
  status_name: string;
  color_code: string;
}

interface StatusSectionProps {
  statuses: MstStatus[];
  showAddStatus: boolean;
  setShowAddStatus: (value: boolean) => void;
  newStatus: NewStatus;
  setNewStatus: (value: NewStatus) => void;
  createStatus: () => void;
  isEditing: (id: number, field: string) => boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  editColorValue: string;
  setEditColorValue: (value: string) => void;
  saveEdit: (endpoint: string, id: number, payload: Record<string, unknown>) => void;
  cancelEdit: () => void;
  startEdit: (id: number, field: string, currentValue: string, colorValue?: string) => void;
  deleteItem: (endpoint: string, id: number, name: string) => void;
  onDragEnd: (result: DropResult) => void;
}

export function StatusSection({
  statuses,
  showAddStatus,
  setShowAddStatus,
  newStatus,
  setNewStatus,
  createStatus,
  isEditing,
  editValue,
  setEditValue,
  editColorValue,
  setEditColorValue,
  saveEdit,
  cancelEdit,
  startEdit,
  deleteItem,
  onDragEnd,
}: StatusSectionProps) {
  return (
    <section className="master-section">
      <div className="master-section-header">
        <h3 className="master-section-title">
          <span className="master-section-icon" style={sectionIconStyle('linear-gradient(135deg, #6366f1, #8b5cf6)')}>S</span>
          ステータス一覧
        </h3>
        <button className="master-add-btn" onClick={() => setShowAddStatus(!showAddStatus)} title="新規追加">
          <PlusIcon />
        </button>
      </div>

      {showAddStatus && (
        <div className="master-add-form">
          <div className="master-add-form-row">
            <input
              type="text"
              className="master-input"
              placeholder="ステータス名"
              value={newStatus.status_name}
              onChange={e => setNewStatus({ ...newStatus, status_name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createStatus()}
              autoFocus
            />
            <input
              type="color"
              className="master-color-input"
              value={newStatus.color_code}
              onChange={e => setNewStatus({ ...newStatus, color_code: e.target.value })}
            />
            <button className="master-confirm-btn" onClick={createStatus}><CheckIcon /></button>
            <button className="master-cancel-btn" onClick={() => setShowAddStatus(false)}><XIcon /></button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="statuses-list">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className="master-list"
            >
              {statuses.map((s, index) => (
                <Draggable key={s.id} draggableId={s.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`master-list-item ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <div className="master-list-item-content">
                        <div {...provided.dragHandleProps} className="master-drag-handle mr-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                          <GpIcon />
                        </div>
                        <span className="master-color-dot" style={{ backgroundColor: s.color_code }}></span>
                        {isEditing(s.id, 'status') ? (
                          <div className="master-edit-inline">
                            <input
                              className={`master-input master-input-sm ${s.is_system_reserved ? 'cursor-not-allowed opacity-75' : ''}`}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit('/masters/statuses', s.id, { status_name: editValue, color_code: editColorValue });
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              disabled={s.is_system_reserved}
                              title={s.is_system_reserved ? 'システム予約ステータスの名称は変更できません' : ''}
                              autoFocus
                            />
                            <input
                              type="color"
                              className="master-color-input"
                              value={editColorValue}
                              onChange={e => setEditColorValue(e.target.value)}
                            />
                            <button className="master-confirm-btn" onClick={() => saveEdit('/masters/statuses', s.id, { status_name: editValue, color_code: editColorValue })}>
                              <CheckIcon />
                            </button>
                            <button className="master-cancel-btn" onClick={cancelEdit}><XIcon /></button>
                          </div>
                        ) : (
                          <span className="master-item-name">{s.status_name}</span>
                        )}
                      </div>
                      {!isEditing(s.id, 'status') && (
                        <div className="master-actions">
                          <button className="master-action-btn master-edit" onClick={() => startEdit(s.id, 'status', s.status_name, s.color_code)} title="編集">
                            <PencilIcon />
                          </button>
                          {!s.is_system_reserved && (
                            <button className="master-action-btn master-delete" onClick={() => deleteItem('/masters/statuses', s.id, s.status_name)} title="削除">
                              <TrashIcon />
                            </button>
                          )}
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
    </section>
  );
}
