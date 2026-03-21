# Web版WBS管理ツール DB設計

## 1. 設計方針

### 1.1 基本方針

本システムでは、WBSを以下の3階層で管理する。

* プロジェクト
* タスク
* サブタスク

DBではこの階層を素直に分割し、以下の考え方で設計する。

* プロジェクト、タスク、サブタスクは別テーブルとする
* 親子関係は外部キーで表現する
* 表示順は各階層ごとに明示的に保持する
* 削除は論理削除とする
* マスタ値は独立テーブルで管理する
* ガント表示や集計に必要な値は、基本的に明細から導出する
* 初版では監査ログや履歴管理テーブルは持たない

### 1.2 日付管理方針

日付はすべて `date` 型で管理する。
時刻までは不要とする。

対象日付:

* 計画開始日
* 計画終了日
* 実績開始日
* 実績終了日

### 1.3 工数管理方針

工数は人日単位で管理し、小数を許容する。
そのため PostgreSQL では `numeric(8,2)` 程度を想定する。

### 1.4 論理削除方針

プロジェクト、タスク、サブタスクは物理削除せず、論理削除とする。
削除済データは通常検索対象から除外する。

### 1.5 自動集約方針

プロジェクト・タスクの開始日/終了日や工数合計は、サブタスク明細から導出可能なため、原則として都度計算でもよい。
ただし表示性能や実装の単純さを考えると、初版は次の方針が現実的。

* 日付自動設定フラグは保持する
* 集約結果の開始日/終了日はプロジェクト/タスク側にも保持する
* 工数合計は都度計算またはビュー/API側で集約する
* 必要になれば将来キャッシュ列を追加する

つまり、「全部正規化で押し切る」より、少し実務寄りにしている。理想だけで組むと、実装者があとで無言になることがあるからね。

---

# 2. テーブル一覧

## 2.1 業務テーブル

1. `projects`
2. `tasks`
3. `subtasks`

## 2.2 マスタテーブル

4. `mst_subtask_types`
5. `mst_statuses`
6. `mst_members`
7. `mst_holidays`
8. `system_settings`

## 2.3 将来拡張候補

* 操作履歴テーブル
* 変更履歴テーブル
* 添付ファイルテーブル
* コメントテーブル

---

# 3. テーブル定義

---

## 3.1 projects

### 3.1.1 概要

プロジェクトを管理するテーブル。

### 3.1.2 カラム一覧

| カラム名                 | 型            | NOT NULL | PK | FK | 初期値   | 説明              |
| -------------------- | ------------ | -------: | -: | -: | ----- | --------------- |
| id                   | bigserial    |        ○ |  ○ |    |       | プロジェクトID        |
| project_name         | varchar(200) |        ○ |    |    |       | プロジェクト名         |
| planned_start_date   | date         |          |    |    |       | 計画開始日           |
| planned_end_date     | date         |          |    |    |       | 計画終了日           |
| actual_start_date    | date         |          |    |    |       | 実績開始日           |
| actual_end_date      | date         |          |    |    |       | 実績終了日           |
| is_auto_planned_date | boolean      |        ○ |    |    | false | 計画日を配下から自動設定するか |
| is_auto_actual_date  | boolean      |        ○ |    |    | false | 実績日を配下から自動設定するか |
| sort_order           | integer      |        ○ |    |    | 0     | 表示順             |
| is_deleted           | boolean      |        ○ |    |    | false | 論理削除フラグ         |
| created_at           | timestamptz  |        ○ |    |    | now() | 作成日時            |
| updated_at           | timestamptz  |        ○ |    |    | now() | 更新日時            |

### 3.1.3 制約

* `project_name <> ''`
* `sort_order >= 0`
* `planned_end_date >= planned_start_date`（両方NULLでない場合）
* `actual_end_date >= actual_start_date`（両方NULLでない場合）

---

## 3.2 tasks

### 3.2.1 概要

プロジェクト配下のタスクを管理するテーブル。

### 3.2.2 カラム一覧

