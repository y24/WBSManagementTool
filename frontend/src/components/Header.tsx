import { Link } from 'react-router-dom';
import { Settings, ListTree, Plus, FileInput, LayoutDashboard } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-14 flex items-center px-6 justify-between shrink-0 shadow-md z-50 transition-colors">
      <div className="flex items-center gap-10">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-widest uppercase">
          WBS Manager
        </h1>
        <nav className="flex gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all font-medium"
          >
            <ListTree size={18} />
            <span className="text-sm">メインボード</span>
          </Link>
          <Link
            to="/import"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all font-medium"
          >
            <FileInput size={18} />
            <span className="text-sm">データインポート</span>
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all font-medium"
          >
            <LayoutDashboard size={18} />
            <span className="text-sm">ダッシュボード</span>
          </Link>

          <Link
            to="/masters"
            className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all font-medium"
          >
            <Settings size={18} />
            <span className="text-sm">マスタ・設定</span>
          </Link>
        </nav>

      </div>
      <div className="flex items-center gap-6">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('add-project'))}
          className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-indigo-600 dark:bg-indigo-700/40 text-white dark:text-indigo-100 rounded-lg text-sm border border-indigo-500 dark:border-indigo-500/30 hover:bg-indigo-700 dark:hover:bg-indigo-600/60 hover:border-indigo-600 dark:hover:border-indigo-400 hover:text-white hover:scale-105 active:scale-95 transition-all shadow-lg dark:shadow-xl backdrop-blur-md font-bold group"
        >
          <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
          <span>プロジェクト追加</span>
        </button>
      </div>
    </header>
  );
}
