import React from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Check, Hash, MessageSquare, ExternalLink, FolderKanban, ListTodo, AlignLeft } from 'lucide-react';

export type EditingType = 'project' | 'task' | 'subtask';

interface DetailModalProps {
  editingType: EditingType;
  editingName: string;
  detailValue: string;
  setDetailValue: (v: string) => void;
  ticketIdValue: string;
  setTicketIdValue: (v: string) => void;
  memoValue: string;
  setMemoValue: (v: string) => void;
  ticketUrlTemplate?: string | null;
  onClose: () => void;
  onSave: () => void;
}

const TYPE_LABELS: Record<EditingType, { label: string; icon: React.ReactNode }> = {
  project: { label: 'プロジェクト', icon: <FolderKanban size={18} className="text-violet-500" /> },
  task:    { label: 'タスク',       icon: <ListTodo size={18} className="text-blue-500" /> },
  subtask: { label: 'サブタスク',   icon: <AlignLeft size={18} className="text-teal-500" /> },
};

const DetailModal = ({
  editingType,
  editingName,
  detailValue,
  setDetailValue,
  ticketIdValue,
  setTicketIdValue,
  memoValue,
  setMemoValue,
  ticketUrlTemplate,
  onClose,
  onSave,
}: DetailModalProps) => {
  const ticketUrl = ticketUrlTemplate && ticketIdValue
    ? ticketUrlTemplate.replace('{TICKET_ID}', ticketIdValue)
    : null;

  const { label, icon } = TYPE_LABELS[editingType];

  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <FileText size={18} className="text-gray-500" />
            詳細情報の編集
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Target label */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 border-b text-sm text-gray-600">
          {icon}
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
          <span className="font-medium text-gray-700 truncate" title={editingName}>{editingName}</span>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">

          {/* detail */}
          <div>
            <label className="block mb-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <div className="w-1 h-3 bg-blue-500 rounded-full" />
              詳細 <span className="text-gray-400 font-normal normal-case">(1行テキスト)</span>
            </label>
            <input
              id="modal-detail-input"
              type="text"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 font-medium"
              value={detailValue}
              autoFocus
              onFocus={(e) => e.target.select()}
              onChange={(e) => setDetailValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSave();
              }}
              placeholder="詳細を入力してください..."
            />
          </div>

          {/* ticket_id */}
          <div>
            <label className="block mb-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <Hash size={12} className="text-indigo-500" />
              チケットID
              {ticketUrl && (
                <a
                  href={ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 normal-case tracking-normal transition-colors"
                >
                  <ExternalLink size={11} />
                  チケットを開く
                </a>
              )}
            </label>
            <input
              id="modal-ticket-id-input"
              type="text"
              inputMode="numeric"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 font-medium"
              value={ticketIdValue}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '');
                setTicketIdValue(v);
              }}
              placeholder="チケットIDを入力..."
            />
            {ticketUrl && (
              <p className="mt-1 text-xs text-gray-400 truncate px-1" title={ticketUrl}>
                🔗 {ticketUrl}
              </p>
            )}
          </div>

          {/* memo */}
          <div>
            <label className="block mb-1.5 text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
              <MessageSquare size={12} className="text-blue-500" />
              メモ <span className="text-gray-400 font-normal normal-case">(複数行)</span>
            </label>
            <textarea
              id="modal-memo-input"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm transition-all shadow-inner bg-gray-50/50 font-medium resize-none"
              value={memoValue}
              onChange={(e) => setMemoValue(e.target.value)}
              placeholder="メモを入力してください..."
              rows={4}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t items-center">
          <div className="flex-1 text-xs text-gray-400 italic">保存すると即座に反映されます</div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-white hover:border-gray-200 border border-transparent rounded-lg transition-all"
          >
            キャンセル
          </button>
          <button
            id="modal-save-button"
            onClick={onSave}
            className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-200 transition-all active:scale-95"
          >
            <Check size={16} />
            保存する
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DetailModal;