| カラム名                 | 型            | NOT NULL | PK | FK | 初期値   | 説明              |
| -------------------- | ------------ | -------: | -: | -: | ----- | --------------- |
| id                   | bigserial    |        ○ |  ○ |    |       | タスクID           |
| project_id           | bigint       |        ○ |    |  ○ |       | 所属プロジェクトID      |
| task_name            | varchar(200) |        ○ |    |    |       | タスク名            |
| planned_start_date   | date         |          |    |    |       | 計画開始日           |
| planned_end_date     | date         |          |    |    |       | 計画終了日           |
| actual_start_date    | date         |          |    |    |       | 実績開始日           |
| actual_end_date      | date         |          |    |    |       | 実績終了日           |
| is_auto_planned_date | boolean      |        ○ |    |    | false | 計画日を配下から自動設定するか |
| is_auto_actual_date  | boolean      |        ○ |    |    | false | 実績日を配下から自動設定するか |
| sort_order           | integer      |        ○ |    |    | 0     | プロジェクト内表示順      |
| is_deleted           | boolean      |        ○ |    |    | false | 論理削除フラグ         |
| created_at           | timestamptz  |        ○ |    |    | now() | 作成日時            |
| updated_at           | timestamptz  |        ○ |    |    | now() | 更新日時            |

### 3.2.3 外部キー

* `project_id -> projects.id`

### 3.2.4 制約

* `task_name <> ''`
* `sort_order >= 0`
* `planned_end_date >= planned_start_date`（両方NULLでない場合）
* `actual_end_date >= actual_start_date`（両方NULLでない場合）

---

## 3.3 subtasks

### 3.3.1 概要

タスク配下のサブタスクを管理するテーブル。
本システムの中心データ。

### 3.3.2 カラム一覧

| カラム名                | 型            | NOT NULL | PK | FK | 初期値   | 説明         |
| ------------------- | ------------ | -------: | -: | -: | ----- | ---------- |
| id                  | bigserial    |        ○ |  ○ |    |       | サブタスクID    |
| task_id             | bigint       |        ○ |    |  ○ |       | 所属タスクID    |
| subtask_type_id     | bigint       |        ○ |    |  ○ |       | サブタスク種別ID  |
| subtask_detail      | varchar(300) |          |    |    |       | サブタスク詳細    |
| status_id           | bigint       |        ○ |    |  ○ |       | ステータスID    |
| progress_percent    | integer      |          |    |    |       | 進捗率（0～100） |
| assignee_id         | bigint       |          |    |  ○ |       | 担当者ID      |
| planned_start_date  | date         |          |    |    |       | 計画開始日      |
| planned_end_date    | date         |          |    |    |       | 計画終了日      |
| actual_start_date   | date         |          |    |    |       | 実績開始日      |
| actual_end_date     | date         |          |    |    |       | 実績終了日      |
| planned_effort_days | numeric(8,2) |          |    |    |       | 予定工数（人日）   |
| actual_effort_days  | numeric(8,2) |          |    |    |       | 実績工数（人日）   |
| review_days         | numeric(8,2) |          |    |    |       | レビュー日数     |
| ticket_id           | bigint       |          |    |    |       | チケットID     |
| memo                | text         |          |    |    |       | メモ         |
| sort_order          | integer      |        ○ |    |    | 0     | タスク内表示順    |
| is_deleted          | boolean      |        ○ |    |    | false | 論理削除フラグ    |
| created_at          | timestamptz  |        ○ |    |    | now() | 作成日時       |
| updated_at          | timestamptz  |        ○ |    |    | now() | 更新日時       |

### 3.3.3 外部キー

* `task_id -> tasks.id`
* `subtask_type_id -> mst_subtask_types.id`
* `status_id -> mst_statuses.id`
* `assignee_id -> mst_members.id`

### 3.3.4 制約

* `progress_percent between 0 and 100`
* `planned_effort_days >= 0`
* `actual_effort_days >= 0`
* `review_days >= 0`
* `ticket_id >= 0`
* `sort_order >= 0`
* `planned_end_date >= planned_start_date`（両方NULLでない場合）
* `actual_end_date >= actual_start_date`（両方NULLでない場合）

### 3.3.5 備考

サブタスク表示名は保持しない。
以下のルールでアプリケーション側またはSQLビューで生成する。

* `subtask_detail` がNULLまたは空文字
  → `subtask_type_name`
* `subtask_detail` が存在
  → `subtask_type_name || '(' || subtask_detail || ')'`

