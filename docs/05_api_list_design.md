# Web版WBS管理ツール API一覧設計

## 1. 設計方針

### 1.1 APIの基本方針

本システムのAPIは、以下の方針で設計する。

* フロントエンド（React）からバックエンド（FastAPI）を呼び出す
* 画面表示用の取得APIと、更新系APIを分ける
* 自動保存前提のため、**小さな単位で更新しやすいAPI**を用意する
* ドラッグ＆ドロップや複製などの操作系APIは専用エンドポイントとする
* 論理削除を前提にする
* 認証なしを前提とするが、将来認証追加しやすいパス設計とする

### 1.2 命名方針

* ベースパスは `/api`
* リソースは複数形
* 操作系は動詞サブパスを使う

  * 例: `/copy`, `/reorder`, `/auto-calculate`

### 1.3 レスポンス方針

更新系APIは、原則として以下のいずれかを返す。

* 更新後の対象オブジェクト
* 成功/失敗とメッセージ
* 一覧再描画に必要な最小情報

メイン画面の自動保存では、毎回全件返すと重くなりやすいので、基本は**対象レコード単位**で返す。

---

# 2. API分類一覧

本システムのAPIは、以下に分類する。

1. メイン画面表示系API
2. プロジェクトAPI
3. タスクAPI
4. サブタスクAPI
5. 並び替え / 移動API
6. 複製API
7. 自動入力補助API
8. マスタ管理API
9. システム設定API
10. 共通補助API

---

# 3. メイン画面表示系API

## 3.1 WBS一覧取得

### API名

WBSツリー + ガント表示用データ取得

* **Method**: `GET`
* **Path**: `/api/wbs`

### 用途

メイン画面で表示するプロジェクト、タスク、サブタスク、およびガント表示に必要な情報をまとめて取得する。

### 主なクエリパラメータ

| パラメータ           | 型          | 必須 | 説明               |
| --------------- | ---------- | -: | ---------------- |
| project_ids     | array[int] | 任意 | 表示対象プロジェクトID     |
| assignee_ids    | array[int] | 任意 | 表示対象担当者ID        |
| include_removed | bool       | 任意 | Removed表示有無      |
| weeks           | int        | 任意 | ガントの右端表示週数       |
| base_date       | date       | 任意 | 表示基準日。未指定ならサーバ計算 |

### 主なレスポンス

```json
{
  "filters": {
    "project_ids": [1, 2],
    "assignee_ids": [3],
    "include_removed": false,
    "weeks": 8
  },
  "gantt_range": {
    "start_date": "2026-03-01",
    "end_date": "2026-04-26",
    "today": "2026-03-22"
  },
  "projects": [
    {
      "id": 1,
      "project_name": "〇〇機能リリース",
      "planned_start_date": "2026-03-01",
      "planned_end_date": "2026-04-10",
      "actual_start_date": "2026-03-02",
      "actual_end_date": null,
      "is_auto_planned_date": true,
      "is_auto_actual_date": true,
      "sort_order": 1,
      "planned_effort_total": 24.5,
      "actual_effort_total": 10.0,
      "tasks": [...]
    }
  ]
}
```

### 備考

* メイン画面の初期表示・再読み込みに使用
* ツリー表示とガント表示を1回のAPIでまかなう
* フィルタ反映後の結果を返す

---

## 3.2 ガント表示範囲計算補助

これは必須ではないけれど、分離したい場合の候補。

* **Method**: `GET`
* **Path**: `/api/wbs/gantt-range`

### 用途

表示対象データから左端日付と右端日付を計算する。

### 備考

初版では `/api/wbs` に含めてしまう方が素直。

---

# 4. プロジェクトAPI

## 4.1 プロジェクト作成

* **Method**: `POST`
* **Path**: `/api/projects`

### リクエスト例

```json
{
  "project_name": "新規プロジェクト",
  "sort_order": 5
}
```

### レスポンス例

```json
{
  "id": 10,
  "project_name": "新規プロジェクト",
  "planned_start_date": null,
  "planned_end_date": null,
  "actual_start_date": null,
  "actual_end_date": null,
  "is_auto_planned_date": false,
  "is_auto_actual_date": false,
  "sort_order": 5
}
```

---

## 4.2 プロジェクト更新

* **Method**: `PATCH`
* **Path**: `/api/projects/{project_id}`

### 用途

インライン編集による単項目更新、自動設定フラグ更新など。

### リクエスト例

```json
{
  "project_name": "〇〇機能リリース改"
}
```

または

