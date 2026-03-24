import React, { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, X } from 'lucide-react';

interface MultiSelectProps {
  values: any[];
  options: { id: any; name: string; color?: string }[];
  onChange: (values: any[]) => void;
  className?: string;
  placeholder?: string;
  dropdownTitle?: string;
}

const MultiSelect = memo(({
  values,
  options,
  onChange,
  className = "",
  placeholder = "選択してください",
  dropdownTitle
}: MultiSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, direction: 'down' as 'up' | 'down' });

  const selectedOptions = options.filter(o => values.includes(o.id));

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const dropdownMinWidth = Math.max(rect.width, 220);
      const estimatedHeight = 300;

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
      if (e.type === 'mousedown' && e.target instanceof Node) {
        if (dropdownRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) {
          return;
        }
      }
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

  const toggleOption = (id: any) => {
    if (values.includes(id)) {
      onChange(values.filter(v => v !== id));
    } else {
      onChange([...values, id]);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition-all text-left outline-none group/mselect min-w-[140px] max-w-[240px] shadow-sm ${className}`}
      >
        <div className="flex-1 truncate flex gap-1 items-center overflow-hidden">
          {selectedOptions.length > 0 ? (
            <>
              <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[11px] font-bold px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800 shrink-0">
                {selectedOptions.length}
              </span>
              <span className="text-xs text-gray-700 dark:text-slate-300 truncate font-medium">
                {selectedOptions.map(o => o.name).join(', ')}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} className="text-gray-400 group-hover/mselect:text-blue-500 transition-colors shrink-0" />
      </button>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="absolute z-[9999] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-xl rounded-xl py-2 overflow-hidden ring-1 ring-black/5 dark:ring-white/10 transition-all transform duration-150"
          style={{
            top: coords.direction === 'down' ? coords.top + 6 : coords.top - 6,
            left: coords.left,
            minWidth: coords.width,
            transform: coords.direction === 'up' ? 'translateY(-100%)' : 'none'
          }}
        >
          <div className="flex items-center justify-between px-3 pb-2 mb-2 border-b border-gray-50 dark:border-slate-800">
            <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{dropdownTitle || '選択'}</span>
            <div className="flex gap-2">
              {values.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-tight"
                >
                  クリア
                </button>
              )}
              {values.length < options.length && (
                <button
                  onClick={(e) => { e.stopPropagation(); onChange(options.map(o => o.id)); }}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-bold uppercase tracking-tight"
                >
                  全て選択
                </button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain px-1">
            {options.map((opt) => {
              const isSelected = values.includes(opt.id);
              return (
                <div
                  key={opt.id ?? 'null'}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleOption(opt.id);
                  }}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shadow-sm ${isSelected ? 'bg-blue-600 border-blue-600' : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 group-hover:border-blue-400'}`}>
                    {isSelected && <Check size={10} className="text-white stroke-[3px]" />}
                  </div>
                  {opt.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  <span className={`text-xs flex-1 transition-colors ${isSelected ? 'text-blue-700 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-slate-300 font-medium'}`}>{opt.name}</span>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default MultiSelect;
