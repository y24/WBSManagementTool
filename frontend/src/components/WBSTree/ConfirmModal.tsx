import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  totalCount: number;
  detailMsg: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal = ({ isOpen, totalCount, detailMsg, onConfirm, onCancel }: ConfirmModalProps) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50/30">
          <h3 className="font-bold text-red-600 flex items-center gap-2">
            <AlertTriangle size={20} />
            項目の削除確認
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-full"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600">
            <Trash2 size={32} />
          </div>
          <h4 className="text-xl font-bold text-gray-800 mb-2">
            {totalCount}件の項目を削除しますか？
          </h4>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed whitespace-pre-wrap">
            {detailMsg}
            {"\n\n"}この操作は取り消せません。本当によろしいですか？
          </p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-3 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all"
            >
              キャンセル
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-200 transition-all active:scale-95"
            >
              削除を実行する
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
