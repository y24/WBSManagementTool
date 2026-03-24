import { ReactNode, useEffect } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  // マウント時にlocalStorageからダークモード設定を読み込んで適用
  // (MainBoard以外でリロードした際にもテーマを維持するため)
  useEffect(() => {
    const saved = localStorage.getItem('wbs_display_options');
    if (saved) {
      try {
        const options = JSON.parse(saved);
        if (options.isDarkMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {
        console.error('Failed to parse display options in Layout', e);
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 dark:bg-slate-950 font-sans text-gray-900 dark:text-slate-100 transition-colors duration-300">
      <Header />
      <main className="flex-1 flex flex-col relative w-full h-full min-h-0 bg-slate-50 dark:bg-slate-900 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
