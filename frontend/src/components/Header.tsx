import { Link } from 'react-router-dom';
import { Settings, ListTree, Plus, FileInput } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-slate-900 border-b border-slate-800 h-14 flex items-center px-6 justify-between shrink-0 shadow-md z-50">
      <div className="flex items-center gap-10">
        <h1 className="text-xl font-bold text-white tracking-widest uppercase">
          WBS Manager
        </h1>
        <nav className="flex gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-all font-medium"
          >
            <ListTree size={18} />
            <span className="text-sm">メインボード</span>
          </Link>
          <Link
            to="/import"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-all font-medium"
          >
            <FileInput size={18} />
            <span className="text-sm">データインポート</span>
          </Link>
          <Link
            to="/masters"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-800 text-slate-300 hover:text-white transition-all font-medium"
          >
            <Settings size={18} />
            <span className="text-sm">マスタ・設定</span>
          </Link>
        </nav>

      </div>
      <div className="flex items-center gap-6">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest px-2.5 py-1 bg-slate-800/50 rounded-full border border-slate-700">
          Sync Status: Online
        </span>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('add-project'))}
          className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] font-bold group"
        >
          <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>新規追加</span>
        </button>
      </div>
    </header>
  );
}
