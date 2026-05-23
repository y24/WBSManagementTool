# WBS+ガントチャート管理ツール Azure DevOps連携 改修計画

## 1. 目的

社内サーバー上の WBS+ガントチャート管理ツールで管理している日付情報を、Azure DevOps の Work Item に定期反映する。

同期対象は以下。

* プロジェクト
* タスク
* サブタスク

各データに既に存在する **チケットID入力欄** の値を、Azure DevOps の **Work Item ID** として使用する。

同期対象の日付は以下。

* 開始予定日
* 終了予定日
* 開始日
* 終了日

同期は FastAPI バックエンドに新設する API を、Windows タスクスケジューラから定期実行して行う。

---

## 2. 確定事項

### 2.1 同期API

同期APIは以下で固定する。

```http
POST /integrations/azure-devops/sync
```

### 2.2 Work Item ID

Azure DevOps の Work Item ID は、既存のチケットID入力欄の値を使用する。

新たに `azure_devops_work_item_id` のような入力欄は作らない。

ただし、内部処理上は以下のように呼ぶ。

```text
work_item_id = existing_ticket_id
```

### 2.3 同期要否判定

同期対象の日付4項目から hash を生成し、前回同期成功時の `last_sent_hash` と比較する。

hash が同じ場合は、Azure DevOps の現値取得も PATCH も行わない。

```text
current_hash == last_sent_hash
  → Azure DevOpsへ問い合わせない
```

---

## 3. Azure DevOps API 前提

Azure DevOps の Work Item 更新は `PATCH /_apis/wit/workitems/{id}` を使用する。Microsoft公式ドキュメントでは、Work Item 更新APIは JSON Patch 形式でフィールド更新する仕様になっている。([Microsoft Learn][1])

複数 Work Item の現値取得には `workitemsbatch` API を使用する。このAPIは最大200件のIDをまとめて取得できるため、1件ずつGETするよりリクエスト数を抑えられる。([Microsoft Learn][2])

設定されたフィールド名の存在確認には、Work Item Tracking の Fields List API を使える。これは同期前の設定検証に使える。([Microsoft Learn][3])

---

## 4. 基本方針

## 4.1 同期方向

同期方向は片方向とする。

```text
WBS+ガントチャート管理ツール
  → Azure DevOps Work Item
```

Azure DevOps 側の値を WBS ツールへ取り込む処理は対象外。

### 理由

* 今回の要望は WBS 側の日付を Azure DevOps に反映すること
* 双方向同期にすると競合制御が複雑になる
* 初期実装としては過剰
* 定期実行との相性も片方向同期の方がよい

---

## 4.2 同期タイミング

Windows タスクスケジューラから、1日2回程度 API を実行する。

例:

```text
09:00
15:00
```

同期API自体はスケジュールを持たない。

---

## 4.3 リクエスト最小化

Azure DevOps へのリクエストは以下に限定する。

```text
1. hash差分があるものだけ workitemsbatch で現値取得
2. Azure DevOps側と実差分があるものだけ PATCH
```

やらないこと:

* 毎回全件GETしない
* 1チケットごとにGETしない
* 差分なしでPATCHしない
* フロントエンド保存時に即時同期しない

---

# 5. 既存チケットID欄の扱い

## 5.1 基本方針

既存のチケットID入力欄に入っている値を Azure DevOps Work Item ID として扱う。

例:

| WBS側項目   | 同期処理上の意味                  |
| -------- | ------------------------- |
| 既存チケットID | Azure DevOps Work Item ID |

実装上は、既存カラム名をそのまま使う。

例:

```text
ticket_id
external_ticket_id
issue_id
```

実際のカラム名に合わせる。

---

## 5.2 バリデーション

Azure DevOps の Work Item ID として使うため、同期時には数値として解釈できるか検証する。

有効:

```text
12345
```

無効例:

```text
ADO-12345
https://dev.azure.com/xxx/...
空文字
```

ただし、既にURLや接頭辞付きIDを入力している運用がある場合に備えて、将来的にはパース処理を追加できるようにしておく。

