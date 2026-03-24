import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateForInput, parseDateFromInput, formatDisplayDate } from './utils';

const EditableInput = memo(({ value, onChange, type = "text", className = "", min, max, step, precision, suffix, readOnly, isAuto, onToggleAuto, highlight, autoPercent }: any) => {
  const [val, setVal] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isCommittingRef = useRef(false);
  const datePickerRef = useRef<any>(null);
  const containerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing || isAuto) {
      let initVal = value != null ? String(value) : '';
      if (type === 'date') {
        initVal = formatDateForInput(value);
      } else if (type === 'number' && precision !== undefined && value !== '' && value != null) {
        const num = Number(value);
        if (!isNaN(num)) initVal = num.toFixed(precision);
      }
      setVal(initVal);
      if (!isAuto) isCommittingRef.current = false;
    }
  }, [value, isEditing, type, precision, isAuto]);

  const handleCommit = useCallback((newVal: string) => {
    if (!isEditing || isCommittingRef.current) return;

    if (isAuto) {
      setIsEditing(false);
      return;
    }

    let valueToSave: any = newVal;
    if (type === 'date') {
      if (newVal === '') {
        valueToSave = null;
      } else {
        const parsed = parseDateFromInput(newVal);
        if (parsed) {
          valueToSave = parsed;
        } else {
          setVal(formatDateForInput(value));
          setIsEditing(false);
          return;
        }
      }
    } else if (type === 'number') {
      if (newVal === '') {
        valueToSave = null;
      } else {
        let numVal = Number(newVal);
        if (isNaN(numVal)) {
          setVal(value != null ? String(value) : '');
          setIsEditing(false);
          return;
        }
        // Validate min/max
        if (min !== undefined && numVal < min) numVal = min;
        if (max !== undefined && numVal > max) numVal = max;
        valueToSave = numVal;
      }
    }

    const currentValAsString = type === 'date' ? (value || '') : (value != null ? String(value) : '');
    const newValAsString = type === 'number' && valueToSave != null ? String(valueToSave) : String(valueToSave || '');

    const hasChanged = newValAsString !== currentValAsString;

    if (hasChanged) {
      isCommittingRef.current = true;
      onChange(valueToSave);
    }
    setIsEditing(false);
  }, [isEditing, value, onChange, type, min, max, isAuto]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const nativeEvent = e.nativeEvent as any;
    const inputType = nativeEvent.inputType;

    // 補助機能: 1~9の1桁入力時に自動で0を付与して選択状態にする
    if (autoPercent && inputType === 'insertText' && /^[1-9]$/.test(newVal)) {
      const adjustedVal = newVal + '0';
      setVal(adjustedVal);
      
      // 0の部分を選択状態にする
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.setSelectionRange(1, 2);
        }
      }, 0);
    } else {
      setVal(newVal);
    }
  };

  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCommit(val);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isEditing, val, handleCommit]);

  const displayValue = () => {
    if (type === 'date') {
      if (value) return formatDisplayDate(value, type);
      if (isAuto) return <span className="text-gray-400 dark:text-slate-500 text-[10px] italic font-bold">(自動)</span>;
      return <span className="text-gray-300 dark:text-slate-600 text-[10px]">--/--</span>;
    }
    if (value == null || value === '') {
      return <span className="text-gray-300 dark:text-slate-600 text-[10px]">-</span>;
    }

    let formattedValue = value;
    if (type === 'number' && precision !== undefined && value !== '' && value != null) {
      const num = Number(value);
      if (!isNaN(num)) formattedValue = num.toFixed(precision);
    }
    return `${formattedValue}${suffix || ''}`;
  };

  const isActuallyReadOnly = readOnly || isAuto;

  if (!isEditing) {
    return (
      <div
        className={`w-full h-full flex items-center transition-colors overflow-hidden truncate px-1 ${!readOnly ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-default'} ${isActuallyReadOnly ? 'bg-gray-50/30 dark:bg-slate-800/30 font-medium' : ''} ${isAuto ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-slate-300'} ${type === 'number' ? 'border border-gray-200 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30 rounded' : ''} ${highlight ? 'bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/50' : ''} ${className}`}
        onClick={() => {
          if (readOnly) return;
          setIsEditing(true);
          isCommittingRef.current = false;
        }}
        title={isActuallyReadOnly ? "自動算出中 (クリックで設定変更可能)" : (type === 'date' && value ? formatDateForInput(value) : String(value || "未入力"))}
      >
        {displayValue()}
      </div>
    );
  }


  return (
    <div
      ref={containerRef}
      className={(type === 'date' || type === 'number') && isEditing ? "relative w-full h-full" : "w-full h-full"}
      style={(type === 'date' || type === 'number') && isEditing ? { zIndex: 1000, overflow: 'visible' } : {}}
    >
      {(type === 'date' || (type === 'number' && onToggleAuto)) && isEditing ? (
        <div
          className="absolute left-0 top-0 z-[1000] flex items-center bg-white dark:bg-slate-800 shadow-2xl border-2 border-blue-500 rounded ring-4 ring-blue-500/10 whitespace-nowrap overflow-hidden"
          style={{ width: type === 'date' ? (onToggleAuto ? '220px' : '160px') : (onToggleAuto ? '180px' : '100px'), height: '37px', marginLeft: '-2px', marginTop: '-2px' }}
        >
          <div className="flex items-center justify-center w-9 h-full border-r border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 shrink-0">
            {type === 'date' ? (
              <button
                type="button"
                className="w-full h-full flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onMouseDown={(e) => e.preventDefault()}
                disabled={isAuto}
                onClick={(e) => {
                  e.stopPropagation();
                  try { (datePickerRef.current as any)?.showPicker(); } catch (err) { datePickerRef.current?.click(); }
                }}
              >
                <Calendar size={19} />
              </button>
            ) : (
              <span className="text-gray-400 font-bold italic">#</span>
            )}
          </div>
          <input
            ref={inputRef}
            type={type === 'date' || autoPercent ? 'text' : (type === 'number' ? 'number' : type)}
            inputMode={autoPercent ? 'numeric' : undefined}
            placeholder={type === 'date' ? "YYYY/MM/DD" : "0.0"}
            className="flex-1 bg-transparent min-w-0 h-full border-none outline-none px-2 text-sm font-bold text-gray-800 dark:text-slate-100 disabled:text-gray-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed"
            value={val}
            autoFocus
            disabled={isAuto}
            onFocus={(e) => e.target.select()}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommit((e.target as HTMLInputElement).value);
              else if (e.key === 'Escape') {
                setVal(type === 'date' ? formatDateForInput(value) : (value != null ? String(value) : ''));
                setIsEditing(false);
              }
            }}
            min={min}
            max={max}
            step={step}
          />
          {onToggleAuto && (
            <div
              className="flex items-center gap-1.5 px-2.5 border-l border-blue-100 dark:border-blue-900/50 h-full bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 cursor-pointer select-none shrink-0"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleAuto(!isAuto);
              }}
            >
              <input
                type="checkbox"
                checked={isAuto}
                onChange={() => { }} // onClick handles it
                className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
              />
              <span className="text-[11px] text-blue-700 dark:text-blue-400 font-bold">自動</span>
            </div>
          )}
        </div>
      ) : (
        <input
          ref={inputRef}
          type={type === 'date' || autoPercent ? 'text' : type}
          inputMode={autoPercent ? 'numeric' : undefined}
          className={`bg-white dark:bg-slate-800 h-full border-2 border-blue-400 outline-none px-1 w-full shadow-sm rounded text-gray-800 dark:text-slate-100 ${className}`}
          value={val}
          autoFocus={isEditing}
          onFocus={(e) => e.target.select()}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit((e.target as HTMLInputElement).value);
            else if (e.key === 'Escape') {
              setVal(type === 'date' ? formatDateForInput(value) : (value != null ? String(value) : ''));
              setIsEditing(false);
            }
          }}
          min={min}
          max={max}
          step={step}
        />
      )}

      {type === 'date' && (
        <input
          type="date"
          ref={datePickerRef}
          className="absolute opacity-0 w-0 h-0"
          style={{ left: 0, bottom: 0 }}
          value={value || ''}
          min={min}
          max={max}
          onChange={(e) => {
            const picked = e.target.value;
            setVal(formatDateForInput(picked));
            onChange(picked || null);
          }}
        />
      )}
    </div>
  );
});

export default EditableInput;