保持してもいいけど、同期ズレの火種になりやすいので初版は非保持でいい。

---

## 3.4 mst_subtask_types

### 3.4.1 概要

サブタスク種別マスタ。

### 3.4.2 カラム一覧

| カラム名       | 型            | NOT NULL | PK | 初期値   | 説明        |
| ---------- | ------------ | -------: | -: | ----- | --------- |
| id         | bigserial    |        ○ |  ○ |       | サブタスク種別ID |
| type_name  | varchar(100) |        ○ |    |       | 種別名       |
| sort_order | integer      |        ○ |    | 0     | 表示順       |
| is_active  | boolean      |        ○ |    | true  | 有効フラグ     |
| created_at | timestamptz  |        ○ |    | now() | 作成日時      |
| updated_at | timestamptz  |        ○ |    | now() | 更新日時      |

### 3.4.3 制約

* `type_name <> ''`
* `sort_order >= 0`

---

## 3.5 mst_statuses

### 3.5.1 概要

ステータスマスタ。表示色も持つ。

### 3.5.2 カラム一覧

| カラム名        | 型           | NOT NULL | PK | 初期値   | 説明      |
| ----------- | ----------- | -------: | -: | ----- | ------- |
| id          | bigserial   |        ○ |  ○ |       | ステータスID |
| status_name | varchar(50) |        ○ |    |       | ステータス名  |
| color_code  | varchar(20) |        ○ |    |       | 表示色コード  |
| sort_order  | integer     |        ○ |    | 0     | 表示順     |
| is_active   | boolean     |        ○ |    | true  | 有効フラグ   |
| created_at  | timestamptz |        ○ |    | now() | 作成日時    |
| updated_at  | timestamptz |        ○ |    | now() | 更新日時    |

### 3.5.3 制約

* `status_name <> ''`
* `sort_order >= 0`

### 3.5.4 備考

初期データ例:

* New
* In Progress
* In Review
* Done
* Blocked
* Pending
* Removed

Removedは業務上重要なので、単なる文字列運用ではなく明示的にマスタ保持する。

---

## 3.6 mst_members

### 3.6.1 概要

担当者マスタ。

### 3.6.2 カラム一覧

| カラム名        | 型            | NOT NULL | PK | 初期値   | 説明    |
| ----------- | ------------ | -------: | -: | ----- | ----- |
| id          | bigserial    |        ○ |  ○ |       | 担当者ID |
| member_name | varchar(100) |        ○ |    |       | 氏名    |
| sort_order  | integer      |        ○ |    | 0     | 表示順   |
| is_active   | boolean      |        ○ |    | true  | 有効フラグ |
| created_at  | timestamptz  |        ○ |    | now() | 作成日時  |
| updated_at  | timestamptz  |        ○ |    | now() | 更新日時  |

### 3.6.3 制約

* `member_name <> ''`
* `sort_order >= 0`

---

## 3.7 mst_holidays

### 3.7.1 概要

祝日マスタ。工数/日付補助計算で使用する。

### 3.7.2 カラム一覧

| カラム名         | 型            | NOT NULL | PK | 初期値   | 説明    |
| ------------ | ------------ | -------: | -: | ----- | ----- |
| id           | bigserial    |        ○ |  ○ |       | 祝日ID  |
| holiday_date | date         |        ○ |    |       | 祝日の日付 |
| holiday_name | varchar(100) |        ○ |    |       | 祝日名   |
| is_active    | boolean      |        ○ |    | true  | 有効フラグ |
| created_at   | timestamptz  |        ○ |    | now() | 作成日時  |
| updated_at   | timestamptz  |        ○ |    | now() | 更新日時  |

### 3.7.3 制約

* `holiday_name <> ''`
* `holiday_date` は有効期間内で一意が望ましい

### 3.7.4 一意制約候補

* `unique (holiday_date)`

---

## 3.8 system_settings

### 3.8.1 概要

単一値のシステム設定を保持する汎用設定テーブル。
初版では主にチケットURLテンプレートを管理する。

### 3.8.2 カラム一覧

