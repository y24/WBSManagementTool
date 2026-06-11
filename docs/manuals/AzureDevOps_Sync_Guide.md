# WBS管理ツール：Azure DevOps 同期 セットアップ・運用ガイド

本機能は、WBS管理ツールで管理している日付情報（開始予定日・終了予定日・開始日・終了日）、担当者、ステータスを、Azure DevOps の Work Item に定期的に反映する連携機能です。

**同期方向: WBS管理ツール → Azure DevOps（一方向のみ）**

---

## 1. 機能概要

### 同期の仕組み

1. 各プロジェクト・タスク・サブタスクの「チケットID」欄の値を Azure DevOps の **Work Item ID** として使用します。
2. 同期対象項目のハッシュ値を前回と比較し、**変更があったレコードのみ** Azure DevOps に問い合わせます。
3. Azure DevOps 側のフィールドと比較し、**実際に差分があるフィールドのみ** 更新します。

この設計により、Azure DevOps へのリクエスト数を最小限に抑えます。

### 同期対象の条件

以下をすべて満たすレコードが同期対象となります。

| 条件 | 内容 |
|---|---|
| チケットID が入力済み | 空欄のレコードはスキップ |
| Azure DevOps同期フラグ が ON | 個別に有効化が必要 |
| 論理削除されていない | 削除済みレコードは除外 |

---

## 2. セットアップ手順

### 2.1 Azure DevOps 側の準備

#### Personal Access Token (PAT) の取得

1. Azure DevOps（`https://dev.azure.com/{organization}`）にサインインします。
2. 右上のアカウントアイコン → **「Personal access tokens」** をクリックします。
3. **「New Token」** をクリックし、以下の設定でトークンを作成します。

   | 項目 | 設定値 |
   |---|---|
   | Name | WBS管理ツール同期（任意） |
   | Expiration | 運用期間に合わせて設定 |
   | Scopes | **Work Items: Read & write** |

4. 生成されたトークン文字列をコピーしておきます（**画面を閉じると再表示できません**）。

---

### 2.2 Windows ユーザー環境変数の設定

セキュリティのため、PAT および同期トークンは `.env` ファイルに書かず、**Windows のユーザー環境変数**で管理します。

1. **「システムのプロパティ」** を開きます。
   - `Windowsキー + R` → `sysdm.cpl` と入力 → Enter
2. **「詳細設定」** タブ → **「環境変数」** をクリックします。
3. **「ユーザー環境変数」** の **「新規」** をクリックし、以下の2つを登録します。

   | 変数名 | 値 | 説明 |
   |---|---|---|
   | `AZURE_DEVOPS_PAT` | （2.1で取得したPAT） | Azure DevOps 認証トークン |
   | `WBS_SYNC_TOKEN` | （任意のランダム文字列） | 同期API の保護トークン |

   `WBS_SYNC_TOKEN` の生成例（PowerShell で実行）:
   ```powershell
   [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

4. **OK** で閉じ、**サーバーを再起動**して環境変数を反映させます（またはサービスを再起動）。

---

### 2.3 `.env` ファイルの設定

`backend/.env` を編集し、Azure DevOps 連携の設定を追加します。

```ini
# Azure DevOps sync
AZURE_DEVOPS_USE_MOCK=false          # false にすると実際の Azure DevOps に接続
AZURE_DEVOPS_ORGANIZATION=your-org  # Organization 名（URLの dev.azure.com/{ここ}）
# AZURE_DEVOPS_PROJECT=             # Project 名（省略可。WorkItemIDはOrg単位で一意）
AZURE_DEVOPS_API_VERSION=7.1
AZURE_DEVOPS_BATCH_SIZE=200
AZURE_DEVOPS_TIMEOUT_SECONDS=30
AZURE_DEVOPS_CLEAR_REMOTE_WHEN_NULL=false
AZURE_DEVOPS_SUPPRESS_NOTIFICATIONS=false
```

> [!NOTE]
> `AZURE_DEVOPS_PROJECT` は **省略可能**です。Work Item ID は Organization 単位で一意のため、プロジェクト名なしで操作できます。複数プロジェクトのチケットが混在していても問題ありません。

> [!NOTE]
> `AZURE_DEVOPS_USE_MOCK=true`（デフォルト）のままでは実際の Azure DevOps に接続しません。本番運用前に必ず `false` に変更してください。

#### フィールドマッピングのカスタマイズ（必要な場合のみ）

Azure DevOps のフィールド名が標準と異なる場合は、以下の変数をJSON文字列で指定します。

```ini
AZURE_DEVOPS_FIELD_MAPPING={"planned_start_date":"Microsoft.VSTS.Scheduling.StartDate","planned_end_date":"Microsoft.VSTS.Scheduling.TargetDate","actual_start_date":"Custom.ActualStartDate","actual_end_date":"Custom.ActualEndDate","azure_devops_assigned_to":"System.AssignedTo","azure_devops_state":"System.State"}
```

デフォルトのマッピング:

| WBS側フィールド | Azure DevOps フィールド |
|---|---|
| 開始予定日 | `Microsoft.VSTS.Scheduling.StartDate` |
| 終了予定日 | `Microsoft.VSTS.Scheduling.TargetDate` |
| 開始日（実績） | `Custom.ActualStartDate` |
| 終了日（実績） | `Custom.ActualEndDate` |
| 担当者 | `System.AssignedTo` |
| ステータス | `System.State` |

---

### 2.4 バックエンドの再起動

`.env` を変更した後、バックエンドサーバーを再起動して設定を反映させます。

---

## 3. 同期対象の有効化

### チケットIDの入力

各プロジェクト・タスク・サブタスクの詳細編集画面から、**チケットID** に Azure DevOps の **Work Item ID**（数値）を入力します。

例: Work Item の URL が `https://dev.azure.com/myorg/myproject/_workitems/edit/12345` であれば、チケットID に `12345` を入力します。

