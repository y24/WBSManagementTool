# WBS 管理ツール：Windows Server / IIS セットアップガイド

本ガイドは、WBS 管理ツールを Windows Server 上で常時稼働させるための手順書です。
フロントエンドを **IIS (Internet Information Services)** で公開し、バックエンドをリバースプロキシで連携する構成となります。

---

## 1. サーバー要件と事前準備

セットアップを実行する前に、以下のソフトウェアがインストールされていることを確認してください。

### 必須ソフトウェア
- **Windows Server** (2016 以降推奨)
- **Node.js 18+**
- **Python 3.10+** (システム環境変数 `PATH` に `python` と `pip` が登録されていること)
- **PostgreSQL 14+** (ローカルまたはリモートで接続可能であること)

### IIS 機能と拡張モジュール (重要)
以下の機能を「サーバー マネージャー」から有効化、またはダウンロードしてインストールしてください。

1.  **IIS (Web Server)**:
    - 静的コンテンツ (Static Content)
    - 既定の文書 (Default Document)
2.  **IIS URL Rewrite Module 2.1**:
    - [Microsoft 公式サイト](https://www.iis.net/downloads/microsoft/url-rewrite)からダウンロードしてインストールしてください。
3.  **Application Request Routing (ARR) 3.0**:
    - [Microsoft 公式サイト](https://www.iis.net/downloads/microsoft/application-request-routing)からダウンロードしてインストールしてください。

---

## 2. 自動セットアップ手順

提供されたセットアップスクリプトを使用して、プロジェクトのビルドと依存関係の準備を一括で行います。

1.  コマンドプロンプトを **管理者権限** で開きます。
2.  プロジェクトのルートディレクトリに移動します。
3.  以下のコマンドを実行します。
    ```cmd
    server_setup.bat
    ```

### スクリプトの実行内容
- バックエンドの仮想環境 (`venv`) 作成とライブラリのインストール
- **`backend/.env` の自動準備 ( `.env.example` から作成 )**
- データベースの作成とマイグレーション (`alembic upgrade`)
- 初期データの投入 (`seed.py`)
- フロントエンドの `npm install` と `npm run build`
- `frontend/dist` への `web.config` 書き出し

> [!NOTE]
> データベースの接続情報（ホスト名やパスワード等）を変更する必要がある場合は、`server_setup.bat` 実行後に `backend/.env` を編集してください。


---

## 3. IIS の設定

### A. ARR のプロキシ機能を有効化
1.  **IIS マネージャー** を開きます。
2.  左側のツリーで **サーバー名** を選択します。
3.  中央の機能リストから **[Application Request Routing Cache]** をダブルクリックして開きます。
4.  右側の操作パネルから **[Server Proxy Settings...]** をクリックします。
5.  **[Enable proxy]** にチェックを入れ、**適用** (Apply) をクリックします。

### B. ウェブサイトの作成
1.  IIS マネージャーの左側ツリーで **[サイト]** を右クリックし、**[Web サイトの追加...]** を選択します。
2.  以下の通り設定します。
    - **サイト名**: `WBSManagementTool`
    - **物理パス**: プロジェクトの `frontend\dist` フォルダを指定
3.  **OK** を押してサイトを作成します。
4.  ブラウザで `http://localhost` (または設定したドメイン/IP) にアクセスし、画面が表示されるか確認します。
    - ※ この時点では API 通信が失敗する可能性があります。

---

## 4. バックエンドの常時稼獲 (Windows サービス化)

バックエンド (FastAPI / Uvicorn) を Windows Server のバックグラウンドで常時稼働させるために、**NSSM (Non-Sucking Service Manager)** を使用してサービス化することを推奨します。

1.  [NSSM.cc](https://nssm.cc/download) から NSSM をダウンロードし、解凍します。
2.  管理者権限の PowerShell を開き、以下のコマンドを入力して設定画面を開きます。
    ```powershell
    # nssm.exe があるパスに移動し実行
    .\nssm.exe install WBS_Backend
    ```
3.  設定画面 (GUI) で以下のように入力します。
    - **Path**: `D:\Script\WBSManagementTool\backend\venv\Scripts\python.exe` (プロジェクトのフルパスに合わせて変更)
    - **Startup directory**: `D:\Script\WBSManagementTool\backend`
    - **Arguments**: `-m uvicorn app.main:app --host 127.0.0.1 --port 8000`
4.  **[Install service]** をクリックします。
5.  「サービス (services.msc)」を開き、`WBS_Backend` を開始してください。

これで、サーバー再起動時にも自動的にバックエンドが立ち上がり、IIS 経由でシステムが常時稼働します。

---

## 5. 定期メンテナンス

### システムの更新
ソースコードを更新して再デプロイする場合は、再度 `server_setup.bat` を実行してください。

### ログの確認
- IIS ログ: `%SystemDrive%\inetpub\logs\LogFiles`
- バックエンドログ: NSSM の設定で I/O リダイレクトを設定するか、手動で `backend\run_server.bat` を実行して確認してください。
