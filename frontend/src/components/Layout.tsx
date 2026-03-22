import { ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 font-sans text-gray-900">
      <Header />
      <main className="flex-1 flex flex-col relative w-full h-full min-h-0 bg-slate-50 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