初期実装では、**数値のみ有効** とするのが安全。

---

## 5.3 同期対象条件

同期対象は以下を満たすデータとする。

```text
既存チケットIDが入力されている
既存チケットIDが数値として解釈できる
sync_to_azure_devops = true
論理削除されていない
```

---

# 6. 追加・変更するデータ項目

## 6.1 既存テーブル側

既存のチケットID欄は流用するため、Work Item ID用の新規カラムは追加しない。

追加するのは、同期有効フラグのみ。

対象:

* projects
* tasks
* subtasks

追加カラム案:

```text
sync_to_azure_devops boolean not null default false
```

既に類似の同期対象フラグがある場合は、それを使ってよい。

---

## 6.2 同期状態テーブル

同期状態を保存する専用テーブルを追加する。

テーブル名:

```text
devops_sync_states
```

カラム案:

```text
id
entity_type
entity_id
work_item_id
last_sent_hash
last_local_updated_at
last_devops_rev
last_synced_at
last_success_at
last_status
last_error_message
created_at
updated_at
```

---

## 6.3 entity_type

```text
project
task
subtask
```

---

## 6.4 work_item_id

同期時点で既存チケットID欄から読み取った Azure DevOps Work Item ID を保存する。

目的:

* 前回どの Work Item に同期したかを残す
* チケットID変更時の追跡を可能にする
* ログ調査をしやすくする

---

## 6.5 last_sent_hash

前回同期成功時に Azure DevOps へ反映済みと判断した日付4項目の hash。

対象項目:

```text
planned_start_date
planned_end_date
actual_start_date
actual_end_date
```

この hash が今回値と一致する場合、Azure DevOps への現値取得を行わない。

---

## 6.6 last_local_updated_at

前回同期成功時点の WBS 側 `updated_at`。

これは補助情報として保存する。

同期要否の主判定には使わない。

---

# 7. hash判定設計

## 7.1 hash対象

hash対象は同期対象の日付4項目だけとする。

```json
{
  "planned_start_date": "2026-05-01",
  "planned_end_date": "2026-05-10",
  "actual_start_date": "2026-05-02",
  "actual_end_date": null
}
```

タスク名、担当者、メモ、並び順などは hash に含めない。

---

## 7.2 正規化ルール

hash生成前に日付を正規化する。

```text
date型、datetime型、文字列型が混在しても YYYY-MM-DD に揃える
空値は null に揃える
キー順を固定する
JSON文字列化時の形式を固定する
```

例:

```json
{
  "actual_end_date": null,
  "actual_start_date": "2026-05-02",
  "planned_end_date": "2026-05-10",
  "planned_start_date": "2026-05-01"
}
```

---

## 7.3 hash方式

SHA-256 を使用する。

```text
SHA-256(normalized_json)
```

hashの目的はセキュリティではなく、差分判定の安定化。

---

## 7.4 判定

```text
current_hash == last_sent_hash
  → skipped_no_local_change
  → Azure DevOps現値取得なし
  → PATCHなし

current_hash != last_sent_hash
  → Azure DevOps現値取得対象
```

---

## 7.5 updated_at との関係

`updated_at` は同期要否の主判定に使わない。

理由:

* 日付以外の変更でも更新される可能性がある
* 逆に実装不備で日付変更時に更新されない可能性もゼロではない
* 同期したいのは日付4項目の変更だけ

ただし、ログや調査のために `last_local_updated_at` は保持する。

---

# 8. 同期処理フロー

## 8.1 全体フロー

```text
1. POST /integrations/azure-devops/sync が呼ばれる
2. 同期APIトークンを検証する
3. 多重実行ロックを取得する
4. WBS側から同期対象候補を取得する
5. 既存チケットIDを Work Item ID として検証する
6. 日付4項目を正規化する
7. current_hash を生成する
8. last_sent_hash と比較する
9. hash差分があるものだけ Azure DevOps 現値取得対象にする
10. workitemsbatch で Azure DevOps 現値を一括取得する
11. WBS側値と Azure DevOps側値を比較する
12. 実差分があるフィールドだけ JSON Patch を生成する
13. 差分がある Work Item のみ PATCH する
14. 同期状態を更新する
15. 結果をレスポンスする
16. ロックを解放する
```

