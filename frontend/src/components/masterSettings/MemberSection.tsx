import type { MstMember } from '../../types';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, TrashIcon, XIcon, sectionIconStyle, GpIcon } from './icons';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface NewMember {
  member_name: string;
  color_code: string;
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
  editColorValue: string;
  setEditColorValue: (value: string) => void;
  saveEdit: (endpoint: string, id: number, payload: Record<string, unknown>) => void;
  cancelEdit: () => void;
  startEdit: (id: number, field: string, currentValue: string, colorValue?: string) => void;
  deleteItem: (endpoint: string, id: number, name: string) => void;
  onDragEnd: (result: DropResult) => void;
  isMemberListExpanded: boolean;
  setIsMemberListExpanded: (value: boolean) => void;
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
  editColorValue,
  setEditColorValue,
  saveEdit,
  cancelEdit,
  startEdit,
  deleteItem,
  onDragEnd,
  isMemberListExpanded,
  setIsMemberListExpanded,
}: MemberSectionProps) {
  const displayedMembers = isMemberListExpanded ? members : members.slice(0, 8);

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
              onChange={e => setNewMember({ ...newMember, member_name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && createMember()}
              autoFocus
            />
            <input
              type="color"
              className="master-color-input"
              value={newMember.color_code}
              onChange={e => setNewMember({ ...newMember, color_code: e.target.value })}
              title="担当者色"
            />
            <button className="master-confirm-btn" onClick={createMember}><CheckIcon /></button>
            <button className="master-cancel-btn" onClick={() => setShowAddMember(false)}><XIcon /></button>
          </div>
        </div>
      )}

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="members-list">
          {(provided) => (
            <div 
              {...provided.droppableProps} 
              ref={provided.innerRef} 
              className="master-list"
            >
              {displayedMembers.map((m, index) => (
                <Draggable key={m.id} draggableId={m.id.toString()} index={index}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`master-list-item master-sortable-chip-row ${snapshot.isDragging ? 'dragging' : ''}`}
                    >
                      <div className="master-list-item-content master-sortable-chip-content">
                        <div {...provided.dragHandleProps} className="master-drag-handle mr-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                          <GpIcon />
                        </div>
                        <span className="master-color-dot" style={{ backgroundColor: m.color_code }}></span>
                        {isEditing(m.id, 'member') ? (
                          <div className="master-edit-inline">
                            <input
                              className="master-input master-input-sm"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveEdit('/masters/members', m.id, { member_name: editValue, color_code: editColorValue });
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              autoFocus
                            />
                            <input
                              type="color"
                              className="master-color-input"
                              value={editColorValue}
                              onChange={e => setEditColorValue(e.target.value)}
                              title="担当者色"
                            />
                            <button className="master-confirm-btn" onClick={() => saveEdit('/masters/members', m.id, { member_name: editValue, color_code: editColorValue })}>
                              <CheckIcon />
                            </button>
                            <button className="master-cancel-btn" onClick={cancelEdit}><XIcon /></button>
                          </div>
                        ) : (
                          <span className="master-item-name">{m.member_name}</span>
                        )}
                      </div>
                      {!isEditing(m.id, 'member') && (
                        <div className="master-actions">
                          <button className="master-action-btn master-edit" onClick={() => startEdit(m.id, 'member', m.member_name, m.color_code)} title="編集"><PencilIcon /></button>
                          <button className="master-action-btn master-delete" onClick={() => deleteItem('/masters/members', m.id, m.member_name)} title="削除"><TrashIcon /></button>
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

      {members.length > 8 && (
        <button
          className="master-list-expand-btn"
          onClick={() => setIsMemberListExpanded(!isMemberListExpanded)}
        >
          {isMemberListExpanded ? (
            <>
              <ChevronUpIcon />
              閉じる
            </>
          ) : (
            <>
              <ChevronDownIcon />
              すべての担当者を表示 ({members.length}件)
            </>
          )}
        </button>
      )}
    </section>
  );
}
