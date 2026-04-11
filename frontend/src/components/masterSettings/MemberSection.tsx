import type { MstMember } from '../../types';
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon, XIcon, sectionIconStyle, GpIcon } from './icons';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface NewMember {
  member_name: string;
}

interface MemberSectionProps {
  members: MstMember[];
  showAddMember: boolean;
  setShowAddMember: (value: boolean) => void;
  newMember: NewMember;
  setNewMember: (value: NewMember) => void;
  createMember: () => void;
  isEditing: (id: number, field: string) => boolean;
  editValue: string;
  setEditValue: (value: string) => void;
  saveEdit: (endpoint: string, id: number, payload: Record<string, unknown>) => void;
  cancelEdit: () => void;
  startEdit: (id: number, field: string, currentValue: string, colorValue?: string) => void;
  deleteItem: (endpoint: string, id: number, name: string) => void;
  onDragEnd: (result: DropResult) => void;
}

export function MemberSection({
  members,
  showAddMember,
  setShowAddMember,
  newMember,
  setNewMember,
  createMember,
  isEditing,
  editValue,
  setEditValue,
  saveEdit,
  cancelEdit,
  startEdit,
  deleteItem,
  onDragEnd,
}: MemberSectionProps) {
  return (
    <section className="master-section">
      <div className="master-section-header">
        <h3 className="master-section-title">
          <span className="master-section-icon" style={sectionIconStyle('linear-gradient(135deg, #10b981, #059669)')}>M</span>
          担当者一覧
        </h3>
        <button className="master-add-btn" onClick={() => setShowAddMember(!showAddMember)} title="新規追加">
          <PlusIcon />
        </button>
      </div>

      {showAddMember && (
        <div className="master-add-form">
          <div className="master-add-form-row">
            <input
              type="text"
              className="master-input"
              placeholder="担当者名"
              value={newMember.member_name}
              onChange={e => setNewMember({ member_name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createMember()}
              autoFocus
            />
            <button className="master-confirm-btn" onClick={createMember}><CheckIcon /></button>
            <button className="master-cancel-btn" onClick={() => setShowAddMember(false)}><XIcon /></button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="members-list" direction="horizontal">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className="master-list master-list-chips"
            >
              {members.map((m, index) => (
                <Draggable key={m.id} draggableId={m.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`master-chip master-chip-green ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      {isEditing(m.id, 'member') ? (
                        <div className="master-edit-inline" {...(snapshot.isDragging ? { onClick: (e) => e.stopPropagation() } : {})}>
                          <input
                            className="master-input master-input-sm"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveEdit('/masters/members', m.id, { member_name: editValue });
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                          />
                          <button className="master-confirm-btn" onClick={() => saveEdit('/masters/members', m.id, { member_name: editValue })}>
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
                            <span className="master-chip-text">{m.member_name}</span>
                            <div className="master-chip-actions">
                              <button className="master-chip-btn" onClick={() => startEdit(m.id, 'member', m.member_name)} title="編集"><PencilIcon /></button>
                              <button className="master-chip-btn master-chip-btn-del" onClick={() => deleteItem('/masters/members', m.id, m.member_name)} title="削除"><TrashIcon /></button>
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
