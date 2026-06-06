import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, Check, Hash, MessageSquare, ExternalLink, Link, FolderKanban, ListTodo, AlignLeft, AlertTriangle, Pause, RefreshCw, Loader2 } from 'lucide-react';
import { wbsOps } from '../../api/wbsOperations';

export type EditingType = 'project' | 'task' | 'subtask';

interface DetailModalProps {
  editingType: EditingType;
  editingName: string;
  detailValue: string;
  setDetailValue: (v: string) => void;
  ticketIdValue: string;
  setTicketIdValue: (v: string) => void;
  linkUrlValue: string;
  setLinkUrlValue: (v: string) => void;
  memoValue: string;
  setMemoValue: (v: string) => void;
  syncToAzureDevops: boolean;
  setSyncToAzureDevops: (v: boolean) => void;
  parentTicketId?: number | null;
  ticketUrlTemplate?: string | null;
  onClose: () => void;
  onSave: () => void;
  onOpenInterruption?: () => void;
  disableHotkeys?: boolean;
}

const TYPE_LABELS: Record<EditingType, { label: string; icon: React.ReactNode }> = {
  project: { label: 'プロジェクト', icon: <FolderKanban size={18} className="text-violet-500" /> },
  task: { label: 'タスク', icon: <ListTodo size={18} className="text-blue-500" /> },
  subtask: { label: 'サブタスク', icon: <AlignLeft size={18} className="text-teal-500" /> },
};

const formatWorkItemCandidateLabel = (candidate: WorkItemCandidate) => {
  const typeLabel = candidate.work_item_type || 'Work Item';
  return candidate.title
    ? `${typeLabel} ${candidate.id}: ${candidate.title}`
    : `${typeLabel} ${candidate.id}`;
};