---

## 8.2 重要な制御

WBS側で hash 差分がない場合は、Azure DevOps に問い合わせない。

```text
hash差分なし
  → Azure DevOps GETなし
  → PATCHなし
```

WBS側で hash 差分がある場合のみ、Azure DevOps の現値を取得する。

```text
hash差分あり
  → Azure DevOps GETあり
  → 現値比較
  → 必要ならPATCH
```

---

# 9. Azure DevOps 現値取得

## 9.1 対象

現値取得対象は、hash差分がある Work Item ID のみ。

```text
current_hash != last_sent_hash
```

---

## 9.2 取得方法

`workitemsbatch` API を使い、最大200件単位で取得する。

取得フィールドは最小限にする。

```json
{
  "ids": [101, 102, 103],
  "fields": [
    "System.Id",
    "System.Title",
    "Microsoft.VSTS.Scheduling.StartDate",
    "Microsoft.VSTS.Scheduling.TargetDate",
    "Custom.ActualStartDate",
    "Custom.ActualEndDate"
  ],
  "errorPolicy": "Omit"
}
```

---

## 9.3 取得する理由

hash差分がある場合でも、すぐPATCHはしない。

理由:

* Azure DevOps側が既に同じ値になっている可能性がある
* 不要な更新履歴を増やしたくない
* 通知や監査ログのノイズを避けたい

---

# 10. Azure DevOps 更新

## 10.1 更新方式

Work Item の更新は JSON Patch で行う。

```http
PATCH https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{id}?api-version=7.1
Content-Type: application/json-patch+json
```

---

## 10.2 PATCH例

```json
[
  {
    "op": "add",
    "path": "/fields/Microsoft.VSTS.Scheduling.StartDate",
    "value": "2026-05-01T00:00:00+09:00"
  },
  {
    "op": "add",
    "path": "/fields/Microsoft.VSTS.Scheduling.TargetDate",
    "value": "2026-05-10T00:00:00+09:00"
  }
]
```

---

## 10.3 差分フィールドのみ更新

4項目すべてを毎回送らない。

Azure DevOps側と比較して、実際に差分があるフィールドだけ PATCH に含める。

例:

```text
開始予定日: 同じ
終了予定日: 違う
開始日: 同じ
終了日: 同じ
```

この場合、終了予定日のみ PATCH する。

---

## 10.4 更新成功時の同期状態

PATCH 成功時、以下を更新する。

```text
last_sent_hash = current_hash
last_local_updated_at = WBS側 updated_at
last_devops_rev = PATCH後の rev
last_synced_at = now
last_success_at = now
last_status = success
last_error_message = null
```

---

## 10.5 Azure DevOps側が既に同値だった場合

hash差分があり現値取得したが、Azure DevOps側が既に同じ値だった場合は PATCH しない。

この場合も同期成功扱いにしてよい。

```text
last_sent_hash = current_hash
last_status = success
```

理由:

* 結果として Azure DevOps は期待値になっている
* 次回以降、同じ理由で現値取得されるのを防ぐため

---

# 11. フィールドマッピング

## 11.1 設定ファイルで管理する

Azure DevOps のフィールド名は環境・プロセスによって変わる可能性があるため、コードに固定しない。

設定例:

```json
{
  "azure_devops": {
    "field_mapping": {
      "planned_start_date": "Microsoft.VSTS.Scheduling.StartDate",
      "planned_end_date": "Microsoft.VSTS.Scheduling.TargetDate",
      "actual_start_date": "Custom.ActualStartDate",
      "actual_end_date": "Custom.ActualEndDate"
    }
  }
}
```

---

## 11.2 実績日はカスタムフィールド推奨

