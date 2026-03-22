import React, { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface PortalSelectProps {
  value: any;
  options: { id: any; name: string }[];
  onChange: (value: any) => void;
  className?: string;
  placeholder?: string;
  dropdownTitle?: string;
}

const PortalSelect = memo(({ 
  value, 
  options, 
  onChange, 
  className = "", 
  placeholder = "未設定",
  dropdownTitle
}: PortalSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const selectedOption = options.find(o => o.id === value);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 160)
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;
    
    const handleEvents = (e: Event) => {
      // スクロールイベントがドロップダウンメニュー内の場合は閉じない
      if (e.type === 'scroll' && dropdownRef.current?.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

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
        className={`flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-gray-100/80 transition-colors text-left outline-none group/pselect ${className}`}
      >
        <span className="truncate flex-1 leading-none">
          {selectedOption ? selectedOption.name : <span className="text-gray-400">{placeholder}</span>}
        </span>
        <ChevronDown size={14} className="text-gray-300 group-hover/pselect:text-gray-500 transition-colors shrink-0" />
      </button>

      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="absolute z-[9999] bg-white border border-gray-200 shadow-2xl rounded-lg py-1.5 overflow-hidden ring-1 ring-black/5"
          style={{ 
            top: coords.top + 4, 
            left: coords.left, 
            minWidth: coords.width,
          }}
        >
          {dropdownTitle && (
            <div className="px-2 pb-1.5 mb-1.5 border-b border-gray-100 mx-1">
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{dropdownTitle}</span>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {options.map((opt) => (
              <button
                key={opt.id ?? 'null'}
                className={`flex items-center gap-2.5 w-full px-3 py-2 transition-colors text-left ${opt.id === value ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-900'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(opt.id);
                  setIsOpen(false);
                }}
              >
                <span className="text-xs font-normal leading-none flex-1">{opt.name}</span>
                {opt.id === value && <Check size={12} className="ml-auto" />}
              </button>
            ))}
          </div>
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

export default PortalSelect;
