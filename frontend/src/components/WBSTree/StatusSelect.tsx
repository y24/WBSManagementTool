import React, { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { Subtask } from '../../types/wbs';
import { InitialData } from '../../types';

interface StatusSelectProps {
  type: 'project' | 'task' | 'subtask';
  id: number;
  statusId: number | null | undefined;
  initialData: InitialData | null;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
  disabledStatusIds?: number[];
}

const StatusSelect = memo(({ type, id, statusId, initialData, onUpdateField, disabledStatusIds = [] }: StatusSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldFlash, setShouldFlash] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, direction: 'down' as 'up' | 'down' });
  const prevStatusIdRef = useRef(statusId);
  const statusInfo = initialData?.statuses.find((s: any) => s.id === statusId);

  useEffect(() => {
    // 外部からの更新（ステータス変更）を検知
    if (!isOpen && prevStatusIdRef.current !== statusId) {
      setShouldFlash(true);
      const timer = setTimeout(() => setShouldFlash(false), 1000);
      prevStatusIdRef.current = statusId;
      return () => clearTimeout(timer);
    }
    prevStatusIdRef.current = statusId;
  }, [statusId, isOpen]);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const dropdownMinWidth = Math.max(rect.width, 140);
      const estimatedHeight = 280;

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const direction = (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) ? 'up' : 'down';

      let left = rect.left + window.scrollX;
      if (rect.left + dropdownMinWidth > viewportWidth - 20) {
        left = Math.max(10, rect.right + window.scrollX - dropdownMinWidth);
      }

      setCoords({
        top: direction === 'down' ? rect.bottom + window.scrollY : rect.top + window.scrollY,
        left: left,
        width: dropdownMinWidth,
        direction
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleEvents = (e: Event) => {
      // ドロップダウン内や、そのボタン内でのクリックであれば閉じない
      if (e.type === 'mousedown' && e.target instanceof Node) {
        if (dropdownRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) {
          return;
        }
      }

      // スクロールイベントがドロップダウンメニュー内の場合は閉じない
      if (e.type === 'scroll' && dropdownRef.current?.contains(e.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    window.addEventListener('mousedown', handleEvents, true);
    window.addEventListener('scroll', handleEvents, true);
    window.addEventListener('resize', handleEvents);
    return () => {
      window.removeEventListener('mousedown', handleEvents, true);
      window.removeEventListener('scroll', handleEvents, true);
      window.removeEventListener('resize', handleEvents);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={`flex items-center gap-1.5 w-full px-1.5 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-left outline-none group/status ${shouldFlash ? 'animate-auto-flash' : ''}`}
      >
        <span
          className="master-color-dot shrink-0"
          style={{ backgroundColor: statusInfo?.color_code, width: '10px', height: '10px' }}
        ></span>
        <span className="text-[11px] font-normal text-gray-900 dark:text-slate-100 truncate flex-1 leading-none">
          {statusInfo?.status_name}
        </span>
        <ChevronDown size={12} className="text-gray-300 dark:text-slate-600 group-hover/status:text-gray-500 dark:group-hover/status:text-slate-400 transition-colors shrink-0" />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[9999] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl rounded-lg py-1.5 overflow-hidden"
          style={{
            top: coords.direction === 'down' ? coords.top + 4 : coords.top - 4,
            left: coords.left,
            minWidth: coords.width,
            transform: coords.direction === 'up' ? 'translateY(-100%)' : 'none'
          }}
        >
          <div className="px-2 pb-1.5 mb-1.5 border-b border-gray-100 dark:border-slate-800 mx-1 text-center">
            <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">ステータスを変更</span>
          </div>
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {initialData?.statuses.map((s: any) => {
              const isDisabled = disabledStatusIds.includes(s.id) && s.id !== statusId;
              return (
                <button
                  key={s.id}
                  disabled={isDisabled}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 transition-colors text-left 
                    ${s.id === statusId ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-900 dark:text-slate-100'}
                    ${isDisabled ? 'opacity-40 cursor-not-allowed filter grayscale-[0.5]' : ''}
                  `}
                  onClick={(e) => {
                    if (isDisabled) return;
                    e.stopPropagation();
                    onUpdateField(type, id, 'status_id', s.id);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className="master-color-dot shrink-0"
                    style={{ backgroundColor: s.color_code, width: '10px', height: '10px' }}
                  ></span>
                  <span className="text-xs font-normal leading-none flex-1">
                    {s.status_name}
                    {isDisabled && <span className="text-[9px] ml-2 text-gray-400 dark:text-slate-500 italic">(自動)</span>}
                  </span>
                  {s.id === statusId && <Check size={12} className="ml-auto" />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default StatusSelect;