```json
{
  "planned_start_date": "2026-03-01",
  "planned_end_date": "2026-04-15"
}
```

### 備考

* 部分更新
* 自動保存向け

---

## 4.3 プロジェクト削除（論理削除）

* **Method**: `DELETE`
* **Path**: `/api/projects/{project_id}`

### 用途

プロジェクトを論理削除する

### クエリ / Body候補

```json
{
  "cascade": true
}
```

### 備考

* 配下タスク・サブタスクもまとめて論理削除する想定
* 物理削除は行わない

---

## 4.4 プロジェクト詳細取得

* **Method**: `GET`
* **Path**: `/api/projects/{project_id}`

### 用途

詳細表示や将来の個別画面用

### 備考

初版では必須度は低いが、用意しておくと自然

---

# 5. タスクAPI

## 5.1 タスク作成

* **Method**: `POST`
* **Path**: `/api/tasks`

### リクエスト例

```json
{
  "project_id": 1,
  "task_name": "業務シナリオテスト",
  "sort_order": 3
}
```

---

## 5.2 タスク更新

* **Method**: `PATCH`
* **Path**: `/api/tasks/{task_id}`

### 用途

タスク名、日付、自動設定フラグ等の更新

### リクエスト例

```json
{
  "task_name": "性能テスト"
}
```

---

## 5.3 タスク削除（論理削除）

* **Method**: `DELETE`
* **Path**: `/api/tasks/{task_id}`

### 備考

* 配下サブタスクもまとめて論理削除する想定

---

## 5.4 タスク詳細取得

* **Method**: `GET`
* **Path**: `/api/tasks/{task_id}`

---

# 6. サブタスクAPI

## 6.1 サブタスク作成

* **Method**: `POST`
* **Path**: `/api/subtasks`

### リクエスト例

```json
{
  "task_id": 5,
  "subtask_type_id": 2,
  "status_id": 1,
  "sort_order": 10
}
```

### 備考

* 最小入力で作成可能にする
* 詳細は後から自動保存で埋める

---

## 6.2 サブタスク更新

* **Method**: `PATCH`
* **Path**: `/api/subtasks/{subtask_id}`

### 用途

メイン画面常時表示列、詳細ダイアログ項目を更新する

### リクエスト例

```json
{
  "status_id": 3
}
```

または

```json
{
  "assignee_id": 2,
  "planned_start_date": "2026-03-10",
  "planned_end_date": "2026-03-15",
  "progress_percent": 50
}
```

または

```json
{
  "planned_effort_days": 3.5,
  "review_days": 1.0,
  "memo": "レビュー待ち"
}
```

### 備考

* 部分更新
* Removed変更時はフロント側で確認ダイアログを出してから呼ぶ

---

## 6.3 サブタスク削除（論理削除）

* **Method**: `DELETE`
* **Path**: `/api/subtasks/{subtask_id}`

---

## 6.4 サブタスク詳細取得

* **Method**: `GET`
* **Path**: `/api/subtasks/{subtask_id}`

### 用途

詳細ダイアログ表示時に最新情報を取得する

### 備考

`/api/wbs` のデータで足りるなら省略可能だけど、独立しておくと保守はしやすい

---

# 7. 並び替え / 移動API

このあたりは専用APIにしたほうがいい。
`PATCH` で無理やり吸うこともできるけれど、D&Dの意味が曖昧になりやすいからね。

## 7.1 タスク並び替え

* **Method**: `POST`
* **Path**: `/api/tasks/reorder`

### リクエスト例

```json
{
  "project_id": 1,
  "ordered_task_ids": [11, 15, 12, 13]
}
```

### 用途

同一プロジェクト内のタスク順序更新

---

## 7.2 サブタスク並び替え

* **Method**: `POST`
* **Path**: `/api/subtasks/reorder`

### リクエスト例

```json
{
  "task_id": 5,
  "ordered_subtask_ids": [101, 102, 109, 110]
}
```

---

## 7.3 サブタスク移動

* **Method**: `POST`
* **Path**: `/api/subtasks/move`

### リクエスト例

```json
{
  "subtask_id": 109,
  "to_task_id": 8,
  "to_sort_order": 3
}
```

### 用途

別タスクへサブタスクを移動する

### 備考

* 元タスク側、移動先タスク側の sort_order 再計算が必要

---

## 7.4 タスク移動

初版では**同一プロジェクト内のみ**を基本にしていたので、まずは並び替えだけでもいい。
将来見据えて置くならこれ。

* **Method**: `POST`
* **Path**: `/api/tasks/move`

### リクエスト例

