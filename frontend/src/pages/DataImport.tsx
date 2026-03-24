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
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-800">データインポート</h1>
        </div>

        <div className="import-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download size={20} className="text-blue-600" />
            1. テンプレートの準備
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            インポート用のExcelテンプレートをダウンロードして、データを入力してください。<br />
            既存のマスターデータ（担当者、ステータス、種別）と一致させる必要があります。
          </p>
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors font-medium"
          >
            <Download size={18} />
            テンプレートをダウンロード
          </button>
        </div>

        <div className="import-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload size={20} className="text-blue-600" />
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
              <Loader2 size={48} className="text-blue-500 animate-spin" />
            ) : file ? (
              <FileCheck size={48} className="text-green-500" />
            ) : (
              <Upload size={48} className="text-slate-400" />
            )}
            <div>
              <p className="font-semibold text-slate-700">
                {file ? file.name : 'クリックまたはドラッグ＆ドロップでアップロード'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Excel形式 (.xlsx) のみ対応</p>
            </div>
          </div>

          {message && (
            <div className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}
        </div>

        {previewRows.length > 0 && (
          <div className="import-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FileCheck size={20} className="text-blue-600" />
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
                  <tr>
                    <th>行</th>
                    <th>階層</th>
                    <th>名称 / 詳細</th>
                    <th>ステータス</th>
                    <th>担当者</th>
                    <th>開始(計画)</th>
                    <th>終了(計画)</th>
                    <th>レビュー日数</th>
                    <th>エラー内容</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr 
                      key={row.row_index} 
                      className={`import-preview-row-${row.level} ${row.errors.length > 0 ? 'import-preview-row-error' : ''}`}
                    >
                      <td className="text-center text-slate-400 font-mono">{row.row_index}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          row.level === 0 ? 'bg-blue-100 text-blue-700' : 
                          row.level === 1 ? 'bg-slate-200 text-slate-700' : 
                          'bg-white text-slate-600 border border-slate-200'
                        }`}>
                          {row.level === 0 ? 'Project' : row.level === 1 ? 'Task' : 'Subtask'}
                        </span>
                      </td>
                      <td className="font-medium">{row.name}</td>
                      <td>{row.status}</td>
                      <td>{row.assignee}</td>
                      <td className="font-mono text-[11px]">{row.planned_start || '-'}</td>
                      <td className="font-mono text-[11px]">{row.planned_end || '-'}</td>
                      <td className="text-center">{row.review_days != null ? row.review_days : '-'}</td>
                      <td>
                        {row.errors.length > 0 && (
                          <ul className="import-error-list">
                            {row.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                          </ul>
                        )}
                        {row.errors.length === 0 && (
                          <span className="text-green-600 flex items-center gap-1">
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
