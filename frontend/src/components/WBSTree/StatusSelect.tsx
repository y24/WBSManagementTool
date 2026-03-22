import React, { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { Subtask } from '../../types/wbs';
import { InitialData } from '../../types';

interface StatusSelectProps {
  subtask: Subtask;
  initialData: InitialData | null;
  onUpdateField: (type: 'project' | 'task' | 'subtask', id: number, field: string, value: any) => void;
}

const StatusSelect = memo(({ subtask, initialData, onUpdateField }: StatusSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const statusInfo = initialData?.statuses.find((s: any) => s.id === subtask.status_id);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 140)
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleEvents = () => setIsOpen(false);
    window.addEventListener('scroll', handleEvents, true);
    window.addEventListener('resize', handleEvents);
    return () => {
      window.removeEventListener('scroll', handleEvents, true);
      window.removeEventListener('resize', handleEvents);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded hover:bg-gray-100 transition-colors text-left outline-none group/status"
      >
        <span 
          className="master-color-dot shrink-0" 
          style={{ backgroundColor: statusInfo?.color_code, width: '10px', height: '10px' }}
        ></span>
        <span className="text-[11px] font-normal text-gray-900 truncate flex-1 leading-none">
          {statusInfo?.status_name}
        </span>
        <ChevronDown size={12} className="text-gray-300 group-hover/status:text-gray-500 transition-colors shrink-0" />
      </button>

      {isOpen && createPortal(
        <div 
          className="fixed z-[9999] bg-white border border-gray-200 shadow-2xl rounded-lg py-1.5 overflow-hidden"
          style={{ 
            top: coords.top + 4, 
            left: coords.left, 
            minWidth: coords.width,
          }}
        >
          <div className="px-2 pb-1.5 mb-1.5 border-b border-gray-100 mx-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">ステータスを変更</span>
          </div>
          {initialData?.statuses.map((s: any) => (
            <button
              key={s.id}
              className={`flex items-center gap-2.5 w-full px-3 py-2 transition-colors text-left ${s.id === subtask.status_id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-900'}`}
              onClick={(e) => {
                e.stopPropagation();
                onUpdateField('subtask', subtask.id, 'status_id', s.id);
                setIsOpen(false);
              }}
            >
              <span 
                className="master-color-dot shrink-0" 
                style={{ backgroundColor: s.color_code, width: '10px', height: '10px' }}
              ></span>
              <span className="text-xs font-normal leading-none">{s.status_name}</span>
              {s.id === subtask.status_id && <Check size={12} className="ml-auto" />}
            </button>
          ))}
        </div>,
        document.body
      )}

      {isOpen && (
        <div 
          className="fixed inset-0 z-[9998]" 
          onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
        />
      )}
    </>
  );
});

export default StatusSelect;
