import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { Project, WBSResponse } from '../types/wbs';
import { InitialData } from '../types';
import WBSTree from '../components/WBSTree';
import GanttChart from '../components/GanttChart';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MainBoard() {
  const [data, setData] = useState<WBSResponse | null>(null);
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);

  // ツリー展開ステートのリフトアップ
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});

  // レイアウトの幅調整
  const [treeWidth, setTreeWidth] = useState(1000);
  const [isResizing, setIsResizing] = useState(false);

  // ガントとツリーのスクロール同期
  const [treeScrollTop, setTreeScrollTop] = useState(0);
  const [ganttScrollTop, setGanttScrollTop] = useState(0);
  const treeRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [wbsRes, initRes] = await Promise.all([
        apiClient.get<WBSResponse>('/wbs'),
        apiClient.get<InitialData>('/initial-data')
      ]);
      setData(wbsRes.data);
      setInitialData(initRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // マウス関連のリサイズイベント制御
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(300, Math.min(e.clientX, window.innerWidth - 300));
      setTreeWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleTreeScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setTreeScrollTop(e.currentTarget.scrollTop);
  };

  const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setGanttScrollTop(e.currentTarget.scrollTop);
  };

  if (loading) return <div className="p-4 text-gray-500">Loading WBS...</div>;

  return (
    <div className="flex w-full h-full bg-white relative overflow-hidden select-none">
      {/* 左ペイン: WBSツリー */}
      <div 
        className="flex-shrink-0 flex flex-col relative z-20 overflow-hidden" 
        style={{ width: `${treeWidth}px` }}
      >
        <WBSTree 
          projects={data?.projects || []} 
          initialData={initialData} 
          onUpdate={fetchData} 
          expandedProjects={expandedProjects}
          setExpandedProjects={setExpandedProjects}
          expandedTasks={expandedTasks}
          setExpandedTasks={setExpandedTasks}
          onScroll={handleTreeScroll}
          syncScrollTop={ganttScrollTop}
        />
      </div>

      {/* リサイズバー */}
      <div 
        className="w-1.5 bg-gray-200 cursor-col-resize hover:bg-blue-400 transition-colors z-30 flex items-center justify-center shrink-0"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
      >
      </div>

      {/* 右ペイン: ガントチャート */}
      <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col z-10 w-0">
        {data?.gantt_range && (
          <GanttChart 
            projects={data.projects} 
            initialData={initialData}
            range={data.gantt_range}
            expandedProjects={expandedProjects}
            expandedTasks={expandedTasks}
            scrollTop={treeScrollTop}
          />
        )}
      </div>
    </div>
  );
}