| カラム名          | 型            | NOT NULL | PK | 初期値   | 説明   |
| ------------- | ------------ | -------: | -: | ----- | ---- |
| setting_key   | varchar(100) |        ○ |  ○ |       | 設定キー |
| setting_value | text         |        ○ |    |       | 設定値  |
| description   | varchar(300) |          |    |       | 説明   |
| updated_at    | timestamptz  |        ○ |    | now() | 更新日時 |

### 3.8.3 想定データ

| setting_key         | setting_value                           |
| ------------------- | --------------------------------------- |
| ticket_url_template | `https://dev.azure.com/.../{TICKET_ID}` |

### 3.8.4 備考

設定項目が少ない初期段階では、専用テーブルを乱立させるよりこちらの方が軽い。
ただし設定が増えすぎたら、将来分割してよい。

---

# 4. リレーション

## 4.1 ERの考え方

* `projects 1 - n tasks`
* `tasks 1 - n subtasks`
* `mst_subtask_types 1 - n subtasks`
* `mst_statuses 1 - n subtasks`
* `mst_members 1 - n subtasks`

## 4.2 関係図（テキスト）

```text
projects
  └─< tasks
        └─< subtasks
              ├─> mst_subtask_types
              ├─> mst_statuses
              └─> mst_members

mst_holidays   （独立）
system_settings（独立）
```

---

# 5. 集約・導出項目の扱い

## 5.1 プロジェクト/タスクの日付

プロジェクト、タスクの開始日/終了日は、以下の2通りで決まる。

* 手入力
* 自動設定ON時、配下サブタスクから集約

### 集約ルール

* `is_auto_planned_date = true`

  * 配下のRemoved以外のサブタスクについて
  * `planned_start_date` の最小値
  * `planned_end_date` の最大値
* `is_auto_actual_date = true`

  * 配下のRemoved以外のサブタスクについて
  * `actual_start_date` の最小値
  * `actual_end_date` の最大値

### DB観点

* 集約結果を `projects` / `tasks` テーブルに保持する
* 更新タイミングはアプリケーション側で制御する

## 5.2 工数合計

タスク、プロジェクトの予定工数/実績工数は明細から集計する。

### 初版推奨

* DB列としては持たない
* API取得時に集計する
* 必要ならビューまたはSQL集約を使う

理由は単純で、保持し始めると整合性更新が増えるから。初版ではまだそこまで背負わなくていい。

---

# 6. 論理削除の扱い

## 6.1 対象

* `projects`
* `tasks`
* `subtasks`

## 6.2 方針

削除時は `is_deleted = true` に更新する。

## 6.3 注意点

* 通常の一覧取得では `is_deleted = false` を条件に含める
* 親が削除されても子は残る可能性があるため、アプリ/API側では親削除時の扱いを統一する必要がある

## 6.4 推奨

プロジェクト削除時・タスク削除時は、配下もまとめて論理削除するほうが自然。
DBのON DELETE CASCADEは物理削除向けなので、ここはアプリケーション側処理にする。

---

# 7. インデックス設計

## 7.1 基本インデックス

PKとUK以外に、以下を推奨する。

### projects

* `(is_deleted, sort_order)`

### tasks

* `(project_id, is_deleted, sort_order)`

### subtasks

* `(task_id, is_deleted, sort_order)`
* `(status_id)`
* `(assignee_id)`
* `(planned_start_date)`
* `(planned_end_date)`
* `(actual_start_date)`
* `(actual_end_date)`

### mst_holidays

* `(holiday_date)` unique

## 7.2 検索・表示観点の補足

スライサーで担当者抽出や複数プロジェクト抽出をするので、以下も有効。

### subtasks 追加候補

* `(assignee_id, is_deleted)`
* `(status_id, is_deleted)`

### tasks 追加候補

* `(project_id, sort_order)`

---

# 8. 推奨DDLイメージ

ざっくりしたPostgreSQL DDLイメージも付けるね。
厳密な本番DDLの前段としては十分使えるはず。