### Azure DevOps同期フラグの有効化

同期対象にするレコードごとに、**Azure DevOps同期フラグ**（`sync_to_azure_devops`）を有効化する必要があります。

### 担当者・ステータスの紐づけ

マスタ・設定画面で以下を設定します。

| マスタ | 設定項目 | 同期先 |
|---|---|---|
| 担当者一覧 | Azure DevOps アカウント | `System.AssignedTo` |
| ステータス一覧 | Azure DevOps System.State | `System.State` |

ステータスの `Azure DevOps System.State` が空欄の場合、そのステータスでは `System.State` は更新されません。

> [!NOTE]
> フロントエンドでの操作UIは現在開発中です。現時点では、以下の PowerShell コマンドで個別に有効化できます。

**プロジェクトを同期対象にする例（PowerShell）:**

```powershell
Invoke-RestMethod `
    -Method PATCH `
    -Uri "http://localhost:8000/api/projects/1" `
    -ContentType "application/json" `
    -Body '{"sync_to_azure_devops": true}'
```

**タスクを同期対象にする例（PowerShell）:**

```powershell
Invoke-RestMethod `
    -Method PATCH `
    -Uri "http://localhost:8000/api/tasks/42" `
    -ContentType "application/json" `
    -Body '{"sync_to_azure_devops": true}'
```

---

## 4. スクリプトの確認と編集

`backend` フォルダに以下の PowerShell スクリプトが用意されています。

| ファイル | 用途 |
|---|---|
| `sync_azure_devops.ps1` | 本番実行（Azure DevOps に書き込む） |
| `sync_azure_devops_dry_run.ps1` | 動作確認用（書き込みなし） |

### 接続先URLの変更

バックエンドが `localhost:8000` 以外で動作している場合は、`-BaseUrl` パラメーターでURLを指定します。

```powershell
.\sync_azure_devops.ps1 -BaseUrl http://192.168.1.10:8000
```

スクリプト冒頭の `param` ブロックのデフォルト値を書き換えることもできます。

```powershell
param(
    [string]$BaseUrl = "http://192.168.1.10:8000"  # ← ここを変更
)
```

### スクリプトの実行ポリシーについて

PowerShell のデフォルト設定ではローカルスクリプトの実行がブロックされる場合があります。実行時に警告が出た場合は、以下のいずれかの方法で対処してください。