実績開始日、実績終了日は Azure DevOps のプロセス設計に依存する。

`System.ClosedDate` のようなシステム管理フィールドを、実績終了日として安易に更新しない。

理由:

* 状態遷移と連動する可能性がある
* APIで更新できない可能性がある
* チケットの完了状態と実績日が混同される

---

## 11.3 フィールド存在確認

初期設定確認用に、設定された Azure DevOps フィールドが存在するか確認できる処理を用意する。

ただし、初期リリースでは同期実行時のエラー検知でもよい。

将来的には以下のような確認APIを追加できる。

```http
GET /integrations/azure-devops/validate-settings
```

---

# 12. NULL値の扱い

## 12.1 基本方針

WBS側の日付がNULLの場合、Azure DevOps側の値を消すかどうかは設定で制御する。

初期値は `false` を推奨。

```json
{
  "clear_remote_when_local_null": false
}
```

---

## 12.2 false の場合

WBS側がNULLでも、Azure DevOps側の値は消さない。

```text
WBS: null
Azure DevOps: 2026-05-01
→ PATCHしない
```

初期導入時の事故を避けるため、この方が安全。

---

## 12.3 true の場合

WBS側がNULLなら、Azure DevOps側も空にする。

```text
WBS: null
Azure DevOps: 2026-05-01
→ Azure DevOps側をクリア
```

ただし、対象フィールドが空値更新を許容するか検証する。

---

# 13. 日付形式

## 13.1 WBS側

WBS側は日付として扱う。

```text
2026-05-01
```

---

## 13.2 Azure DevOps送信値

Azure DevOpsへは DateTime として送る。

社内利用で日本時間前提なら、初期実装は以下を推奨する。

```text
2026-05-01T00:00:00+09:00
```

---

## 13.3 比較時

Azure DevOps から取得した DateTime は、比較前に `YYYY-MM-DD` に正規化する。

```text
2026-05-01T00:00:00Z
→ 2026-05-01
```

これにより、時刻差やタイムゾーン差による不要更新を避ける。

---

# 14. 同期API仕様

## 14.1 エンドポイント

```http
POST /integrations/azure-devops/sync
```

---

## 14.2 Query Parameters

```text
dry_run: boolean = false
```

例:

```http
POST /integrations/azure-devops/sync?dry_run=true
```

---

## 14.3 Headers

```http
X-Sync-Token: <secret>
```

---

## 14.4 レスポンス例

```json
{
  "job_id": "20260523-090000",
  "status": "success",
  "started_at": "2026-05-23T09:00:00+09:00",
  "finished_at": "2026-05-23T09:00:10+09:00",
  "summary": {
    "candidates": 120,
    "invalid_ticket_id": 2,
    "skipped_no_local_change": 80,
    "fetch_targets": 38,
    "fetched_from_devops": 38,
    "skipped_same_remote_value": 20,
    "updated": 15,
    "failed": 3
  },
  "errors": [
    {
      "entity_type": "task",
      "entity_id": 123,
      "ticket_id": "ABC-456",
      "message": "Ticket ID is not a numeric Azure DevOps Work Item ID."
    }
  ]
}
```

---

# 15. dry_run

## 15.1 目的

Azure DevOps に実際の更新を行わず、同期対象と差分だけ確認する。

---

## 15.2 挙動

`dry_run=true` の場合:

* 同期対象抽出を行う
* hash判定を行う
* 必要なものだけ Azure DevOps 現値取得を行う
* 差分計算を行う
* PATCH は行わない
* `last_sent_hash` は更新しない

---

## 15.3 用途

* 初回導入前の確認
* フィールドマッピング確認
* チケットID入力ミス確認
* 日付ズレ確認
* Azure DevOpsへの影響確認

---

# 16. 認証・セキュリティ

## 16.1 同期APIの保護

同期APIは社内サーバー内で使う前提でも保護する。

必須:

```text
POSTのみ許可
X-Sync-Token 必須
トークン不一致なら 401
秘密情報をログに出さない
```

