import { Link, useLocation } from 'react-router-dom';
import { Settings, ListTree, Plus, FileInput, LayoutDashboard, RefreshCw, CalendarDays } from 'lucide-react';

const navItems = [
  { to: '/', label: 'メインボード', icon: ListTree },
  { to: '/import', label: 'データインポート', icon: FileInput },
  { to: '/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { to: '/masters', label: 'マスタ・設定', icon: Settings },
] as const;

export default function Header() {
  const location = useLocation();
  const isMainBoard = location.pathname === '/';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-14 flex items-center px-6 justify-between shrink-0 shadow-md z-50 transition-colors">
      <div className="flex items-center gap-10">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-widest uppercase">
          WBS Tracker
        </h1>
        <nav className="flex gap-4">
          {navItems.map(({ to, label, icon: Icon }) => {
            const isActive = location.pathname === to;
            const navClassName = [
              'flex items-center gap-2 px-3 py-1.5 rounded-md border transition-all font-medium',
              isActive
                ? 'bg-sky-50 border-sky-200 text-sky-700 shadow-sm dark:bg-sky-950/40 dark:border-sky-800/70 dark:text-sky-200'
                : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white',
            ].join(' ');

            return (
              <Link
                key={to}
                to={to}
                className={navClassName}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}
        </nav>

      </div>
      <div className="flex items-center gap-6">
        {isMainBoard && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('gantt-scroll-to-today'))}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all font-medium active:scale-95 shadow-sm"
              title="今日の日付へ移動"
            >
              <CalendarDays size={16} />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('refresh-wbs'))}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all font-medium active:scale-95 shadow-sm"
              title="データを再読込"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={(e) => window.dispatchEvent(new CustomEvent('add-project', { detail: { isShift: e.shiftKey } }))}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-md text-sm border border-indigo-200/60 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-700 dark:hover:text-indigo-200 transition-all font-medium group active:scale-95 shadow-sm"
              title="プロジェクトを追加 (Shift+クリックで一括作成)"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300" />
              <span>プロジェクト追加</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
