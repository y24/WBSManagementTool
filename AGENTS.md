# AGENTS.md - WBS Management Tool 開発ガイドライン

## プロジェクト前提

WBS（Work Breakdown Structure）管理ツール。プロジェクト、タスク、サブタスクの3階層で工程を管理し、ガントチャートで進捗を可視化するWebアプリケーションです。

- Backend: Python / FastAPI / SQLAlchemy / Pydantic / Alembic / PostgreSQL
- Frontend: React / Vite / TypeScript / Tailwind CSS / Lucide React

既存の構成、命名、型定義、ユーティリティを優先し、変更範囲を必要最小限に保ってください。

## 実装上の必須ルール

### UI/UX

- ガントチャートや通常情報の表示には、落ち着いた muted な配色を使ってください。日付ヘッダ、ステータス、マーカーなどに強い警告色や原色を不用意に使わないでください。
- ガントチャートの進捗バーとレビュー部分の境界は、グラデーションや blur で滑らかに表現してください。
- ホバー時のプレビュー線などの補助表示は、太すぎない控えめな表現にしてください。
- 進捗率の表示/非表示などの UI オプションは `localStorage` に保存し、リロード後も維持してください。

### モーダル

全てのモーダル（詳細、削除、一括処理、エクスポート等）では、以下を標準実装してください。

- Escape キーで閉じられること。
- 編集中など未保存の変更がある場合は、閉じる前に確認ダイアログを表示すること。

### データ仕様

- 新規作成（`ProjectCreate`, `TaskCreate`, `SubtaskCreate`）時の `status_id` は、原則として `1`（新規）をデフォルトにしてください。
- 削除は原則として `is_deleted = True` による論理削除にしてください。
- `is_system_reserved=True` などの予約済みマスタデータは、設計意図を確認せずに変更・削除しないでください。
- `backend/setup_db.py` はマスタデータ定義とテーブル初期化を担うため、変更時は初期構築への影響を確認してください。

### WBS 操作

- 階層データを削除する場合は、配下のプロジェクト/タスク/サブタスクへの影響範囲を再帰的に集計し、ユーザーに具体的に提示してください。
- Excel エクスポートは、そのままインポート可能なフォーマットを維持してください。
- Excel のカラム幅など、既存の使いやすさに関わる出力仕様を不用意に崩さないでください。

## 編集後の検証手順

### バックエンド

作業ディレクトリは `D:\Script\WBSManagementTool\backend` にしてください。グローバルの `pytest` や `python` は使わず、仮想環境の Python を直接指定します。

```powershell
.\venv\Scripts\python.exe -m pytest -p no:cacheprovider
```

- `-p no:cacheprovider` は `backend\.pytest_cache` への書き込み権限エラーや警告を避けるために付けます。
- Pydantic v2 の非推奨警告などが出ても、テスト結果が `passed` であれば検証完了として扱って構いません。

### フロントエンド

作業ディレクトリは `D:\Script\WBSManagementTool\frontend` にしてください。

```powershell
npm run build
```

- Codex の sandbox 内では、Vite/Tailwind の native module 読み込みや Node の `spawn` が `EPERM` / `UNLOADABLE_DEPENDENCY` で失敗することがあります。
- フロントエンドのビルド確認が必要な場合は、同じ失敗を待たず、最初から権限昇格付きで `npm run build` を実行してください。
- `node_modules` は既に存在する前提です。依存関係が壊れている場合を除き、`npm install` や `npm ci` を先に実行しないでください。

### Git

- `git status` が `backend/.pytest_cache/` の Permission denied で失敗する場合があります。これはテスト結果とは別問題です。
- `.pytest_cache` を削除・権限変更して回避しようとせず、必要に応じて権限昇格付きで状態確認するか、対象ファイルを明示して差分確認してください。
