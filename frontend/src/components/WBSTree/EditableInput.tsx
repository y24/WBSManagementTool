import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Calendar } from 'lucide-react';
import { formatDateForInput, parseDateFromInput, formatDisplayDate } from './utils';

interface EditableInputProps {
  value: any;
  onChange: (value: any) => void;
  type?: "text" | "number" | "date";
  className?: string;
  min?: number | string | null;
  max?: number | string | null;
  step?: number;
  precision?: number;
  suffix?: string;
  readOnly?: boolean;
  isAuto?: boolean;
  onToggleAuto?: (isAuto: boolean) => void;
  highlight?: boolean;
  autoPercent?: boolean;
  onInputChange?: (value: number | null) => void;
  placeholder?: string;
  isFocused?: boolean;
  onFocusChange?: (focused: boolean) => void;
  onEditingChange?: (editing: boolean) => void;
  onTab?: (isShift: boolean) => void;
  isEditing?: boolean;
}

/**
 * 表示用コンポーネント
 */
interface DisplayViewProps {
  type: string;
  value: any;
  suffix?: string;
  precision?: number;
  isAuto?: boolean;
  isActuallyReadOnly: boolean;
  readOnly?: boolean;
  highlight?: boolean;
  className: string;
  onClick: () => void;
  displayValue: () => React.ReactNode;
}

const DisplayView = ({
  type, value, isAuto, isActuallyReadOnly, readOnly, highlight, className, onClick, displayValue
}: DisplayViewProps) => (
  <div
    className={`w-full h-full flex items-center transition-colors overflow-hidden truncate px-1 
      ${!isActuallyReadOnly ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-default'} 
      ${isActuallyReadOnly ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''} 
      ${isAuto ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-slate-300'} 
      ${type === 'number' ? 'border border-gray-200 dark:border-slate-700 bg-gray-50/30 dark:bg-slate-800/30 rounded' : ''} 
      ${highlight ? 'bg-yellow-50 dark:bg-yellow-900/30 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/50' : ''} 
      ${className}`}
    onClick={onClick}
    title={isAuto ? "自動算出中 (クリックで設定変更可能)" : (readOnly ? "入力不可" : (type === 'date' && value ? formatDateForInput(value) : String(value || "未入力")))}
  >
    {displayValue()}
  </div>
);

/**
 * ポップアップエディタ (Date or Auto付きNumber)
 */
interface PopoverEditorProps {
  type: string;
  isAuto?: boolean;
  onToggleAuto?: (isAuto: boolean) => void;
  onPickerToggle: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

const PopoverEditor = ({
  type, isAuto, onToggleAuto, onPickerToggle, children
}: PopoverEditorProps) => {
  const width = type === 'date' ? (onToggleAuto ? '220px' : '160px') : (onToggleAuto ? '180px' : '100px');

  return (
    <div className="absolute left-0 top-0 z-[1000] flex items-center bg-white dark:bg-slate-800 shadow-2xl border-2 border-blue-500 rounded ring-4 ring-blue-500/10 whitespace-nowrap overflow-hidden"
      style={{ width, height: '37px', marginLeft: '-2px', marginTop: '-2px' }}
    >
      <div className="flex items-center justify-center w-9 h-full border-r border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400 shrink-0">
        {type === 'date' ? (
          <button
            type="button"
            className="w-full h-full flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onMouseDown={(e) => e.preventDefault()}
            disabled={isAuto}
            onClick={onPickerToggle}
          >
            <Calendar size={19} />
          </button>
        ) : (
          <span className="text-gray-400 font-bold italic">#</span>
        )}
      </div>

      {children}

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
            readOnly
            className="w-3.5 h-3.5 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
          />
          <span className="text-[11px] text-blue-700 dark:text-blue-400 font-bold">自動</span>
        </div>
      )}
    </div>
  );
};