---

## 16.2 Azure DevOps認証

Azure DevOps API 認証情報は環境変数で管理する。

例:

```env
AZURE_DEVOPS_PAT=...
WBS_SYNC_TOKEN=...
```

PATやトークンはDBに保存しない。

---

## 16.3 ログ禁止事項

以下はログに出さない。

```text
Authorization header
PAT
X-Sync-Token
.env の中身
```

---

# 17. 多重実行防止

## 17.1 方針

同期APIの同時実行を禁止する。

方式はDBロックを推奨。

---

## 17.2 ロックテーブル案

```text
sync_locks
```

カラム:

```text
lock_name
locked_at
locked_by
expires_at
```

ロック名:

```text
azure_devops_sync
```

---

## 17.3 ロック期限

異常終了でロックが残ることを避けるため、有効期限を持つ。

```text
expires_at = now + 30 minutes
```

---

# 18. バックエンド構成案

## 18.1 追加ファイル

```text
app/
  api/
    integrations/
      azure_devops.py
  services/
    azure_devops_client.py
    azure_devops_sync_service.py
    sync_hash_service.py
  repositories/
    sync_target_repository.py
    devops_sync_state_repository.py
    sync_lock_repository.py
  schemas/
    devops_sync.py
  config/
    azure_devops_settings.py
```

---

## 18.2 azure_devops.py

責務:

```text
POST /integrations/azure-devops/sync
X-Sync-Token検証
dry_run受け取り
sync service呼び出し
レスポンス返却
```

---

## 18.3 azure_devops_client.py

責務:

```text
workitemsbatch 呼び出し
Work Item PATCH
認証ヘッダー付与
タイムアウト
リトライ
HTTPエラー変換
```

---

## 18.4 azure_devops_sync_service.py

責務:

```text
同期処理全体の制御
対象抽出
hash判定
現値取得対象の決定
Azure DevOps現値比較
PATCH実行
同期状態更新
```

---

## 18.5 sync_hash_service.py

責務:

```text
日付4項目の正規化
安定JSON生成
SHA-256 hash生成
```

---

## 18.6 sync_target_repository.py

責務:

```text
projects / tasks / subtasks から同期候補取得
既存チケットID欄の取得
日付4項目の取得
```

---

# 19. 同期対象抽出イメージ

既存チケットID欄を `ticket_id` と仮定した例。

```sql
SELECT
  'task' AS entity_type,
  id AS entity_id,
  ticket_id AS work_item_id,
  planned_start_date,
  planned_end_date,
  actual_start_date,
  actual_end_date,
  updated_at
FROM tasks
WHERE
  ticket_id IS NOT NULL
  AND ticket_id <> ''
  AND sync_to_azure_devops = true
  AND deleted_at IS NULL;
```

projects / tasks / subtasks をそれぞれ取得し、アプリケーション側で統合する。

---

# 20. 同期状態更新ルール

## 20.1 hash差分なし

```text
current_hash == last_sent_hash
```

処理:

```text
Azure DevOpsへ問い合わせない
last_synced_at を更新してもよい
last_success_at は更新しない方がよい
last_status = skipped_no_local_change
```

補足:

`last_success_at` は「実際に同期成功した日時」として残した方が意味が明確。

---

## 20.2 Azure DevOps側が同値

```text
current_hash != last_sent_hash
Azure DevOps側の値 == WBS側の値
```

処理:

```text
PATCHしない
last_sent_hash = current_hash
last_local_updated_at = WBS側 updated_at
last_synced_at = now
last_success_at = now
last_status = success
```

---

## 20.3 PATCH成功

処理:

```text
last_sent_hash = current_hash
last_local_updated_at = WBS側 updated_at
last_devops_rev = PATCH後のrev
last_synced_at = now
last_success_at = now
last_status = success
last_error_message = null
```

---

## 20.4 PATCH失敗

処理:

```text
last_sent_hash は更新しない
last_synced_at = now
last_status = failed
last_error_message = エラー内容
```

重要:

