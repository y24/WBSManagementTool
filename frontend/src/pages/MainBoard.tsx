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

  // ガントとツリーのスクロール同期（DOM直接操作用Ref）
  const treeRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial || !data) setLoading(true);
      
      const wbsRes = await apiClient.get<WBSResponse>('/wbs');
      setData(wbsRes.data);

      // マスタデータは初回または未取得時のみ取得
      if (isInitial || !initialData) {
        const initRes = await apiClient.get<InitialData>('/initial-data');
        setInitialData(initRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
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
    if (ganttRef.current && Math.abs(ganttRef.current.scrollTop - e.currentTarget.scrollTop) > 0.5) {
      ganttRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (treeRef.current && Math.abs(treeRef.current.scrollTop - e.currentTarget.scrollTop) > 0.5) {
      treeRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  if (loading && !data) return <div className="p-4 text-gray-500 font-medium">Loading WBS...</div>;

  return (
    <div className="flex w-full h-full bg-white relative overflow-hidden select-none">
      {/* 左ペイン: WBSツリー */}
      <div 
        className="flex-shrink-0 flex flex-col relative z-20 overflow-hidden" 
        style={{ width: `${treeWidth}px` }}
      >
        <WBSTree 
          ref={treeRef}
          projects={data?.projects || []} 
          initialData={initialData} 
          onUpdate={fetchData} 
          expandedProjects={expandedProjects}
          setExpandedProjects={setExpandedProjects}
          expandedTasks={expandedTasks}
          setExpandedTasks={setExpandedTasks}
          onScroll={handleTreeScroll}
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
            ref={ganttRef}
            projects={data.projects} 
            initialData={initialData}
            range={data.gantt_range}
            expandedProjects={expandedProjects}
            expandedTasks={expandedTasks}
            onScroll={handleGanttScroll}
          />
        )}
      </div>
    </div>
  );
}