```sql
create table projects (
    id bigserial primary key,
    project_name varchar(200) not null,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,
    is_auto_planned_date boolean not null default false,
    is_auto_actual_date boolean not null default false,
    sort_order integer not null default 0,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (project_name <> ''),
    check (sort_order >= 0),
    check (planned_start_date is null or planned_end_date is null or planned_end_date >= planned_start_date),
    check (actual_start_date is null or actual_end_date is null or actual_end_date >= actual_start_date)
);

create table tasks (
    id bigserial primary key,
    project_id bigint not null references projects(id),
    task_name varchar(200) not null,
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,
    is_auto_planned_date boolean not null default false,
    is_auto_actual_date boolean not null default false,
    sort_order integer not null default 0,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (task_name <> ''),
    check (sort_order >= 0),
    check (planned_start_date is null or planned_end_date is null or planned_end_date >= planned_start_date),
    check (actual_start_date is null or actual_end_date is null or actual_end_date >= actual_start_date)
);

create table mst_subtask_types (
    id bigserial primary key,
    type_name varchar(100) not null,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (type_name <> ''),
    check (sort_order >= 0)
);

create table mst_statuses (
    id bigserial primary key,
    status_name varchar(50) not null,
    color_code varchar(20) not null,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (status_name <> ''),
    check (sort_order >= 0)
);

create table mst_members (
    id bigserial primary key,
    member_name varchar(100) not null,
    sort_order integer not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (member_name <> ''),
    check (sort_order >= 0)
);

create table subtasks (
    id bigserial primary key,
    task_id bigint not null references tasks(id),
    subtask_type_id bigint not null references mst_subtask_types(id),
    subtask_detail varchar(300),
    status_id bigint not null references mst_statuses(id),
    progress_percent integer,
    assignee_id bigint references mst_members(id),
    planned_start_date date,
    planned_end_date date,
    actual_start_date date,
    actual_end_date date,
    planned_effort_days numeric(8,2),
    actual_effort_days numeric(8,2),
    review_days numeric(8,2),
    ticket_id bigint,
    memo text,
    sort_order integer not null default 0,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (progress_percent is null or (progress_percent between 0 and 100)),
    check (planned_effort_days is null or planned_effort_days >= 0),
    check (actual_effort_days is null or actual_effort_days >= 0),
    check (review_days is null or review_days >= 0),
    check (ticket_id is null or ticket_id >= 0),
    check (sort_order >= 0),
    check (planned_start_date is null or planned_end_date is null or planned_end_date >= planned_start_date),
    check (actual_start_date is null or actual_end_date is null or actual_end_date >= actual_start_date)
);

create table mst_holidays (
    id bigserial primary key,
    holiday_date date not null unique,
    holiday_name varchar(100) not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (holiday_name <> '')
);

create table system_settings (
    setting_key varchar(100) primary key,
    setting_value text not null,
    description varchar(300),
    updated_at timestamptz not null default now()
);
```

---

# 9. ビュー候補

初版で必須ではないけれど、あると便利なビューも書いておく。

## 9.1 subtask_display_view

サブタスクの表示名やマスタ名をJOIN済みで返すビュー。

含めるもの:

* サブタスクID
* タスクID
* サブタスク表示名
* ステータス名
* ステータス色
* 担当者名
* 日付各種
* 工数各種
* 遅延判定に必要な元データ

## 9.2 task_effort_summary_view

タスクごとの予定工数/実績工数集計ビュー。

## 9.3 project_effort_summary_view

プロジェクトごとの予定工数/実績工数集計ビュー。

これはAPIを少し楽にする。
まあ、ビューが増えすぎると今度は「どこで何を作ってるんだっけ」問題も出るので、最初は必要最小限でいい。

---

# 10. 業務ルールとDB反映メモ

## 10.1 Removedの扱い

Removedは `subtasks.is_deleted` ではなく、**ステータスで表現**する。
つまり、

* 論理削除 = データそのものを削除扱い
* Removed = 業務上の廃止状態

これは明確に分ける。
混ぜると後でかなり危ない。

## 10.2 自動集約対象

タスク/プロジェクトの日付自動集約では、Removedステータスのサブタスクを除外する。
この判定は `status_id` から行う。

## 10.3 複製

複製時は新規レコードとしてINSERTする。
コピー対象に含めるもの・含めないものはAPI設計で決めるが、基本は以下。

### サブタスク複製

含める:

* 種別
* 詳細
* ステータス
* 担当者
* 日付
* 工数
* レビュー日数
* チケットID
* メモ

含めない/再採番:

* id
* created_at
* updated_at

### タスク複製

* タスク本体を複製
* 配下サブタスクも複製