失敗時に `last_sent_hash` を更新してはいけない。

更新すると、次回以降「同期済み」と誤判定される。

---

# 21. エラーハンドリング

## 21.1 チケットIDが数値でない

扱い:

```text
対象レコードのみ failed
Azure DevOpsへ問い合わせない
他のレコードは継続
```

例:

```text
ticket_id = "ADO-123"
```

---

## 21.2 Work Item が存在しない

扱い:

```text
対象レコードのみ failed
last_status = failed
last_error_message に保存
他のレコードは継続
```

---

## 21.3 フィールドが存在しない

扱い:

```text
対象レコードは failed
同期ジョブ全体は partial_success
設定ミスとしてログ出力
```

---

## 21.4 認証エラー

扱い:

```text
同期全体を中断
HTTP 500 または 502
status = failed
```

401 / 403 は設定または認証情報の問題として扱う。

---

## 21.5 レート制限・一時障害

扱い:

```text
リトライする
それでも失敗したら failed
```

リトライ例:

```text
最大3回
1秒 → 3秒 → 10秒
```

---

# 22. ログ設計

## 22.1 ジョブログ

同期1回ごとに出す。

```text
job_id
started_at
finished_at
status
candidate_count
invalid_ticket_id_count
skipped_no_local_change_count
fetch_target_count
updated_count
failed_count
```

---

## 22.2 個別ログ

必要に応じてDBまたはファイルに出す。

```text
entity_type
entity_id
ticket_id
work_item_id
action
result
error_message
```

---

## 22.3 action

```text
skipped_no_local_change
fetch_remote
skipped_same_remote_value
patched
failed
```

---

# 23. フロントエンド改修

## 23.1 入力欄

Work Item ID 用の新規入力欄は作らない。

既存のチケットID入力欄を使う。

---

## 23.2 追加項目

追加するのは同期有効フラグ。

```text
Azure DevOpsへ同期する
```

チェックボックスでよい。

---

## 23.3 表示項目

詳細画面または一覧に、必要に応じて以下を表示する。

```text
Azure DevOps同期状態
最終同期日時
最終同期成功日時
最終同期エラー
```

初期実装では、管理者向け画面だけでもよい。

---

# 24. 設定ファイル案

```json
{
  "azure_devops": {
    "enabled": true,
    "organization": "your-org",
    "project": "your-project",
    "api_version": "7.1",
    "batch_size": 200,
    "request_timeout_seconds": 30,
    "clear_remote_when_local_null": false,
    "suppress_notifications": false,
    "field_mapping": {
      "planned_start_date": "Microsoft.VSTS.Scheduling.StartDate",
      "planned_end_date": "Microsoft.VSTS.Scheduling.TargetDate",
      "actual_start_date": "Custom.ActualStartDate",
      "actual_end_date": "Custom.ActualEndDate"
    }
  }
}
```

秘密情報は設定ファイルに入れない。

---

# 25. タスクスケジューラ

## 25.1 PowerShell例

```powershell
$headers = @{
  "X-Sync-Token" = $env:WBS_SYNC_TOKEN
}

Invoke-RestMethod `
  -Method POST `
  -Uri "http://localhost:8000/integrations/azure-devops/sync" `
  -Headers $headers
