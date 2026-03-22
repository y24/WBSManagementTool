import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateForInput, parseDateFromInput, formatDisplayDate } from './utils';

const EditableInput = memo(({ value, onChange, type = "text", className = "" }: any) => {
  const [val, setVal] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const isCommittingRef = useRef(false);
  const datePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
      setVal(type === 'date' ? formatDateForInput(value) : (value || ''));
      isCommittingRef.current = false;
    }
  }, [value, isEditing, type]);

  const handleCommit = useCallback((newVal: string) => {
    if (!isEditing || isCommittingRef.current) return;

    let valueToSave = newVal;
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
    }

    const hasChanged = valueToSave !== (value || '');
    if (hasChanged) {
      isCommittingRef.current = true;
      onChange(valueToSave);
    }
    setIsEditing(false);
  }, [isEditing, value, onChange, type]);

  if (type === 'date' && !isEditing) {
    return (
      <div
        className={`w-full h-full flex items-center cursor-pointer hover:bg-black/5 transition-colors ${className}`}
        onClick={() => {
          setIsEditing(true);
          isCommittingRef.current = false;
        }}
        title={value ? formatDateForInput(value) : "未入力"}
      >
        {value ? formatDisplayDate(value, type) : <span className="text-gray-300 text-[10px]">--/--</span>}
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
          className={`bg-transparent h-full border-none outline-blue-400 px-1 focus:bg-white/50 w-full ${className}`}
          value={val}
          autoFocus={isEditing}
          onChange={(e) => setVal(e.target.value)}
          onBlur={(e) => handleCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCommit((e.target as HTMLInputElement).value);
            else if (e.key === 'Escape' && type === 'date') {
              setVal(formatDateForInput(value));
              setIsEditing(false);
            }
          }}
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