**方法A: 実行時に `-ExecutionPolicy Bypass` を付ける（推奨）**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\sync_azure_devops.ps1"
```

**方法B: ユーザー単位のポリシーを変更する**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 5. 動作確認（dry_run）

本番実行の前に、必ず `dry_run` で動作確認を行ってください。

1. バックエンドサーバーが起動していることを確認します。
2. PowerShell を開き、`backend` フォルダで以下を実行します。

```powershell
.\sync_azure_devops_dry_run.ps1
```

**正常時の出力例:**

```
[2026/05/23 09:00:00] Azure DevOps 同期 (dry_run) を開始します (BaseUrl=http://localhost:8000)
        ※ Azure DevOps への書き込みは行いません

  status                : dry_run
  job_id                : 20260523-090000
  candidates            : 15
  invalid_ticket_id     : 1
  skipped_no_change     : 10
  fetch_targets         : 4
  would_update          : 4
  skipped_same_value    : 0
  failed                : 0

  [WARN] エラー・警告あり:
    [task id=7 ticket=0] Ticket ID is not a valid Azure DevOps Work Item ID.

[2026/05/23 09:00:02] dry_run が完了しました（Azure DevOps への変更はありません）
```

**確認ポイント:**

| 項目 | 確認内容 |
|---|---|
| `candidates` | 同期対象レコードが期待通りの件数か |
| `invalid_ticket_id` | 不正なチケットIDがないか（あれば `[WARN]` 欄に詳細が出る） |
| `would_update` | 更新予定件数が妥当か |
| `failed` | エラーがないか |

---

## 6. タスクスケジューラへの登録

### 6.1 タスクの作成

1. **「タスクスケジューラ」** を管理者権限で開きます。
   - スタートメニューで「タスクスケジューラ」を検索 → 右クリック → **「管理者として実行」**
2. 右側の「操作」ペイン → **「タスクの作成」** をクリックします。

### 6.2 「全般」タブ

| 項目 | 設定値 |
|---|---|
| 名前 | `WBS_AzureDevOps_Sync`（任意） |
| 説明 | `WBS管理ツールからAzure DevOpsへの定期同期`（任意） |
| セキュリティオプション | **「ユーザーがログオンしているかどうかにかかわらず実行する」** を選択 |
| 最上位の特権で実行 | チェック不要 |

### 6.3 「トリガー」タブ

**「新規」** をクリックし、以下を2つ作成します（1日2回の場合）。

**1つ目（午前9時）:**

| 項目 | 設定値 |
|---|---|
| タスクの開始 | スケジュールに従う |
| 設定 | 毎日 |
| 開始時刻 | `09:00:00` |
| 有効 | チェック |

**2つ目（午後3時）:**

| 項目 | 設定値 |
|---|---|
| 開始時刻 | `15:00:00` |

### 6.4 「操作」タブ

**「新規」** をクリックし、以下を設定します。

| 項目 | 設定値 |
|---|---|
| 操作 | **プログラムの開始** |
| プログラム/スクリプト | `powershell` |
| 引数の追加 | 下記参照 |
| 開始（省略可） | `C:\path\to\WBSManagementTool\backend` |

**引数の設定値（コピーして使用）:**

```
-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\WBSManagementTool\backend\sync_azure_devops.ps1"
```

バックエンドURLが `localhost:8000` 以外の場合は `-BaseUrl` を追加します。

```
-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\WBSManagementTool\backend\sync_azure_devops.ps1" -BaseUrl http://192.168.1.10:8000
```

> [!NOTE]
> スクリプトのフルパスにスペースが含まれる場合もダブルクォートで囲んでいるため問題ありません。

### 6.5 「条件」タブ

| 項目 | 設定値 |
|---|---|
| コンピューターをAC電源で使用している場合のみタスクを開始する | **チェックを外す**（サーバー運用の場合） |

### 6.6 「設定」タブ

| 項目 | 設定値 |
|---|---|
| タスクが既に実行中の場合に適用されるルール | **「新しいインスタンスを開始しない」** |
| タスクが失敗した場合の再起動 | **チェックを入れる** |
| 再起動の間隔 | `15分` |
| 再起動回数 | `1回` |

### 6.7 設定の保存

**「OK」** をクリックします。実行アカウントのパスワード入力を求められた場合は入力してください。

### 6.8 動作確認

1. 作成したタスクを右クリック → **「実行」** で手動実行します。
2. 「最後の実行結果」が `操作が正常に完了しました。(0x0)` になれば成功です。

---

## 7. 日常運用

### 同期結果の確認

同期実行後、スクリプトの出力に結果のサマリーが表示されます。

```
[2026/05/23 09:00:01] Azure DevOps 同期を開始します (BaseUrl=http://localhost:8000)

  status                : success
  job_id                : 20260523-090001
  candidates            : 20
  invalid_ticket_id     : 0
  skipped_no_change     : 17
  fetch_targets         : 3
  skipped_same_value    : 0
  updated               : 3
  failed                : 0

[2026/05/23 09:00:03] 同期が完了しました
```

### サマリー各項目の意味

| 項目 | 説明 |
|---|---|
| `candidates` | 同期対象として検出されたレコード総数 |
| `invalid_ticket_id` | チケットIDが無効なレコード数（0以下、または未入力） |
| `skipped_no_change` | 前回から日付に変更なし → Azure DevOps に問い合わせなかった件数 |
| `fetch_targets` | 変更検出のため Azure DevOps に現値取得を行った件数 |
| `skipped_same_value` | Azure DevOps 側が既に同じ値 → PATCHしなかった件数 |
| `updated` | Azure DevOps を更新した件数 |
| `failed` | エラーが発生した件数 |

### 同期状態の確認（DB）

同期状態は `devops_sync_states` テーブルに記録されます。

```sql
SELECT
  entity_type,
  entity_id,
  work_item_id,
  last_status,
  last_synced_at,
  last_success_at,
  last_error_message
FROM devops_sync_states
ORDER BY last_synced_at DESC;
```

---

## 8. トラブルシューティング

### `環境変数 WBS_SYNC_TOKEN が設定されていません` と表示される

→ 2.2 の手順で `WBS_SYNC_TOKEN` を Windows ユーザー環境変数に設定してください。設定後、PowerShell ウィンドウやタスクスケジューラを **再起動** することで反映されます。

---

### `HTTP 401` / `Invalid sync token` エラー

→ スクリプトの実行ユーザーの `WBS_SYNC_TOKEN` 環境変数と、バックエンドサーバーが読み込んでいる `WBS_SYNC_TOKEN` の値が一致していません。`backend/.env` ファイルに `WBS_SYNC_TOKEN=` の記述がないか確認してください（`.env` の値が環境変数を上書きしている可能性があります）。

---

### `HTTP 409` / `Another sync is already running` エラー

→ 前回の同期が異常終了してロックが残っています。DB の `sync_locks` テーブルを確認してください。

```sql
-- ロック状態を確認
SELECT * FROM sync_locks;

-- 期限切れのロックを手動削除（必要な場合）
DELETE FROM sync_locks WHERE expires_at < NOW();
```

---

### `failed` が 0 より大きい / エラー内容を確認したい

→ スクリプトの出力に `[WARN] エラー・警告あり:` として表示されます。また、DB の `devops_sync_states.last_error_message` カラムにも記録されます。

よくあるエラー:

| エラーメッセージ | 原因と対処 |
|---|---|
| `Work Item {id} not found in Azure DevOps.` | チケットIDに対応する Work Item が存在しない。IDを確認してください。 |
| `Ticket ID is not a valid Azure DevOps Work Item ID.` | チケットIDが0以下または未入力。正しい数値を入力してください。 |
| `HTTP 401` | PAT の有効期限切れ、またはスコープ不足。PAT を再発行してください。 |
| `Failed to fetch from Azure DevOps: ...` | ネットワーク障害または Azure DevOps のメンテナンス。時間をおいて再実行してください。 |

---

### スクリプトが実行されない（実行ポリシーエラー）

→ PowerShell の実行ポリシーによりスクリプトがブロックされています。タスクスケジューラの「操作」設定で、引数に `-ExecutionPolicy Bypass` が含まれているか確認してください（6.4 参照）。

手動実行時は以下のように実行してください。

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\sync_azure_devops.ps1"
```

---

### `AZURE_DEVOPS_USE_MOCK=true` のまま実行している

→ `backend/.env` の `AZURE_DEVOPS_USE_MOCK` を `false` に変更し、バックエンドを再起動してください。モック動作中は Azure DevOps への通信が行われないため、dry_run と同様に `status: success` が返りますが実際の Work Item は更新されません。

---

## 9. セキュリティに関する注意事項

- `AZURE_DEVOPS_PAT` と `WBS_SYNC_TOKEN` は `.env` ファイルに記載しないでください。
- `.env` ファイルおよび `backend` フォルダのアクセス権限を、必要最小限のユーザーのみに制限してください。
- PAT には **Work Items の Read & write** スコープのみ付与し、必要以上の権限を与えないでください。
- PAT の有効期限が切れると同期が停止します。定期的に更新してください（有効期限の1週間前を目安）。
- 同期APIエンドポイント（`POST /api/integrations/azure-devops/sync`）は社内ネットワーク内からのみアクセス可能な環境で運用することを推奨します。