```

---

## 25.2 推奨設定

```text
実行頻度: 1日2回
多重起動: 禁止
失敗時: 15分後に1回再試行
実行ユーザー: 専用ユーザー
標準出力・標準エラー: ログ保存
```

---

# 26. テスト計画

## 26.1 単体テスト

対象:

```text
既存チケットIDの数値バリデーション
日付正規化
hash生成
hash差分判定
NULL値制御
Azure DevOpsフィールドマッピング
JSON Patch生成
同期状態更新ルール
```

---

## 26.2 Azure DevOps Client テスト

実APIではなくスタブで確認する。

対象:

```text
workitemsbatch リクエスト
PATCH リクエスト
401
403
404
429
500
タイムアウト
リトライ
```

---

## 26.3 結合テスト

確認観点:

```text
チケットIDがあるデータだけ対象になる
同期フラグOFFは対象外になる
hash差分なしなら Azure DevOps に問い合わせない
hash差分ありなら Azure DevOps 現値取得する
Azure DevOps側が同値なら PATCH しない
差分があるフィールドだけ PATCH する
PATCH成功時だけ last_sent_hash を更新する
PATCH失敗時は last_sent_hash を更新しない
dry_runではPATCHしない
多重実行されない
```

---

# 27. 実装フェーズ

## Phase 1: DB・設定追加

```text
sync_to_azure_devops 追加
devops_sync_states 追加
sync_locks 追加
Azure DevOps設定追加
環境変数追加
```

---

## Phase 2: hash判定実装

```text
日付4項目の正規化
安定JSON化
SHA-256 hash生成
last_sent_hash 比較
```

---

## Phase 3: Azure DevOps Client 実装

```text
workitemsbatch
PATCH
認証
タイムアウト
リトライ
エラー変換
```

---

## Phase 4: 同期サービス実装

```text
同期対象抽出
既存チケットIDのWork Item ID化
hash差分判定
現値取得対象の絞り込み
Azure DevOps現値比較
JSON Patch生成
同期状態更新
```

---

## Phase 5: 同期API実装

```text
POST /integrations/azure-devops/sync
X-Sync-Token検証
dry_run対応
多重実行防止
レスポンス整形
```

---

## Phase 6: フロントエンド改修

```text
既存チケットID欄はそのまま使用
Azure DevOps同期フラグ追加
同期状態表示
最終エラー表示
```

---

## Phase 7: タスクスケジューラ設定

```text
PowerShell作成
タスク登録
ログ保存
失敗時再試行
```

---

## Phase 8: 検証

```text
dry_run確認
スタブ結合テスト
テスト用Work Itemで実同期
日付ズレ確認
不要PATCHが発生しないことを確認
```

---

# 28. 完了条件

以下を満たしたら完了とする。

```text
POST /integrations/azure-devops/sync で同期できる
既存チケットID欄の値を Work Item ID として使える
同期フラグONのデータだけ対象になる
日付4項目のhashで同期要否を判定できる
hash差分なしなら Azure DevOps に問い合わせない
hash差分ありのものだけ workitemsbatch で現値取得する
Azure DevOps側と実差分があるものだけ PATCH する
PATCH成功時だけ last_sent_hash を更新する
dry_runで事前確認できる
同期結果がログとDBに残る
PATや同期トークンがログに出ない
タスクスケジューラから定期実行できる
```

---

# 29. 初期実装でやらないこと

```text
Azure DevOpsからWBSへの逆同期
Azure DevOpsチケットの新規作成
親子関係の同期
状態の同期
担当者の同期
工数の同期
コメント同期
添付ファイル同期
Webhook連携
リアルタイム同期
```

---

# 30. 最小実装まとめ

最初に作るべき最小構成はこれ。

```text
1. 既存チケットID欄を Work Item ID として使う
2. sync_to_azure_devops を追加する
3. devops_sync_states に last_sent_hash を持つ
4. 日付4項目から current_hash を作る
5. current_hash == last_sent_hash なら Azure DevOps に問い合わせない
6. hash差分があるものだけ workitemsbatch で現値取得する
7. Azure DevOps側と実差分があるものだけ PATCH する
8. PATCH成功時だけ last_sent_hash を更新する
9. POST /integrations/azure-devops/sync をタスクスケジューラから叩く
```

[1]: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update?view=azure-devops-rest-7.1&utm_source=chatgpt.com "Update - REST API (Azure DevOps Work Item Tracking)"
[2]: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-items-batch?view=azure-devops-rest-7.1&utm_source=chatgpt.com "Get Work Items Batch - Azure DevOps"
[3]: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/fields/list?view=azure-devops-rest-7.1&utm_source=chatgpt.com "Fields - List - REST API (Azure DevOps Work Item Tracking)"
