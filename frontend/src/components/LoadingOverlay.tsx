import React, { useState, useEffect } from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  delay?: number; // in milliseconds
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isVisible, 
  delay = 300, 
  message = "読み込み中..." 
}) => {
  // Use a local state to trigger transitions even on initial mount
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(isVisible);
  }, [isVisible]);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/10 dark:bg-slate-950/20 backdrop-blur-[2px] pointer-events-none"
      style={{
        opacity: active ? 1 : 0,
        visibility: active ? 'visible' : 'hidden',
        transition: `opacity 400ms ease, visibility 0s linear ${active ? `${delay}ms` : '0ms'}`,
        transitionDelay: active ? `${delay}ms` : '0ms',
        pointerEvents: active ? 'auto' : 'none'
      }}
    >
      <div 
        className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 flex flex-col items-center gap-3 transition-all duration-500"
        style={{
          transform: active ? 'scale(1)' : 'scale(0.95)',
          transitionDelay: active ? `${delay}ms` : '0ms'
        }}
      >
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200 dark:border-slate-700" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 dark:border-t-indigo-400 animate-spin" />
        </div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200 tracking-wider">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingOverlay;
