import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Copy, Eraser, CalendarDays } from 'lucide-react';

interface FloatingMenuProps {
  totalSelectedCount: number;
  onDelete: () => void;
  onDuplicate: () => void;
  onClearActuals: () => void;
  onShiftDates: () => void;
  onClear: () => void;
  menuRendered: boolean;
  loading?: boolean;
}

const FloatingMenu = ({ 
  totalSelectedCount, 
  onDelete, 
  onDuplicate, 
  onClearActuals, 
  onShiftDates,
  onClear, 
  menuRendered, 
  loading 
}: FloatingMenuProps) => {
  if (!menuRendered) return null;

  return createPortal(
    <div className={`fixed bottom-8 left-1/2 z-[10005] floating-menu-container ${totalSelectedCount === 0 ? 'floating-menu-hide' : ''}`}>
      <div className="bg-white/90 backdrop-blur-md border border-gray-200 rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 ring-1 ring-black/5">
        <div className="flex items-center gap-2">
          <span className="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
            {totalSelectedCount}
          </span>
          <span className="text-sm font-semibold text-gray-700">選択中</span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <div className="flex items-center gap-4">
          <button
            onClick={onDuplicate}
            disabled={loading}
            className={`flex items-center gap-2 text-blue-600 hover:text-blue-700 font-bold text-sm transition-all hover:scale-105 active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Copy size={18} className={loading ? 'animate-pulse' : ''} />
            {loading ? '複製中...' : '複製'}
          </button>
          <button
            onClick={onClearActuals}
            disabled={loading}
            className={`flex items-center gap-2 text-amber-600 hover:text-amber-700 font-bold text-sm transition-all hover:scale-105 active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Eraser size={18} className={loading ? 'animate-pulse' : ''} />
            {loading ? 'クリア中...' : '実績クリア'}
          </button>
          <button
            onClick={onShiftDates}
            disabled={loading}
            className={`flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-bold text-sm transition-all hover:scale-105 active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <CalendarDays size={18} className={loading ? 'animate-pulse' : ''} />
            {loading ? '処理中...' : '日付一括ずらし'}
          </button>
          <button
            onClick={onDelete}
            disabled={loading}
            className={`flex items-center gap-2 text-red-600 hover:text-red-700 font-bold text-sm transition-all hover:scale-105 active:scale-95 ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Trash2 size={18} className={loading ? 'animate-pulse' : ''} />
            {loading ? '削除中...' : '一括削除'}
          </button>
          <button
            onClick={onClear}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors px-2 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            選択解除
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FloatingMenu;
