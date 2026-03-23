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
  highlight?: boolean;
}

const PortalSelect = memo(({ 
  value, 
  options, 
  onChange, 
  className = "", 
  placeholder = "未設定",
  dropdownTitle,
  highlight
}: PortalSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, direction: 'down' as 'up' | 'down' });
  const selectedOption = options.find(o => o.id === value);

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      
      const dropdownMinWidth = Math.max(rect.width, 160);
      const estimatedHeight = 280; // max-h-60 + space for header/padding

      // 垂直方向の判定: 下側に十分なスペースがなく、上側の方が広い場合は上側に表示
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const direction = (spaceBelow < estimatedHeight && spaceAbove > spaceBelow) ? 'up' : 'down';

      // 水平方向の判定: 右側にはみ出す場合は左に寄せる
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
        className={`flex items-center gap-1.5 px-1.5 py-1 rounded transition-colors text-left outline-none group/pselect ${highlight ? 'bg-yellow-50 hover:bg-yellow-100/50' : 'hover:bg-gray-100/80'} ${className}`}
      >
        <span className="truncate flex-1 leading-none">
          {selectedOption && selectedOption.id !== null ? (
            selectedOption.name
          ) : (
            <span className="text-gray-400">{selectedOption?.name || placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="text-gray-300 group-hover/pselect:text-gray-500 transition-colors shrink-0" />
      </button>


      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="absolute z-[9999] bg-white border border-gray-200 shadow-2xl rounded-lg py-1.5 overflow-hidden ring-1 ring-black/5"
          style={{ 
            top: coords.direction === 'down' ? coords.top + 4 : coords.top - 4, 
            left: coords.left, 
            minWidth: coords.width,
            transform: coords.direction === 'up' ? 'translateY(-100%)' : 'none'
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
    </>
  );
});

export default PortalSelect;
