# Web版WBS管理ツール
Excelで行っているWBS管理をWeb化し、複数プロジェクトの横断管理や直感的なガントチャート描画を提供するツールです。

## 必要要件
このプロジェクトをローカル環境で動かすには、以下のソフトウェアがインストールされている必要があります。

* **Python 3.10以上**（バックエンド用）
* **Node.js 18以上**（フロントエンド用）
* **PostgreSQL 14以上**（データベース用）

---

## セットアップ手順

### 1. DB・バックエンドのセットアップ
PostgreSQLがローカルで動作していることを確認します。

#### 接続情報の設定（.env）
バックエンドのディレクトリ（`backend/`）にある `.env` ファイルでデータベースの接続情報を管理します。
1.  `backend/.env.example` をコピーして `backend/.env` を作成します。
2.  作成した `.env` ファイルを開き、環境に合わせて接続要件を編集します。

### バックエンドのセットアップ
PowerShellを開き、プロジェクトのルートディレクトリで以下のコマンドを実行します。

```powershell
# バックエンドのディレクトリへ移動
cd backend

# Python仮想環境の作成と有効化
python -m venv venv
.\venv\Scripts\activate

# 必要なライブラリのインストール
pip install .

# 設定ファイルの準備（.envがない場合）
if (-not (Test-Path .env)) { copy .env.example .env }

# DBの作成（wbs_dbを自動作成します）
python setup_db.py

# DBのマイグレーション（モデル変更時など）
powershell -ExecutionPolicy Bypass -File .\migrate_db.ps1

# 初期データ投入
powershell -ExecutionPolicy Bypass -File .\seed_db.ps1

# サーバーの起動 ( http://localhost:8000 で動作します )
uvicorn app.main:app --reload
```

### 2. フロントエンドのセットアップ
新しいPowerShellウィンドウを開き、プロジェクトのルートディレクトリで以下のコマンドを実行します。

```powershell
# フロントエンドのディレクトリへ移動
cd frontend

# 必要なパッケージのインストール
npm install

# 開発用サーバーの起動 ( デフォルトでは http://localhost:5173 で動作します )
npm run dev
```

#### サブディレクトリ配下で公開する場合
`http://<ホスト名>/wbs` のようにルート以外へ配置する場合は、`frontend/.env.example` を参考に `frontend/.env` を作成し、配置パスとAPIのベースURLを指定します。

```env
VITE_BASE_PATH=/wbs/
VITE_API_BASE_URL=/wbs/api/
```

API を別ホストで動かす場合は、`VITE_API_BASE_URL=http://localhost:8000/api/` のような絶対URLも指定できます。

### Windows Server / IIS へのデプロイ
Windows Server および IIS を利用した社内公開・常時稼働の手順は、[IIS セットアップガイド](IIS_Setup_Guide.md) に詳細をまとめています。

---

## ディレクトリ構成
* `backend/` : FastAPIによるバックエンドAPIのソースコードやDB関連スクリプト
* `frontend/` : React + Vite + Tailwind CSS によるフロントエンドアプリのソースコード
* `docs/` : 要件定義書、UI設計書、API仕様書などのドキュメント群

## 利用ガイド (USER_GUIDE.md)
一般的な操作方法や機能の詳細は、[利用ガイド](docs/USER_GUIDE.md) を参照してください。
初めて利用するユーザーや、操作方法を確認したい場合に役立ちます。

### フロントエンドの再ビルド（更新時）
ソースコードの変更を反映させるためにフロントエンドのみを再ビルドする場合は、以下のスクリプトを使用できます。
*   `rebuild_frontend.ps1` (PowerShell)
*   `rebuild_frontend.bat` (コマンドプロンプト)

これらのスクリプトは、フロントエンドのディレクトリへ移動し、`npm run build` を実行して最新のソースコードをビルドします。
