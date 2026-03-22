import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateForInput, parseDateFromInput, formatDisplayDate } from './utils';

const EditableInput = memo(({ value, onChange, type = "text", className = "", min, max, step, precision, suffix }: any) => {
  const [val, setVal] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isCommittingRef = useRef(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      let initVal = value != null ? String(value) : '';
      if (type === 'date') {
        initVal = formatDateForInput(value);
      } else if (type === 'number' && precision !== undefined && value !== '' && value != null) {
        const num = Number(value);
        if (!isNaN(num)) initVal = num.toFixed(precision);
      }
      setVal(initVal);
      isCommittingRef.current = false;
    }
  }, [value, isEditing, type, precision]);

  const handleCommit = useCallback((newVal: string) => {
    if (!isEditing || isCommittingRef.current) return;

    let valueToSave: any = newVal;
    if (type === 'date') {
      if (newVal === '') {
        valueToSave = '';
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
  }, [isEditing, value, onChange, type, min, max]);

  const displayValue = () => {
    if (type === 'date') {
      return value ? formatDisplayDate(value, type) : <span className="text-gray-300 text-[10px]">--/--</span>;
    }
    if (value == null || value === '') {
      return <span className="text-gray-300 text-[10px]">-</span>;
    }
    
    let formattedValue = value;
    if (type === 'number' && precision !== undefined && value !== '' && value != null) {
      const num = Number(value);
      if (!isNaN(num)) formattedValue = num.toFixed(precision);
    }
    return `${formattedValue}${suffix || ''}`;
  };

  if (!isEditing) {
    return (
      <div
        className={`w-full h-full flex items-center cursor-pointer hover:bg-black/5 transition-colors overflow-hidden truncate px-1 ${className}`}
        onClick={() => {
          setIsEditing(true);
          isCommittingRef.current = false;
        }}
        title={type === 'date' && value ? formatDateForInput(value) : String(value || "未入力")}
      >
        {displayValue()}
      </div>
    );
  }

  return (
    <div
      className={type === 'date' ? "relative w-full h-full" : "w-full h-full"}
      style={type === 'date' && isEditing ? { zIndex: 1000, overflow: 'visible' } : {}}
    >
      {type === 'date' && isEditing ? (
        <div
          className="absolute left-0 top-0 z-[1000] flex items-center bg-white shadow-2xl border-2 border-blue-500 rounded ring-4 ring-blue-500/10"
          style={{ width: '135px', height: '37px', marginLeft: '-2px', marginTop: '-2px' }}
        >
          <button
            type="button"
            className="flex items-center justify-center w-9 h-full border-r border-blue-100 text-blue-600 hover:bg-blue-50 transition-colors"
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              try { (datePickerRef.current as any)?.showPicker(); } catch (err) { datePickerRef.current?.click(); }
            }}
            title="カレンダーから選択"
          >
            <Calendar size={19} />
          </button>
          <input
            type="text"
            placeholder="YYYY/MM/DD"
            className="flex-1 bg-transparent h-full border-none outline-none px-2 text-sm font-bold text-gray-800"
            value={val}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setVal(e.target.value)}
            onBlur={(e) => handleCommit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommit((e.target as HTMLInputElement).value);
              else if (e.key === 'Escape') {
                setVal(formatDateForInput(value));
                setIsEditing(false);
              }
            }}
          />
        </div>
      ) : (
        <input
          type={type === 'date' ? "text" : type}
          className={`bg-white h-full border-2 border-blue-400 outline-none px-1 w-full shadow-sm rounded ${className}`}
          value={val}
          autoFocus={isEditing}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setVal(e.target.value)}
          onBlur={(e) => handleCommit(e.target.value)}
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
          className="absolute opacity-0 pointer-events-none w-0 h-0"
          style={{ left: 0, bottom: 0 }}
          value={value || ''}
          onChange={(e) => {
            const picked = e.target.value;
            if (picked) {
              setVal(formatDateForInput(picked));
              onChange(picked);
              setIsEditing(false);
            }
          }}
        />
      )}
    </div>
  );
});

export default EditableInput;
