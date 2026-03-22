import React from 'react';
import { createPortal } from 'react-dom';
import { Pencil, X, Check } from 'lucide-react';
import { Subtask } from '../../types/wbs';

interface DetailModalProps {
  editingSubtask: Subtask;
  detailValue: string;
  setDetailValue: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const DetailModal = ({ editingSubtask, detailValue, setDetailValue, onClose, onSave }: DetailModalProps) => {
  return createPortal(
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Pencil size={18} className="text-blue-500" />
            サブタスクの詳細
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <div className="mb-3 text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
            サブタスクの詳細 (1行)
          </div>
          <input
            type="text"
            className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 font-medium"
            value={detailValue}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDetailValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSave();
              }
            }}
            placeholder="詳細を入力してください..."
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t items-center">
          <div className="flex-1 text-xs text-gray-400 italic">保存すると即座に反映されます</div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-white hover:border-gray-200 border border-transparent rounded-lg transition-all"
          >
            キャンセル
          </button>
          <button
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
