import React from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';

interface FloatingMenuProps {
  totalSelectedCount: number;
  onDelete: () => void;
  onClear: () => void;
  menuRendered: boolean;
}

const FloatingMenu = ({ totalSelectedCount, onDelete, onClear, menuRendered }: FloatingMenuProps) => {
  if (!menuRendered) return null;

  return createPortal(
    <div className={`fixed bottom-8 left-1/2 z-[100] floating-menu-container ${totalSelectedCount === 0 ? 'floating-menu-hide' : ''}`}>
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
            onClick={onDelete}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-bold text-sm transition-all hover:scale-105 active:scale-95"
          >
            <Trash2 size={18} />
            一括削除
          </button>
          <button
            onClick={onClear}
            className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors px-2"
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