const DetailModal = ({
  editingType,
  editingName,
  detailValue,
  setDetailValue,
  ticketIdValue,
  setTicketIdValue,
  linkUrlValue,
  setLinkUrlValue,
  memoValue,
  setMemoValue,
  syncToAzureDevops,
  setSyncToAzureDevops,
  ticketUrlTemplate,
  parentTicketId,
  onClose,
  onSave,
  onOpenInterruption,
  disableHotkeys = false,
}: DetailModalProps) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [childCandidates, setChildCandidates] = useState<WorkItemCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [candidateError, setCandidateError] = useState<string | null>(null);
  const isMountedRef = useRef(false);

  // 初期値を保持
  const initialValues = useRef({
    detailValue,
    ticketIdValue,
    linkUrlValue,
    memoValue,
    syncToAzureDevops,
  });

  const isChanged = () => {
    return (
      detailValue !== initialValues.current.detailValue ||
      ticketIdValue !== initialValues.current.ticketIdValue ||
      linkUrlValue !== initialValues.current.linkUrlValue ||
      memoValue !== initialValues.current.memoValue ||
      syncToAzureDevops !== initialValues.current.syncToAzureDevops
    );
  };

  const handleCloseRequest = () => {
    if (isChanged()) {
      setShowConfirm(true);
    } else {
      onClose();
    }
  };

  // Esc/Enterキーイベントの監視
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disableHotkeys) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (showConfirm) {
          setShowConfirm(false);
        } else {
          handleCloseRequest();
        }
      } else if (e.key === 'Enter') {
        // テキストエリアでのEnterは改行を許可するため保存しない
        const target = e.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [detailValue, ticketIdValue, linkUrlValue, memoValue, syncToAzureDevops, showConfirm, onSave, disableHotkeys]);

  const ticketUrl = ticketUrlTemplate && ticketIdValue
    ? ticketUrlTemplate.replace('{TICKET_ID}', ticketIdValue)
    : null;

  const canLoadChildCandidates = editingType !== 'project' && !!parentTicketId;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadChildCandidates = useCallback(async (forceRefresh = false) => {
    if (!canLoadChildCandidates || !parentTicketId) {
      setChildCandidates([]);
      setCandidateError(null);
      return;
    }

    setIsLoadingCandidates(true);
    setCandidateError(null);
    try {
      const res = await wbsOps.getAzureDevopsChildWorkItems(parentTicketId, { forceRefresh });
      if (!isMountedRef.current) return;
      setChildCandidates(res.data);
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error(err);
      setChildCandidates([]);
      setCandidateError('Azure DevOpsのChild候補を取得できませんでした。');
    } finally {
      if (!isMountedRef.current) return;
      setIsLoadingCandidates(false);
    }
  }, [canLoadChildCandidates, parentTicketId]);

  useEffect(() => {
    loadChildCandidates();
  }, [loadChildCandidates]);

  const { label, icon } = TYPE_LABELS[editingType];

  return createPortal(
    <div
      data-modal-active="true"
      className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[calc(100vh-2rem)] overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50">
          <h3 className="font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
            <FileText size={18} className="text-gray-500 dark:text-slate-400" />
            詳細情報の編集
          </h3>
          <button
            onClick={handleCloseRequest}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {/* Target label */}
        <div className="flex items-center gap-2 px-6 py-2.5 bg-gray-50 dark:bg-slate-800/80 border-b dark:border-slate-800 text-sm text-gray-600 dark:text-slate-300">
          {icon}
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
          <span className="font-medium text-gray-700 dark:text-slate-200 truncate" title={editingName}>{editingName}</span>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6">
            <div className="space-y-5">
              {/* ticket_id */}
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Hash size={12} className="text-indigo-500" />
                  チケットID
                  {ticketUrl && (
                    <a
                      href={ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 normal-case tracking-normal transition-colors"
                    >
                      <Link size={11} />
                      チケットを開く
                    </a>
                  )}
                </label>
                <input
                  id="modal-ticket-id-input"
                  name="ticket-id"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100 font-medium"
                  value={ticketIdValue}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, '');
                    setTicketIdValue(v);
                  }}
                  placeholder="チケットIDを入力..."
                />
                {ticketUrl && (
                  <p className="mt-1 text-xs text-gray-400 dark:text-slate-500 truncate px-1" title={ticketUrl}>
                    🔗 {ticketUrl}
                  </p>
                )}
                {ticketIdValue && (
                  <label className="mt-2.5 flex items-center gap-2 cursor-pointer select-none w-fit">
                    <input
                      type="checkbox"
                      checked={!syncToAzureDevops}
                      onChange={(e) => setSyncToAzureDevops(!e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-xs text-gray-500 dark:text-slate-400">情報を同期しない</span>
                  </label>
                )}
              </div>

              {editingType !== 'project' && parentTicketId && (
                <div className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-800/40 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                      候補
                    </span>
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">親チケット: {parentTicketId}</span>
                    {canLoadChildCandidates && (
                      <button
                        type="button"
                        onClick={() => loadChildCandidates(true)}
                        disabled={isLoadingCandidates}
                        className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-gray-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-60"
                      >
                        {isLoadingCandidates ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        再取得
                      </button>
                    )}
                  </div>
                  {candidateError && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{candidateError}</p>
                  )}
                  {isLoadingCandidates && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">候補を取得しています...</p>
                  )}
                  {!isLoadingCandidates && canLoadChildCandidates && !candidateError && childCandidates.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">Child候補はありません。</p>
                  )}
                  {childCandidates.length > 0 && (
                    <div className="mt-2 max-h-64 lg:max-h-[21rem] overflow-y-auto space-y-1 pr-1">
                      {childCandidates.map((candidate) => (
                        <button
                          key={candidate.id}
                          type="button"
                          onClick={() => setTicketIdValue(String(candidate.id))}
                          title={formatWorkItemCandidateLabel(candidate)}
                          className={`w-full rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                            ticketIdValue === String(candidate.id)
                              ? 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate">
                              {formatWorkItemCandidateLabel(candidate)}
                            </span>
                            {candidate.state && (
                              <span className="shrink-0 text-gray-400 dark:text-slate-500">{candidate.state}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-5">
              {/* detail */}
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <div className="w-1 h-3 bg-blue-500 rounded-full" />
                  詳細 <span className="text-gray-400 dark:text-slate-500 font-normal normal-case">(1行テキスト)</span>
                </label>
                <input
                  id="modal-detail-input"
                  type="text"
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100 font-medium"
                  value={detailValue}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setDetailValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSave();
                  }}
                  placeholder="詳細を入力してください..."
                />
              </div>

              {/* link_url */}
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ExternalLink size={12} className="text-blue-500" />
                  リンク先URL
                  {linkUrlValue && (
                    <a
                      href={linkUrlValue.startsWith('http') ? linkUrlValue : `https://${linkUrlValue}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 normal-case tracking-normal transition-colors"
                    >
                      <ExternalLink size={11} />
                      リンクを開く
                    </a>
                  )}
                </label>
                <input
                  id="modal-link-url-input"
                  type="text"
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm transition-all shadow-inner bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100 font-medium"
                  value={linkUrlValue}
                  onChange={(e) => setLinkUrlValue(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>

              {/* memo */}
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare size={12} className="text-gray-500 dark:text-slate-400" />
                  メモ <span className="text-gray-400 dark:text-slate-500 font-normal normal-case">(複数行)</span>
                </label>
                <textarea
                  id="modal-memo-input"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none text-sm transition-all shadow-inner bg-gray-50/50 dark:bg-slate-800/50 text-gray-900 dark:text-slate-100 font-medium resize-none"
                  value={memoValue}
                  onChange={(e) => setMemoValue(e.target.value)}
                  placeholder="メモを入力してください..."
                  rows={6}
                />
              </div>

              {editingType === 'subtask' && onOpenInterruption && (
                <div className="pt-1">
                  <button
                    onClick={onOpenInterruption}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-xl transition-all"
                  >
                    <Pause size={16} />
                    中断・再開の管理
                  </button>
                  <p className="mt-1.5 text-[11px] text-gray-400 dark:text-slate-500 px-1">
                    稼働が中断した期間を設定して、ガントチャート上の表示を分割できます。
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-t dark:border-slate-800 items-center shrink-0">
          <button
            onClick={handleCloseRequest}
            className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700 border border-transparent rounded-lg transition-all"
          >
            キャンセル
          </button>
          <button
            id="modal-save-button"
            onClick={onSave}
            className="flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all active:scale-95"
          >
            <Check size={16} />
            保存する
          </button>
        </div>
      </div>
      {showConfirm && <SmallConfirmModal onConfirm={onClose} onCancel={() => setShowConfirm(false)} />}
    </div>,
    document.body
  );
};

interface WorkItemCandidate {
  id: number;
  title?: string | null;
  work_item_type?: string | null;
  state?: string | null;
}

// 確認用の小さなモーダルコンポーネント（内部使用）
const SmallConfirmModal = ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onConfirm, onCancel]);

  return (
    <div
      data-modal-active="true"
      className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 dark:border-slate-800 animate-in zoom-in-95 duration-200 p-6">
        <div className="flex items-center gap-3 text-amber-500 mb-4">
          <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-full">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">変更を破棄しますか？</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-6 leading-relaxed">
          入力された内容が保存されていません。変更を破棄して編集を終了してもよろしいですか？
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-xl transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition-all active:scale-95"
          >
            破棄して閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailModal;
