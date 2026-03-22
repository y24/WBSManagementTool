# Web版WBS管理ツール
Excelで行っているWBS管理をWeb化し、複数プロジェクトの横断管理や直感的なガントチャート描画を提供する社内向けツールです。

## 必要要件
このプロジェクトをローカル環境で動かすには、以下のソフトウェアがインストールされている必要があります。

* **Python 3.10以上**（バックエンド用）
* **Node.js 18以上**（フロントエンド用）
* **PostgreSQL 14以上**（データベース用）

---

## セットアップ手順（Windows環境向け）

### 1. データベースのセットアップ
PostgreSQLがローカルで動作していることを確認します。

#### 接続情報の設定（.env）
バックエンドのディレクトリ（`backend/`）にある `.env` ファイルでデータベースの接続情報を管理します。
1.  `backend/.env.example` をコピーして `backend/.env` を作成します。
2.  作成した `.env` ファイルを開き、環境に合わせて接続要件を編集します。

初期設定（.env.example）の内容：
* DB_HOST=localhost
* DB_PORT=5432
* DB_USER=postgres
* DB_PASS=admin
* DB_NAME=wbs_db

#### データベース構築の実行コマンド
Pythonのスクリプトを用いて、自動で空のデータベースを作成します。（※後で仮想環境が有効な状態で実行します）

### 2. バックエンド（FastAPI）のセットアップ
PowerShellを開き、プロジェクトのルートディレクトリで以下のコマンドを実行します。

```powershell
# バックエンドのディレクトリへ移動
cd backend

# Python仮想環境の作成と有効化
python -m venv venv
.\venv\Scripts\activate

# 必要なライブラリのインストール
pip install fastapi uvicorn sqlalchemy alembic psycopg2-binary pydantic pydantic-settings httpx python-dotenv

# 設定ファイルの準備（.envがない場合）
if (-not (Test-Path .env)) { copy .env.example .env }

# DBの作成（wbs_dbを自動作成します）
python setup_db.py
```


# フェーズ2：モデル情報のDB反映(マイグレーション)と初期データの投入をスクリプトで一括実行
powershell -ExecutionPolicy Bypass -File .\setup_phase2.ps1

# サーバーの起動 ( http://localhost:8000 で動作します )
uvicorn app.main:app --reload
```

> **注意:** 別のターミナルを開き直した際は、必ず `.\venv\Scripts\activate` を実行してからコマンドを実行してください。

### 3. フロントエンド（React）のセットアップ
新しいPowerShellウィンドウを開き、プロジェクトのルートディレクトリで以下のコマンドを実行します。

```powershell
# フロントエンドのディレクトリへ移動
cd frontend

# 必要なパッケージのインストール
npm install

# 開発用サーバーの起動 ( デフォルトでは http://localhost:5173 で動作します )
npm run dev
```

---

## ディレクトリ構成
* `backend/` : FastAPIによるバックエンドAPIのソースコードやDB関連スクリプト
* `frontend/` : React + Vite + Tailwind CSS によるフロントエンドアプリのソースコード
* `docs/` : 要件定義書、UI設計書、API仕様書などのドキュメント群

## Windows Server / IIS へのデプロイ
Windows Server および IIS を利用した社内公開・常時稼働の手順は、[IIS セットアップガイド](IIS_Setup_Guide.md) に詳細をまとめています。

### クイックセットアップ（サーバー用）
1.  管理者権限で `server_setup.bat` を実行します。
2.  スクリプトがビルドと環境構築を自動で行います。
3.  詳細はガイドに従って IIS のサイトを作成してください。

## 今後の拡張（未実装機能）
* Azure DevOps等の外部チケットシステム連携
* Active Directory/SSOによる認証連携の追加やユーザ別・グループ別の閲覧制御
