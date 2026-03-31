import React from 'react';
import { List, Layers, ChevronsDown } from 'lucide-react';
import { commonHeaderClasses, boundaryHeaderClasses, planningCellClasses } from './constants';

interface WBSHeaderProps {
  nameWidth: number;
  startResizing: (e: React.MouseEvent) => void;
  handleProjectLevel: () => void;
  handleTaskLevel: () => void;
  handleSubtaskLevel: () => void;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
}

const WBSHeader: React.FC<WBSHeaderProps> = ({
  nameWidth,
  startResizing,
  handleProjectLevel,
  handleTaskLevel,
  handleSubtaskLevel,
  hidePlanningColumns = false,
  isPlanningMode = false
}) => {
  return (
    <div className="sticky top-0 z-30 flex border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm whitespace-nowrap h-[33px] transition-colors">
      <div
        className={`sticky left-0 z-40 flex items-center bg-slate-100 dark:bg-slate-800 ${commonHeaderClasses}`}
        style={{ width: nameWidth, minWidth: nameWidth }}
      >
        <div className="flex items-center gap-1 mr-2 no-drag ml-1">
          <button
            onClick={handleProjectLevel}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="プロジェクトレベルで表示 (全プロジェクトを折りたたむ)"
          >
            <List size={16} />
          </button>
          <button
            onClick={handleTaskLevel}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="タスクレベルで表示 (プロジェクトを展開、タスクを折りたたむ)"
          >
            <Layers size={16} />
          </button>
          <button
            onClick={handleSubtaskLevel}
            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="サブタスクレベルで表示 (すべて展開)"
          >
            <ChevronsDown size={16} />
          </button>
        </div>
        名称
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-10 transition-colors"
          onMouseDown={startResizing}
        />
      </div>
      <div className={`w-28 flex items-center ${commonHeaderClasses}`}>ステータス</div>
      <div className={`w-24 flex items-center ${commonHeaderClasses}`}>進捗</div>
      <div className={`w-28 flex items-center ${commonHeaderClasses}`}>担当者</div>
      {!hidePlanningColumns && (
        <>
          <div className={`w-20 flex items-center ${commonHeaderClasses} ${boundaryHeaderClasses} ${planningCellClasses}`}>作業日数</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses} ${planningCellClasses}`}>レビュー日数</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses} ${planningCellClasses}`}>開始(計画)</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses} ${planningCellClasses}`}>終了(計画)</div>
          <div className={`w-16 flex items-center ${commonHeaderClasses} ${planningCellClasses}`}>予定工数</div>
        </>
      )}
      {!isPlanningMode && (
        <>
          <div className={`w-20 flex items-center ${commonHeaderClasses} ${boundaryHeaderClasses}`}>開始(実績)</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>レビュー開始</div>
          <div className={`w-20 flex items-center ${commonHeaderClasses}`}>終了(実績)</div>
          <div className={`w-16 flex items-center ${commonHeaderClasses}`}>実績工数</div>
        </>
      )}
    </div>
  );
};

export default WBSHeader;