```json
{
  "task_id": 12,
  "to_project_id": 2,
  "to_sort_order": 1
}
```

### 備考

* 初版で不要なら未実装扱いにできる

---

# 8. 複製API

## 8.1 タスク複製

* **Method**: `POST`
* **Path**: `/api/tasks/{task_id}/copy`

### リクエスト例

```json
{
  "with_subtasks": true
}
```

### レスポンス例

```json
{
  "copied_task_id": 20
}
```

### 備考

* タスク本体と配下サブタスクを複製
* 日付や担当者も複製対象に含める

---

## 8.2 サブタスク複製

* **Method**: `POST`
* **Path**: `/api/subtasks/{subtask_id}/copy`

### レスポンス例

```json
{
  "copied_subtask_id": 301
}
```

### 備考

* リプラン運用でよく使う想定

---

# 9. 自動入力補助API

このAPIは専用にしたほうがいい。
フロントでも計算できなくはないけれど、祝日マスタ参照や将来の計算ルール変更を考えると、サーバ寄せの方が安全。

## 9.1 サブタスク計画自動入力

* **Method**: `POST`
* **Path**: `/api/subtasks/{subtask_id}/auto-calculate/planned`

### 用途

開始予定日 + 予定工数 から終了予定日、または開始予定日 + 終了予定日から予定工数を計算する

### リクエスト例

```json
{
  "mode": "end_date_from_start_and_effort"
}
```

または

```json
{
  "mode": "effort_from_start_and_end"
}
```

### レスポンス例

```json
{
  "subtask_id": 101,
  "planned_start_date": "2026-03-10",
  "planned_end_date": "2026-03-14",
  "planned_effort_days": 3.0
}
```

---

## 9.2 サブタスク実績自動入力

* **Method**: `POST`
* **Path**: `/api/subtasks/{subtask_id}/auto-calculate/actual`

### 用途

開始実績日 + 終了実績日から実績工数を計算する

### レスポンス例

```json
{
  "subtask_id": 101,
  "actual_start_date": "2026-03-10",
  "actual_end_date": "2026-03-15",
  "actual_effort_days": 4.0
}
```

### 備考

* 土日祝除外
* 実行後、保存済み値を返す

---

# 10. マスタ管理API

## 10.1 サブタスク種別一覧取得

* **Method**: `GET`
* **Path**: `/api/masters/subtask-types`

### クエリパラメータ

| パラメータ            | 型    | 必須 | 説明      |
| ---------------- | ---- | -: | ------- |
| include_inactive | bool | 任意 | 無効も含めるか |

---

## 10.2 サブタスク種別作成

* **Method**: `POST`
* **Path**: `/api/masters/subtask-types`

---

## 10.3 サブタスク種別更新

* **Method**: `PATCH`
* **Path**: `/api/masters/subtask-types/{id}`

---

## 10.4 ステータス一覧取得

* **Method**: `GET`
* **Path**: `/api/masters/statuses`

---

## 10.5 ステータス作成

* **Method**: `POST`
* **Path**: `/api/masters/statuses`

---

## 10.6 ステータス更新

* **Method**: `PATCH`
* **Path**: `/api/masters/statuses/{id}`

### 備考

* 色コード変更もここで行う

---

## 10.7 担当者一覧取得

* **Method**: `GET`
* **Path**: `/api/masters/members`

---

## 10.8 担当者作成

* **Method**: `POST`
* **Path**: `/api/masters/members`

---

## 10.9 担当者更新

* **Method**: `PATCH`
* **Path**: `/api/masters/members/{id}`

---

## 10.10 祝日一覧取得

* **Method**: `GET`
* **Path**: `/api/masters/holidays`

### クエリパラメータ候補

| パラメータ            | 型    | 必須 | 説明    |
| ---------------- | ---- | -: | ----- |
| year             | int  | 任意 | 対象年   |
| include_inactive | bool | 任意 | 無効含むか |

---

## 10.11 祝日作成

* **Method**: `POST`
* **Path**: `/api/masters/holidays`

---

## 10.12 祝日更新

* **Method**: `PATCH`
* **Path**: `/api/masters/holidays/{id}`

---

# 11. システム設定API

## 11.1 システム設定一覧取得

* **Method**: `GET`
* **Path**: `/api/settings`

### 用途

チケットURLテンプレートなどを取得する

---

## 11.2 システム設定更新

* **Method**: `PATCH`
* **Path**: `/api/settings/{setting_key}`

### リクエスト例

```json
{
  "setting_value": "https://dev.azure.com/example/_workitems/edit/{TICKET_ID}"
}
```

---

