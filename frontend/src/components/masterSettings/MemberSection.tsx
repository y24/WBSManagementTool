import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AzureDevOpsUser, MstMember } from '../../types';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, SyncIcon, TrashIcon, XIcon, sectionIconStyle, GpIcon } from './icons';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Check, ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react';

interface NewMember {
  member_name: string;
  color_code: string;
}

type ResourceViewMode = 'visible' | 'load_rate_off' | 'hidden';

interface MemberSectionProps {
  members: MstMember[];
  devOpsUsers: AzureDevOpsUser[];
  isFetchingDevOpsUsers: boolean;
  refreshDevOpsUsers: () => void;
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

interface DevOpsAccountSelectProps {
  value: string | null | undefined;
  displayName: string | null | undefined;
  users: AzureDevOpsUser[];
  isFetchingUsers: boolean;
  onRefreshUsers: () => void;
  onChange: (user: AzureDevOpsUser | null) => void;
}

function DevOpsAccountSelect({
  value,
  displayName,
  users,
  isFetchingUsers,
  onRefreshUsers,
  onChange,
}: DevOpsAccountSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, direction: 'down' as 'up' | 'down' });
  const selectedUser = users.find(user => user.unique_name === value);
  const selectedLabel = selectedUser?.display_name || displayName || value || '未設定';

  const filteredUsers = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter(user => (
      user.display_name.toLowerCase().includes(normalized) ||
      user.unique_name.toLowerCase().includes(normalized) ||
      (user.mail_address ?? '').toLowerCase().includes(normalized)
    ));
  }, [searchTerm, users]);

  const openDropdown = () => {
    if (isFetchingUsers) return;
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownWidth = Math.max(rect.width, 320);
      const estimatedHeight = 320;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const direction = spaceBelow < estimatedHeight && spaceAbove > spaceBelow ? 'up' : 'down';
      let left = rect.left + window.scrollX;
      if (rect.left + dropdownWidth > viewportWidth - 20) {
        left = Math.max(10, rect.right + window.scrollX - dropdownWidth);
      }
      setCoords({
        top: direction === 'down' ? rect.bottom + window.scrollY : rect.top + window.scrollY,
        left,
        width: dropdownWidth,
        direction,
      });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleEvents = (e: Event) => {
      if (e.type === 'mousedown' && e.target instanceof Node) {
        if (dropdownRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) {
          return;
        }
      }
      if (e.type === 'scroll' && dropdownRef.current?.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('mousedown', handleEvents, true);
    window.addEventListener('scroll', handleEvents, true);
    window.addEventListener('resize', handleEvents);
    return () => {
      window.removeEventListener('mousedown', handleEvents, true);
      window.removeEventListener('scroll', handleEvents, true);
      window.removeEventListener('resize', handleEvents);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => window.clearTimeout(timer);
    }
    setSearchTerm('');
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="master-devops-account-select"
        disabled={isFetchingUsers}
        onMouseDown={e => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          isOpen ? setIsOpen(false) : openDropdown();
        }}
        title={users.length === 0 ? '右上の更新ボタンでAzure DevOpsユーザーを取得してください' : 'Azure DevOpsのAssigned Toに同期するアカウント'}
      >
        <span className={value ? 'master-devops-account-label' : 'master-devops-account-placeholder'}>
          {selectedLabel}
        </span>
        <ChevronDown size={14} className="master-devops-account-chevron" />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[9999] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xl rounded-xl py-2 overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
          style={{
            top: coords.direction === 'down' ? coords.top + 6 : coords.top - 6,
            left: coords.left,
            width: coords.width,
            transform: coords.direction === 'up' ? 'translateY(-100%)' : 'none',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 pb-2 mb-2 border-b border-gray-50 dark:border-slate-800">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">Azure DevOps</span>
            {value && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                  setIsOpen(false);
                }}
                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-tight"
              >
                クリア
              </button>
            )}
          </div>

          <div className="px-3 pb-2 mb-2 border-b border-gray-50 dark:border-slate-800">
            <div className="relative group/search">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-blue-500 transition-colors pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="名前・メールで検索..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100 dark:border-slate-700/50 rounded-lg focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 dark:text-slate-200 transition-all font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto overscroll-contain px-1">
            {filteredUsers.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs text-gray-400 dark:text-slate-500 font-medium">一致するユーザーがありません</p>
                {users.length === 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshUsers();
                    }}
                    disabled={isFetchingUsers}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 shadow-sm transition-colors hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-700 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <SyncIcon />
                    {isFetchingUsers ? '取得中...' : 'DevOpsユーザー一覧を取得'}
                  </button>
                )}
              </div>
            ) : filteredUsers.map(user => {
              const selected = user.unique_name === value;
              return (
                <button
                  key={user.descriptor}
                  type="button"
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${selected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(user);
                    setIsOpen(false);
                  }}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shadow-sm ${selected ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600'}`}>
                    {selected && <Check size={10} className="text-white stroke-[3px]" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs truncate ${selected ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-slate-300 font-medium'}`}>
                      {user.display_name}
                    </div>
                    <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">
                      {user.unique_name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const getResourceViewMode = (member: MstMember): ResourceViewMode => {
  if (member.resource_view_mode) return member.resource_view_mode;
  return member.exclude_from_resource_view ? 'hidden' : 'visible';
};

export function MemberSection({
  members,
  devOpsUsers,
  isFetchingDevOpsUsers,
  refreshDevOpsUsers,
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

      <div className="master-member-list-header" aria-hidden="true">
        <span>担当者</span>
        <span>メニュー表示</span>
        <span>Azure DevOps ユーザー</span>
        <span>担当者ビュー表示</span>
      </div>

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
                        <button
                          type="button"
                          className={`master-choice-toggle ${m.show_in_choices ? 'active' : 'inactive'}`}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={() => saveEdit('/masters/members', m.id, { show_in_choices: !m.show_in_choices })}
                          title={m.show_in_choices ? 'プルダウン等の選択肢に表示中' : 'プルダウン等の選択肢では非表示'}
                          aria-label={`${m.member_name}を選択肢に${m.show_in_choices ? '表示しない' : '表示する'}`}
                        >
                          {m.show_in_choices ? <Eye size={14} /> : <EyeOff size={14} />}
                          <span>{m.show_in_choices ? '表示' : '非表示'}</span>
                        </button>
                      )}
                      {!isEditing(m.id, 'member') && (
                        <DevOpsAccountSelect
                          value={m.azure_devops_unique_name}
                          displayName={m.azure_devops_display_name}
                          users={devOpsUsers}
                          isFetchingUsers={isFetchingDevOpsUsers}
                          onRefreshUsers={refreshDevOpsUsers}
                          onChange={(user) => {
                            saveEdit('/masters/members', m.id, {
                              azure_devops_unique_name: user?.unique_name ?? null,
                              azure_devops_display_name: user?.display_name ?? null,
                            });
                          }}
                        />
                      )}
                      {!isEditing(m.id, 'member') && (
                        <select
                          className="master-resource-view-mode-select"
                          title="担当者ビューでの表示と稼働率計算"
                          onMouseDown={e => e.stopPropagation()}
                          value={getResourceViewMode(m)}
                          onChange={e => saveEdit('/masters/members', m.id, { resource_view_mode: e.target.value })}
                          aria-label={`${m.member_name}の担当者ビュー設定`}
                        >
                          <option value="visible">表示する</option>
                          <option value="load_rate_off">表示する・稼働率計算OFF</option>
                          <option value="hidden">非表示</option>
                        </select>
                      )}
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
