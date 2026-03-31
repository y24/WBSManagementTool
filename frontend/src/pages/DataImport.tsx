import React, { useState, useRef } from 'react';
import { Download, Upload, FileCheck, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { wbsOps } from '../api/wbsOperations';
import { useNavigate } from 'react-router-dom';

interface ImportPreviewRow {
  row_index: number;
  level: number;
  name: string;
  status?: string;
  assignee?: string;
  type?: string;
  ticket_id?: string;
  planned_start?: string;
  planned_end?: string;
  planned_effort?: number;
  actual_start?: string;
  actual_end?: string;
  actual_effort?: number;
  progress_percent?: number;
  review_days?: number;
  workload?: number;
  memo?: string;
  errors: string[];
}

export default function DataImport() {
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [canImport, setCanImport] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleDownloadTemplate = async () => {
    try {
      const isDark = document.documentElement.classList.contains('dark');
      // The following line appears to be out of context for this function and component.
      // It refers to variables (isSubtask, getStatusColor, item) not defined here.
      // As per instructions to make the file syntactically correct, this line is omitted.
      // const typeColor = isSubtask ? getStatusColor(item.status_id) : (isDark ? '#4b5563' : '#cbd5e1');
      const response = await wbsOps.getImportTemplate();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'wbs_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to download template', err);
      setMessage({ type: 'error', text: 'テンプレートのダウンロードに失敗しました。' });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file: File) => {
    setFile(file);
    setIsLoading(true);
    setMessage(null);
    try {
      const resp = await wbsOps.previewImport(file);
      setPreviewRows(resp.data.rows);
      setCanImport(resp.data.can_import);
      if (!resp.data.can_import) {
        setMessage({ type: 'error', text: 'バリデーションエラーがあります。修正して再度アップロードしてください。' });
      }
    } catch (err) {
      console.error('Upload failed', err);
      setMessage({ type: 'error', text: 'ファイルの読み込みに失敗しました。' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!canImport || isImporting) return;
    setIsImporting(true);
    try {
      await wbsOps.executeImport(previewRows);
      setMessage({ type: 'success', text: 'インポートが完了しました！' });
      setPreviewRows([]);
      setFile(null);
      setCanImport(false);
      // Optional: redirect to board after short delay
      setTimeout(() => navigate('/'), 2000);
    } catch (err) {
      console.error('Import failed', err);
      setMessage({ type: 'error', text: 'インポートの実行に失敗しました。' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="import-page">
      <div className="import-container">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-600 dark:text-slate-400"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">データインポート</h1>
        </div>

        <div className="import-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-slate-100">
            <Download size={20} className="text-blue-600 dark:text-blue-400" />
            1. テンプレートの準備
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            インポート用のExcelテンプレートをダウンロードして、データを入力してください。<br />
            既存のマスターデータ（担当者、ステータス、種別）と一致させる必要があります。
          </p>
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors font-medium"
          >
            <Download size={18} />
            テンプレートをダウンロード
          </button>
        </div>

        <div className="import-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 dark:text-slate-100">
            <Upload size={20} className="text-blue-600 dark:text-blue-400" />
            2. ファイルのアップロード
          </h2>
          
          <div 
            className={`import-upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".xlsx"
            />
            {isLoading ? (
              <Loader2 size={48} className="text-blue-500 dark:text-blue-400 animate-spin" />
            ) : file ? (
              <FileCheck size={48} className="text-green-500 dark:text-green-400" />
            ) : (
              <Upload size={48} className="text-slate-400 dark:text-slate-600" />
            )}
            <div>
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {file ? file.name : 'クリックまたはドラッグ＆ドロップでアップロード'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">Excel形式 (.xlsx) のみ対応</p>
            </div>
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}
        </div>

        {previewRows.length > 0 && (
          <div className="import-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 dark:text-slate-100">
                <FileCheck size={20} className="text-blue-600 dark:text-blue-400" />
                3. インポート内容の確認
              </h2>
              <button 
                onClick={handleExecuteImport}
                disabled={!canImport || isImporting}
                className="import-btn-primary flex items-center gap-2"
              >
                {isImporting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                インポートを実行
              </button>
            </div>

            <div className="import-preview-table-container">
              <table className="import-preview-table">
                <thead>
                  <tr className="dark:bg-slate-800">
                    <th className="dark:text-slate-300 dark:bg-slate-800">行</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">階層</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">名称 / 詳細</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">ステータス</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">担当者</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">開始(計画)</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">終了(計画)</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">開始(実績)</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">終了(実績)</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">工数/進捗</th>
                    <th className="dark:text-slate-300 dark:bg-slate-800">エラー内容</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr 
                      key={row.row_index} 
                      className={`import-preview-row-${row.level} ${row.errors.length > 0 ? 'import-preview-row-error dark:bg-red-900/20' : 'dark:even:bg-slate-800/10'} dark:border-slate-800`}
                    >
                      <td className="text-center text-slate-400 dark:text-slate-400 font-mono">{row.row_index}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.level === 0 ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 
                          row.level === 1 ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200' : 
                          'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                        }`}>
                          {row.level === 0 ? 'Project' : row.level === 1 ? 'Task' : 'Subtask'}
                        </span>
                      </td>
                      <td className="font-medium dark:text-slate-100">{row.name}</td>
                      <td className="dark:text-slate-200">{row.status}</td>
                      <td className="dark:text-slate-200">{row.assignee}</td>
                      <td className="font-mono text-[11px] dark:text-slate-300">{row.planned_start || '-'}</td>
                      <td className="font-mono text-[11px] dark:text-slate-300">{row.planned_end || '-'}</td>
                      <td className="font-mono text-[11px] dark:text-slate-300">{row.actual_start || '-'}</td>
                      <td className="font-mono text-[11px] dark:text-slate-300">{row.actual_end || '-'}</td>
                      <td className="text-center dark:text-slate-200">
                        <div className="flex flex-col text-[10px]">
                          <span>実: {row.actual_effort != null ? row.actual_effort : '-'}</span>
                          <span>進: {row.progress_percent != null ? `${row.progress_percent}%` : '-'}</span>
                        </div>
                      </td>
                      <td>
                        {row.errors.length > 0 && (
                          <ul className="import-error-list dark:text-red-400">
                            {row.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                          </ul>
                        )}
                        {row.errors.length === 0 && (
                          <span className="text-green-600 dark:text-green-500 flex items-center gap-1">
                            <CheckCircle2 size={12} /> OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
