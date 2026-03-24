import { ReactNode } from 'react';

interface KPIProps {
  title: string;
  value: number;
  icon: ReactNode;
  gradient: string;
  highlight?: boolean;
}

export function KPICard({ title, value, icon, gradient, highlight = false }: KPIProps) {
  return (
    <div
      className={`relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br shadow-sm dark:shadow-none ${gradient} border ${
        highlight
          ? 'border-rose-500/40 shadow-[0_0_25px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/20'
          : 'border-slate-200 dark:border-slate-800'
      } backdrop-blur-xl group transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1`}
    >
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-110 transition-transform duration-500">{icon}</div>
      <div className="flex justify-between items-start mb-6">
        <div
          className={`p-3 rounded-xl ${
            highlight
              ? 'bg-rose-500/10 border border-rose-500/20'
              : 'bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-700/50'
          } shadow-sm`}
        >
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-black uppercase tracking-[0.2em] mb-2">{title}</p>
        <p className="text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
          {value}
          <span className="text-base font-bold text-slate-400 dark:text-slate-500 ml-2 tracking-normal uppercase">
            {title.includes('数') || title.includes('件') ? 'items' : ''}
          </span>
        </p>
      </div>
    </div>
  );
}

interface ContainerProps {
  title: string;
  children: ReactNode;
}

export function ChartContainer({ title, children }: ContainerProps) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm dark:shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent"></div>
      <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 mb-8 uppercase tracking-[0.3em] flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></span>
        {title}
      </h3>
      {children}
    </div>
  );
}

interface ListContainerProps extends ContainerProps {
  subtitle?: string;
}

export function ListContainer({ title, subtitle, children }: ListContainerProps) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 backdrop-blur-sm shadow-sm dark:shadow-2xl h-full relative group">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.1em] mt-1.5 opacity-80">
              {subtitle}
            </p>
          )}
        </div>
        <div className="w-8 h-1 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
      </div>
      {children}
    </div>
  );
}
