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
  isFocused?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onEditingChange?: (editing: boolean) => void;
  onTab?: (isShift: boolean) => void;
  isEditing?: boolean;
}

const PortalSelect = memo(({ 
  value, 
  options, 
  onChange, 
  className = "", 
  placeholder = "未設定",
  dropdownTitle,
  highlight,
  isFocused,
  onFocusChange,
  onEditingChange,
  onTab,
  isEditing: isGlobalEditing
}: PortalSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldFlash, setShouldFlash] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, direction: 'down' as 'up' | 'down' });
  const [activeIndex, setActiveIndex] = useState(-1);
  const prevValueRef = useRef(value);
  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    // 外部からの値更新を検知
    if (!isOpen && prevValueRef.current !== value) {
      setShouldFlash(true);
      const timer = setTimeout(() => setShouldFlash(false), 1000);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value, isOpen]);

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
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);
    if (onEditingChange) onEditingChange(newIsOpen);
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
      if (onEditingChange) onEditingChange(false);
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

  // フォーカス時に Enter/Space でドロップダウンを開く
  useEffect(() => {
    if (isFocused && !isOpen) {
      const handleGlobalKey = (e: KeyboardEvent) => {
        if (document.querySelector('[data-modal-active="true"]')) return;

        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (buttonRef.current) {
            buttonRef.current.click();
          }
        } else if (e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          onChange(null);
        } else if (e.key === 'Tab') {
          // 非編集時のTab（フォーカスのみ）
          if (onTab) {
            e.preventDefault();
            e.stopPropagation();
            onTab(e.shiftKey);
          }
        }
      };
      window.addEventListener('keydown', handleGlobalKey, true);
      return () => window.removeEventListener('keydown', handleGlobalKey, true);
    }
  }, [isFocused, isOpen, onChange, onTab]);

  // グローバルな編集モードが有効でフォーカスされた場合、自動的にドロップダウンを開く
  useEffect(() => {
    if (isFocused && isGlobalEditing && !isOpen) {
      if (buttonRef.current) {
        buttonRef.current.click();
      }
    }
  }, [isFocused, isGlobalEditing, isOpen]);

  // メニュー開封時に現在の値に合わせて activeIndex を初期化
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex(o => o.id === value);
      setActiveIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, options, value]);

  // ドロップダウンが開いている時のキーボード操作
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[data-modal-active="true"]')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev < options.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex >= 0 && activeIndex < options.length) {
          onChange(options[activeIndex].id);
          setIsOpen(false);
          if (onEditingChange) onEditingChange(false);
          if (onFocusChange) onFocusChange(true);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(false);
        if (onEditingChange) onEditingChange(false);
        if (onFocusChange) onFocusChange(true);
      } else if (e.key === 'Tab') {
        // 編集時（ドロップダウン開封時）のTab
        e.preventDefault();
        e.stopPropagation();
        if (activeIndex >= 0 && activeIndex < options.length) {
          onChange(options[activeIndex].id);
        }
        setIsOpen(false);
        if (onEditingChange) onEditingChange(false);
        if (onTab) onTab(e.shiftKey);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, activeIndex, options, onChange, onEditingChange]);

  // activeIndexが変わった時にスクロールさせる
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && dropdownRef.current) {
      const activeEl = dropdownRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex, isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          if (onFocusChange) onFocusChange(true);
          toggleDropdown(e);
        }}
        className={`flex items-center gap-1.5 px-1.5 py-1 rounded transition-colors text-left outline-none group/pselect 
          ${highlight ? 'bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/50' : 'hover:bg-gray-100/80 dark:hover:bg-slate-800'} 
          ${shouldFlash ? 'animate-auto-flash' : ''} 
          ${isFocused ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}
          ${className}`}
      >
        <span className="truncate flex-1 leading-none text-gray-900 dark:text-slate-100">
          {selectedOption && selectedOption.id !== null ? (
            selectedOption.name
          ) : (
            <span className="text-gray-400 dark:text-slate-500">{selectedOption?.name || placeholder}</span>
          )}
        </span>
        <ChevronDown size={14} className="text-gray-300 dark:text-slate-600 group-hover/pselect:text-gray-500 dark:group-hover/pselect:text-slate-400 transition-colors shrink-0" />
      </button>


      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="absolute z-[9999] bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-2xl rounded-lg py-1.5 overflow-hidden ring-1 ring-black/5 dark:ring-white/10"
          style={{ 
            top: coords.direction === 'down' ? coords.top + 4 : coords.top - 4, 
            left: coords.left, 
            minWidth: coords.width,
            transform: coords.direction === 'up' ? 'translateY(-100%)' : 'none'
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {dropdownTitle && (
            <div className="px-2 pb-1.5 mb-1.5 border-b border-gray-100 dark:border-slate-800 mx-1 text-center">
              <span className="text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest">{dropdownTitle}</span>
            </div>
          )}
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {options.map((opt, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={opt.id ?? 'null'}
                  data-index={index}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 transition-colors text-left outline-none
                    ${opt.id === value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-900 dark:text-slate-100'}
                    ${isActive ? 'bg-gray-100 dark:bg-slate-800 ring-1 ring-inset ring-blue-500/50' : ''}
                  `}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(opt.id);
                    setIsOpen(false);
                    if (onEditingChange) onEditingChange(false);
                    if (onFocusChange) onFocusChange(true);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="text-xs font-normal leading-none flex-1">{opt.name}</span>
                  {isActive ? <Check size={12} className="ml-auto" /> : opt.id === value && <Check size={12} className="ml-auto text-blue-600 dark:text-blue-400" />}
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

export default PortalSelect;
