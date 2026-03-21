import { Link } from 'react-router-dom';
import { Settings, ListTree } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4 justify-between shrink-0 shadow-sm">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-semibold text-gray-800 tracking-tight">
          WBS Manager
        </h1>
        <nav className="flex gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <ListTree size={18} />
            <span className="text-sm font-medium">メインボード</span>
          </Link>
          <Link
            to="/masters"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
          >
            <Settings size={18} />
            <span className="text-sm font-medium">マスタ管理</span>
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {/* 自動保存等ステータス表示用プレースホルダー */}
        <span className="text-xs text-gray-400 font-medium px-2 py-1 bg-gray-50 rounded border border-gray-100">
          Saved
        </span>
      </div>
    </header>
  );
}
