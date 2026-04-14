import React from 'react';
import { List, Layers, ChevronsDown } from 'lucide-react';
import { commonHeaderClasses, planningCellClasses } from './constants';

interface WBSHeaderProps {
  nameWidth: number;
  assigneeWidth: number;
  startResizing: (e: React.MouseEvent, column: 'name' | 'assignee') => void;
  handleProjectLevel: () => void;
  handleTaskLevel: () => void;
  handleSubtaskLevel: () => void;
  hidePlanningColumns?: boolean;
  isPlanningMode?: boolean;
}

const WBSHeader: React.FC<WBSHeaderProps> = ({
  nameWidth,
  assigneeWidth,
  startResizing,
  handleProjectLevel,
  handleTaskLevel,
  handleSubtaskLevel,
  hidePlanningColumns = false,
  isPlanningMode = false
}) => {
  return (
    <div className="sticky top-0 z-30 flex border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm whitespace-nowrap h-[38px] transition-colors">
      {/* 1段構成の列（名称、ステータス、進捗、担当者） */}
      <div
        className={`sticky left-0 z-40 flex items-center bg-slate-100 dark:bg-slate-800 ${commonHeaderClasses}`}
        style={{ width: nameWidth, minWidth: nameWidth, height: '38px' }}
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
          onMouseDown={(e) => startResizing(e, 'name')}
        />
      </div>

      <div className={`w-28 flex-shrink-0 flex items-center ${commonHeaderClasses}`} style={{ height: '38px' }}>ステータス</div>
      <div className={`w-24 flex-shrink-0 flex items-center ${commonHeaderClasses}`} style={{ height: '38px' }} title="上位階層（青文字）は、配下サブタスクの予定工数による加重平均で算出されます。">進捗</div>
      <div
        className={`flex-shrink-0 flex items-center relative ${commonHeaderClasses}`}
        style={{ width: assigneeWidth, minWidth: assigneeWidth, height: '38px' }}
      >
        担当者
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-10 transition-colors"
          onMouseDown={(e) => startResizing(e, 'assignee')}
        />
      </div>

      {/* 2段構成のセクション（計画、実績） */}
      <div className="flex flex-col">
        {/* グループラベル行 */}
        <div className="flex h-[18px] border-b border-slate-200/50 dark:border-slate-700/50 select-none">
          {!hidePlanningColumns && (
            <div className="w-[464px] flex-shrink-0 flex items-center justify-start pl-2 text-[9px] font-bold text-blue-600/80 dark:text-blue-400/80 bg-blue-100/50 dark:bg-blue-900/30 border-r border-slate-200 dark:border-slate-700 uppercase tracking-tighter">
              計画
            </div>
          )}
          {!isPlanningMode && (
            <div className="w-[304px] flex-shrink-0 flex items-center justify-start pl-2 text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-100/50 dark:bg-emerald-900/30 border-r border-slate-200 dark:border-slate-700 uppercase tracking-tighter">
              実績
            </div>
          )}
        </div>

        {/* サブラベル行 */}
        <div className="flex h-[20px]">
          {!hidePlanningColumns && (
            <>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} ${planningCellClasses} !py-0`}>工数比率</div>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} ${planningCellClasses} !py-0`} title="実作業に割り当てる営業日数。レビュー期間は除きます。">作業日数</div>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} ${planningCellClasses} !py-0`} title="レビューに割り当てる営業日数。この期間の工数は一律50%で計算されます。">レビュー日数</div>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} ${planningCellClasses} !py-0`} title="実作業を開始する予定日。">開始(計画)</div>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} ${planningCellClasses} !py-0`} title="実作業とレビューの全工程を完了する予定日。">終了(計画)</div>
              <div
                className={`w-16 flex-shrink-0 flex items-center ${commonHeaderClasses} ${planningCellClasses} !py-0`}
                title="予定工数 = (作業日数 × 工数比率) + (レビュー日数 × 50%)&#10;※作業日数とレビュー日数が同日の場合は、両方の工数を合算して算出します。"
              >
                予定工数
              </div>
            </>
          )}
          {!isPlanningMode && (
            <>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} !py-0`} title="作業を開始した日。ステータスが「In Progress」になると自動設定されます。">開始(実績)</div>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} !py-0`} title="レビューを開始した日。ステータスが「In Review」になると自動設定されます。">レビュー開始</div>
              <div className={`w-20 flex-shrink-0 flex items-center ${commonHeaderClasses} !py-0`} title="全工程が完了した日。ステータスを「Done」にすると自動設定されます。">終了(実績)</div>
              <div
                className={`w-16 flex-shrink-0 flex items-center ${commonHeaderClasses} !py-0`}
                title="実績工数 = (作業期間 × 工数比率) + (レビュー期間 × 50%)&#10;※作業期間とレビュー期間が同日の場合は、両方の工数を合算して算出します。"
              >
                実績工数
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WBSHeader;