# 12. 共通補助API

## 12.1 メイン画面用初期データ取得

`/api/wbs` に寄せてもいいけれど、初期ロード用に分けるならこれ。

* **Method**: `GET`
* **Path**: `/api/initial-data`

### 用途

初回表示時に必要な軽量データをまとめて取得する

### 主なレスポンス

```json
{
  "statuses": [...],
  "members": [...],
  "subtask_types": [...],
  "settings": {
    "ticket_url_template": "..."
  }
}
```

### 備考

* マスタ系を毎回個別取得しないためのAPI
* 初回表示を少し楽にできる

---

## 12.2 チケットURL生成補助

これは必須ではないけれど候補。

* **Method**: `GET`
* **Path**: `/api/subtasks/{subtask_id}/ticket-url`

### 用途

チケットIDとテンプレートから遷移URLを生成する

### 備考

初版はフロントでテンプレート置換しても十分

---

# 13. API一覧サマリ

## 13.1 一覧

| 分類     | Method | Path                                                | 用途           |
| ------ | ------ | --------------------------------------------------- | ------------ |
| 表示     | GET    | `/api/wbs`                                          | メイン画面表示データ取得 |
| プロジェクト | POST   | `/api/projects`                                     | プロジェクト作成     |
| プロジェクト | GET    | `/api/projects/{project_id}`                        | プロジェクト詳細取得   |
| プロジェクト | PATCH  | `/api/projects/{project_id}`                        | プロジェクト更新     |
| プロジェクト | DELETE | `/api/projects/{project_id}`                        | プロジェクト論理削除   |
| タスク    | POST   | `/api/tasks`                                        | タスク作成        |
| タスク    | GET    | `/api/tasks/{task_id}`                              | タスク詳細取得      |
| タスク    | PATCH  | `/api/tasks/{task_id}`                              | タスク更新        |
| タスク    | DELETE | `/api/tasks/{task_id}`                              | タスク論理削除      |
| サブタスク  | POST   | `/api/subtasks`                                     | サブタスク作成      |
| サブタスク  | GET    | `/api/subtasks/{subtask_id}`                        | サブタスク詳細取得    |
| サブタスク  | PATCH  | `/api/subtasks/{subtask_id}`                        | サブタスク更新      |
| サブタスク  | DELETE | `/api/subtasks/{subtask_id}`                        | サブタスク論理削除    |
| 並び替え   | POST   | `/api/tasks/reorder`                                | タスク並び替え      |
| 並び替え   | POST   | `/api/subtasks/reorder`                             | サブタスク並び替え    |
| 移動     | POST   | `/api/subtasks/move`                                | サブタスク移動      |
| 移動     | POST   | `/api/tasks/move`                                   | タスク移動        |
| 複製     | POST   | `/api/tasks/{task_id}/copy`                         | タスク複製        |
| 複製     | POST   | `/api/subtasks/{subtask_id}/copy`                   | サブタスク複製      |
| 自動入力   | POST   | `/api/subtasks/{subtask_id}/auto-calculate/planned` | 計画自動入力       |
| 自動入力   | POST   | `/api/subtasks/{subtask_id}/auto-calculate/actual`  | 実績自動入力       |
| マスタ    | GET    | `/api/masters/subtask-types`                        | サブタスク種別一覧    |
| マスタ    | POST   | `/api/masters/subtask-types`                        | サブタスク種別作成    |
| マスタ    | PATCH  | `/api/masters/subtask-types/{id}`                   | サブタスク種別更新    |
| マスタ    | GET    | `/api/masters/statuses`                             | ステータス一覧      |
| マスタ    | POST   | `/api/masters/statuses`                             | ステータス作成      |
| マスタ    | PATCH  | `/api/masters/statuses/{id}`                        | ステータス更新      |
| マスタ    | GET    | `/api/masters/members`                              | 担当者一覧        |
| マスタ    | POST   | `/api/masters/members`                              | 担当者作成        |
| マスタ    | PATCH  | `/api/masters/members/{id}`                         | 担当者更新        |
| マスタ    | GET    | `/api/masters/holidays`                             | 祝日一覧         |
| マスタ    | POST   | `/api/masters/holidays`                             | 祝日作成         |
| マスタ    | PATCH  | `/api/masters/holidays/{id}`                        | 祝日更新         |
| 設定     | GET    | `/api/settings`                                     | 設定一覧取得       |
| 設定     | PATCH  | `/api/settings/{setting_key}`                       | 設定更新         |
| 補助     | GET    | `/api/initial-data`                                 | 初期データ取得      |