const EditableInput = memo(({
  value, onChange, type = "text", className = "", min, max, step, precision, suffix, readOnly, isAuto, onToggleAuto, highlight, autoPercent, onInputChange, placeholder, isFocused, onFocusChange, onEditingChange, onTab, isEditing: isGlobalEditing
}: EditableInputProps) => {
  const [val, setVal] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [shouldFlash, setShouldFlash] = useState(false);
  const isCommittingRef = useRef(false);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevValueRef = useRef(value);
  const shouldSelectOnFocus = useRef(true);
  const isActuallyReadOnly = !!(readOnly || isAuto);

  // 値の初期化と同期
  useEffect(() => {
    const isValueChanged = prevValueRef.current !== value;

    if ((!isEditing || isAuto) && (isValueChanged || val === '')) {
      let initVal = value != null ? String(value) : '';
      if (type === 'date') {
        initVal = formatDateForInput(value);
      } else if (type === 'number' && precision !== undefined && value !== '' && value != null) {
        const num = Number(value);
        if (!isNaN(num)) initVal = num.toFixed(precision);
      }
      setVal(initVal);
      if (onInputChange && type === 'number') {
        onInputChange(value != null ? Number(value) : null);
      }
      if (!isAuto) isCommittingRef.current = false;
    }

    // 外部（自動）での値更新を検知してフラッシュさせる
    if (!isEditing && isValueChanged) {
      setShouldFlash(true);
      const timer = setTimeout(() => setShouldFlash(false), 1000);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value, isEditing, type, precision, isAuto, onInputChange, val]);

  // グローバルな編集モードが有効でフォーカスされた場合、自動的に編集開始
  useEffect(() => {
    if (isFocused && isGlobalEditing && !isEditing && !isActuallyReadOnly) {
      setIsEditing(true);
      if (onEditingChange) onEditingChange(true);
      isCommittingRef.current = false;
    }
  }, [isFocused, isGlobalEditing, isEditing, isActuallyReadOnly, onEditingChange]);

  // 更新の確定処理
  const handleCommit = useCallback((newVal: string) => {
    if (!isEditing || isCommittingRef.current) return;

    if (isAuto) {
      setIsEditing(false);
      if (onEditingChange) onEditingChange(false);
      if (onFocusChange) onFocusChange(true);
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
          if (onEditingChange) onEditingChange(false);
          if (onFocusChange) onFocusChange(true);
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
          if (onEditingChange) onEditingChange(false);
          if (onFocusChange) onFocusChange(true);
          return;
        }
        if (min !== undefined && numVal < Number(min)) numVal = Number(min);
        if (max !== undefined && numVal > Number(max)) numVal = Number(max);
        valueToSave = numVal;
      }
    }

    const currentValAsString = type === 'date' ? (value || '') : (value != null ? String(value) : '');
    const newValAsString = type === 'number' && valueToSave != null ? String(valueToSave) : String(valueToSave || '');

    if (newValAsString !== currentValAsString) {
      isCommittingRef.current = true;
      onChange(valueToSave);
      if (onInputChange && type === 'number') {
        onInputChange(valueToSave);
      }
    }
    setIsEditing(false);
    if (onEditingChange) onEditingChange(false);
    if (onFocusChange) onFocusChange(true); // 編集終了時にフォーカス状態に戻す
  }, [isEditing, value, onChange, type, min, max, isAuto, onInputChange, onFocusChange, onEditingChange]);

  // 入力変更ハンドラ
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    const nativeEvent = e.nativeEvent as any;
    const inputType = nativeEvent.inputType;

    if (autoPercent && inputType === 'insertText' && /^[1-9]$/.test(newVal)) {
      const valueWithZero = newVal + '0';
      setVal(valueWithZero);
      if (onInputChange) {
        const num = Number(valueWithZero);
        if (!isNaN(num)) onInputChange(num);
      }
      setTimeout(() => inputRef.current?.setSelectionRange(1, 2), 0);
    } else {
      setVal(newVal);
      if (onInputChange) {
        const num = Number(newVal);
        if (!isNaN(num)) onInputChange(num);
      }
    }
  };

  // 外側クリックで確定
  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        handleCommit(val);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, val, handleCommit]);

  // Esc/Enterキーのグローバル監視 (特に自動ON時などでインプットが非活性の場合の対応)
  // 捕捉フェーズ(true)でリッスンすることで、親のモーダル（DetailModal等）の Esc 処理よりも優先させる
  useEffect(() => {
    if (!isEditing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('[data-modal-active="true"]')) return;

      // ナビゲーションキーを捉えたら、親のWBSTree等に伝播させない(編集中にセル移動等が起きないように)
      // インプットが活性ならインプット自身の挙動(数値の上下等)を優先し、非活性(isAuto)ならここで確実に止める
      const navKeys = ['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (navKeys.includes(e.key)) {
        if (isAuto || e.target !== inputRef.current) {
          e.stopPropagation();
        }
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setVal(type === 'date' ? formatDateForInput(value) : (value != null ? String(value) : ''));
        setIsEditing(false);
        if (onEditingChange) onEditingChange(false);
        if (onFocusChange) onFocusChange(true);
      } else if (e.key === 'Enter' && !e.isComposing) {
        // 他のテキスト入力フィールドにフォーカスがある場合はそちらを優先
        const target = e.target as HTMLElement;
        const isOtherInput = (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && 
                           target !== inputRef.current && 
                           (target as HTMLInputElement).type !== 'checkbox';
        
        if (!isOtherInput) {
          e.preventDefault();
          handleCommit(val);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        handleCommit(val);
        if (onTab) onTab(e.shiftKey);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isEditing, value, type, val, handleCommit, onEditingChange, onFocusChange]);


  // フォーカス中に F2/Enter または文字入力で編集モードに入る (Excelスタイル)
  useEffect(() => {
    if (isFocused && !isEditing && !isActuallyReadOnly) {
      const handleGlobalKey = (e: KeyboardEvent) => {
        if (document.querySelector('[data-modal-active="true"]')) return;

        // すでにフォーカスされている入力要素がある場合は無視
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

        // F2 or Enter: 既存の値を維持して編集開始
        if (e.key === 'F2' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          shouldSelectOnFocus.current = true;
          setIsEditing(true);
          if (onEditingChange) onEditingChange(true);
          isCommittingRef.current = false;
          return;
        }

        // 文字入力: 既存の値を消去して入力した文字で編集開始
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          shouldSelectOnFocus.current = false;
          setVal(e.key);
          setIsEditing(true);
          if (onEditingChange) onEditingChange(true);
          isCommittingRef.current = false;
          return;
        }

        // Delete: 値をクリア
        if (e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          const emptyValue = type === 'text' ? '' : null;
          setVal(''); // 即座にローカルの表示をクリア
          onChange(emptyValue);
          if (onInputChange && type === 'number') {
            onInputChange(null);
          }
        }
      };

      window.addEventListener('keydown', handleGlobalKey, true);
      return () => window.removeEventListener('keydown', handleGlobalKey, true);
    }
  }, [isFocused, isEditing, isActuallyReadOnly, type, onChange, onInputChange, onEditingChange]);

  const displayValueText = () => {
    if (type === 'date') {
      if (value) return formatDisplayDate(value, type);
      if (isAuto) return <span className="text-gray-400 dark:text-slate-500 text-[10px] italic font-bold">(自動)</span>;
      return <span className="text-gray-300 dark:text-slate-600 text-[10px]">--/--</span>;
    }
    if (value == null || value === '') return <span className="text-gray-300 dark:text-slate-600 text-[10px]">-</span>;

    let formattedValue = value;
    if (type === 'number' && value !== '' && value != null) {
      const num = Number(value);
      if (!isNaN(num)) {
        // 指定された精度、またはデフォルトで小数点第一位まで
        const p = precision !== undefined ? precision : 1;
        const fixed = num.toFixed(p);
        // 小数点以下が0の場合は整数として表示 (例: 3.0 -> 3)
        formattedValue = Number.parseFloat(fixed).toString();
      }
    }
    return `${formattedValue}${suffix || ''}`;
  };

  // 表示モード
  if (!isEditing) {
    return (
      <DisplayView
        type={type}
        value={value}
        suffix={suffix}
        precision={precision}
        isAuto={isAuto}
        isActuallyReadOnly={isActuallyReadOnly}
        readOnly={readOnly}
        highlight={highlight}
        className={`${className} ${shouldFlash ? 'animate-auto-flash' : ''} ${isFocused ? 'ring-2 ring-blue-500 ring-inset z-10' : ''}`}
        onClick={() => {
          if (readOnly) return;
          if (onFocusChange) onFocusChange(true);
          setIsEditing(true);
          if (onEditingChange) onEditingChange(true);
          isCommittingRef.current = false;
        }}
        displayValue={displayValueText}
      />
    );
  }

  // 編集モード
  const inputProps = {
    ref: inputRef,
    type: (type === 'date' || autoPercent) ? 'text' : (type === 'number' ? 'number' : type),
    inputMode: autoPercent ? 'numeric' as const : undefined,
    placeholder: placeholder || (type === 'date' ? "YYYY/MM/DD" : (type === 'number' ? "0.0" : "名称を入力")),
    value: val,
    autoFocus: true,
    disabled: isAuto,
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      if (shouldSelectOnFocus.current) {
        e.target.select();
      } else {
        // 直接入力の場合は末尾にカーソルを置く
        const len = e.target.value.length;
        e.target.setSelectionRange(len, len);
      }
    },
    onChange: handleInputChange,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      // 親のキーボードナビゲーション（WBSTree）にイベントが伝わらないように止める
      if (['Enter', 'Escape', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.stopPropagation();
      }

      if (e.key === 'Enter') {
        handleCommit((e.target as HTMLInputElement).value);
      } else if (e.key === 'Escape') {
        setVal(type === 'date' ? formatDateForInput(value) : (value != null ? String(value) : ''));
        setIsEditing(false);
        if (onEditingChange) onEditingChange(false);
        if (onFocusChange) onFocusChange(true);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        handleCommit((e.target as HTMLInputElement).value);
        if (onTab) onTab(e.shiftKey);
      }
    },
    min: min ?? undefined,
    max: max ?? undefined,
    step,
  };

  const isPopover = type === 'date' || (type === 'number' && onToggleAuto);

  return (
    <div
      ref={containerRef}
      className={isPopover ? "relative w-full h-full" : "w-full h-full"}
      style={isPopover ? { zIndex: 1000, overflow: 'visible' } : {}}
    >
      {isPopover ? (
        <PopoverEditor
          type={type}
          isAuto={isAuto}
          onToggleAuto={onToggleAuto}
          onPickerToggle={(e: React.MouseEvent) => {
            e.stopPropagation();
            try { (datePickerRef.current as any)?.showPicker(); } catch (err) { datePickerRef.current?.click(); }
          }}
        >
          <input
            {...inputProps}
            className="flex-1 bg-transparent min-w-0 h-full border-none outline-none px-2 text-sm font-bold text-gray-800 dark:text-slate-100 disabled:text-gray-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed"
          />
        </PopoverEditor>
      ) : (
        <input
          {...inputProps}
          className={`bg-white dark:bg-slate-800 h-full border-2 border-blue-400 outline-none px-1 w-full shadow-sm rounded text-gray-800 dark:text-slate-100 ${className}`}
        />
      )}

      {type === 'date' && (
        <input
          type="date"
          ref={datePickerRef}
          className="absolute opacity-0 w-0 h-0"
          style={{ left: 0, bottom: 0 }}
          value={value || ''}
          min={min ?? undefined}
          max={max ?? undefined}
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
