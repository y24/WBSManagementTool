"""OpenAPI 仕様書を生成するスクリプト。

FastAPI アプリ (`app.main.app`) から OpenAPI スキーマを取得し、
タグ分類・日本語の説明・サーバ情報などのメタデータを付与したうえで
`docs/api/openapi.yaml` と `docs/api/openapi.json` として出力する。

使い方:
    cd backend
    python generate_openapi.py
"""
from __future__ import annotations

import json
import os
from collections import OrderedDict

import yaml

from app.main import app

# ---------------------------------------------------------------------------
# 出力先
# ---------------------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.normpath(os.path.join(HERE, "..", "docs", "api"))
YAML_PATH = os.path.join(DOCS_DIR, "openapi.yaml")
JSON_PATH = os.path.join(DOCS_DIR, "openapi.json")

# ---------------------------------------------------------------------------
# API 全体のメタ情報
# ---------------------------------------------------------------------------
INFO = {
    "title": "WBS Management Tool API",
    "version": "1.0.0",
    "description": (
        "WBS（Work Breakdown Structure）管理ツールのバックエンド REST API。\n\n"
        "プロジェクト > タスク > サブタスクの3階層で構成される WBS データの CRUD、\n"
        "ガントチャート表示用の集計、マスタ管理、ダッシュボード集計、Excel インポート/エクスポート、\n"
        "Azure DevOps 連携などを提供する。\n\n"
        "## 共通仕様\n"
        "- 通信形式: JSON (REST)\n"
        "- ベースURL: `/api`\n"
        "- ステータス: マスタ `mst_status` に依存。デフォルトは `1`（新規）、`7`（Removed）は論理削除相当。\n"
        "- 日付項目: `YYYY-MM-DD` 形式。\n"
        "- 認証: 一般 API は認証なし（ローカル/イントラ前提、CORS は全許可）。"
        "Azure DevOps 同期 API のみ `X-Sync-Token` ヘッダによるトークン認証が必要。\n"
    ),
}

SERVERS = [
    {"url": "http://localhost:8000", "description": "ローカル開発サーバ"},
    {"url": "/", "description": "同一オリジン（リバースプロキシ/IIS 配備時）"},
]

# ---------------------------------------------------------------------------
# タグ定義（表示順）
# ---------------------------------------------------------------------------
TAGS = [
    {"name": "Health", "description": "ヘルスチェック"},
    {"name": "WBS", "description": "WBS 階層データの集計取得・バージョン確認・エクスポート"},
    {"name": "Projects", "description": "プロジェクトの作成・更新・削除・並び替え"},
    {"name": "Tasks", "description": "タスクの作成・更新・削除・並び替え"},
    {"name": "Subtasks", "description": "サブタスクの作成・更新・削除・並び替え"},
    {"name": "Subtask Interruptions", "description": "サブタスクの中断期間の管理"},
    {"name": "Items", "description": "プロジェクト/タスク/サブタスク横断の一括操作（複製・実績クリア・日付シフト等）"},
    {"name": "Masters", "description": "マスタ管理（ステータス・サブタスク種別・メンバ・休日）"},
    {"name": "System Settings", "description": "システム設定の取得・更新"},
    {"name": "Initial Data", "description": "フロントエンド初期化用のマスタ・設定一括取得"},
    {"name": "Markers", "description": "ガントチャート上のマーカー（基準日線）の管理"},
    {"name": "Dashboard", "description": "ダッシュボード用の集計データ取得"},
    {"name": "Import / Export", "description": "Excel テンプレート・インポート・エクスポート"},
    {"name": "Shared Filters", "description": "フィルタ条件の共有リンク発行・取得"},
    {"name": "Azure DevOps", "description": "Azure DevOps Work Item との同期・参照"},
]

# ---------------------------------------------------------------------------
# operationId(=関数名ベース) ごとの サマリ / 説明 / タグ
# キー: FastAPI が自動採番する operationId（関数名）
# ---------------------------------------------------------------------------
META = {
    # --- Health ---
    "read_health_api_health_get": (
        "Health", "ヘルスチェック",
        "サーバの稼働確認。常に `{\"status\": \"ok\"}` を返す。",
    ),
    # --- WBS ---
    "read_wbs_version_api_wbs_version_get": (
        "WBS", "WBS バージョン取得",
        "WBSツリー（プロジェクト/タスク/サブタスク/中断期間）と初期データ（マスタ/マーカー/設定）の"
        "変更検知用バージョン文字列を返す。フロントは差分検知に使用する。",
    ),
    "read_wbs_api_wbs_get": (
        "WBS", "WBS データ取得",
        "プロジェクト > タスク > サブタスクの全階層データと、ガントチャート描画範囲を取得する。\n\n"
        "- `refresh_ongoing_end_dates=true` の場合、進捗100%かつ実績終了日未設定のサブタスクに当日をセットする。\n"
        "- 計画/実績工数合計・進捗率・重複フラグはレスポンス生成時に動的計算される。\n"
        "- `gantt_range` は全データの最小開始日〜最大終了日に前後バッファを加えて自動計算される。",
    ),
    "export_wbs_api_wbs_export_post": (
        "WBS", "WBS エクスポート",
        "リクエストボディで渡した WBS（プロジェクト配列）を Excel ファイル（.xlsx）として出力する。",
    ),
    # --- Projects ---
    "create_project_api_projects_post": ("Projects", "プロジェクト作成", "新規プロジェクトを作成する。`status_id` 未指定時は `1`（新規）。"),
    "update_project_api_projects__project_id__patch": ("Projects", "プロジェクト更新", "指定プロジェクトを部分更新する。存在しない場合は 404。"),
    "delete_project_api_projects__project_id__delete": ("Projects", "プロジェクト削除", "指定プロジェクトを削除（論理削除）する。存在しない場合は 404。"),
    "reorder_projects_api_projects_reorder_post": ("Projects", "プロジェクト並び替え", "`ordered_ids` の順に `sort_order` を更新する。"),
    # --- Tasks ---
    "create_task_api_tasks_post": ("Tasks", "タスク作成", "新規タスクを作成する。`project_id` 必須。"),
    "update_task_api_tasks__task_id__patch": ("Tasks", "タスク更新", "指定タスクを部分更新する。存在しない場合は 404。"),
    "delete_task_api_tasks__task_id__delete": ("Tasks", "タスク削除", "指定タスクを削除（論理削除）する。存在しない場合は 404。"),
    "reorder_tasks_api_tasks_reorder_post": ("Tasks", "タスク並び替え", "`ordered_ids` の順に `sort_order` を更新する。"),
    # --- Subtasks ---
    "create_subtask_api_subtasks_post": ("Subtasks", "サブタスク作成", "新規サブタスクを作成する。`task_id` 必須。"),
    "update_subtask_api_subtasks__subtask_id__patch": (
        "Subtasks", "サブタスク更新",
        "指定サブタスクを部分更新する。`skip_status_auto_update=true` で進捗連動のステータス自動更新を抑止できる。存在しない場合は 404。",
    ),
    "delete_subtask_api_subtasks__subtask_id__delete": ("Subtasks", "サブタスク削除", "指定サブタスクを削除（論理削除）する。存在しない場合は 404。"),
    "reorder_subtasks_api_subtasks_reorder_post": ("Subtasks", "サブタスク並び替え", "`ordered_ids` の順に `sort_order` を更新する。"),
    # --- Subtask Interruptions ---
    "get_subtask_interruptions_api_subtasks__subtask_id__interruptions_get": (
        "Subtask Interruptions", "中断期間一覧取得", "指定サブタスクに紐づく中断期間の一覧を取得する。",
    ),
    "create_subtask_interruption_api_subtasks__subtask_id__interruptions_post": (
        "Subtask Interruptions", "中断期間作成",
        "サブタスクに中断期間を追加する。パスの `subtask_id` とボディの `subtask_id` が不一致の場合は 400。",
    ),
    "update_subtask_interruption_api_interruptions__interruption_id__patch": (
        "Subtask Interruptions", "中断期間更新", "指定中断期間を部分更新する。存在しない場合は 404。",
    ),
    "delete_subtask_interruption_api_interruptions__interruption_id__delete": (
        "Subtask Interruptions", "中断期間削除", "指定中断期間を削除する。存在しない場合は 404。",
    ),
    # --- Items（一括操作）---
    "recalc_all_effort_api_admin_recalc_effort_post": (
        "Items", "工数再計算", "対象プロジェクト（未指定時は全件）の自動工数を再計算する。",
    ),
    "duplicate_items_api_items_duplicate_post": ("Items", "項目複製", "選択したプロジェクト/タスク/サブタスクを複製する。"),
    "clear_actuals_api_items_clear_actuals_post": ("Items", "実績クリア", "選択した項目の実績（開始/終了日・工数・進捗等）をクリアする。"),
    "clear_plans_actuals_api_items_clear_plans_actuals_post": ("Items", "計画・実績クリア", "選択した項目の計画と実績の両方をクリアする。"),
    "shift_dates_api_items_shift_dates_post": (
        "Items", "日付シフト", "選択した項目群を `new_base_date` を基準に一括で日付シフトする。対象が無い場合は 400。",
    ),
    # --- Masters: Status ---
    "create_status_api_masters_statuses_post": ("Masters", "ステータス作成", "ステータスマスタを作成する。"),
    "update_status_api_masters_statuses__status_id__patch": ("Masters", "ステータス更新", "ステータスマスタを部分更新する。存在しない場合は 404。"),
    "delete_status_api_masters_statuses__status_id__delete": ("Masters", "ステータス削除", "ステータスマスタを削除する。存在しない場合は 404。"),
    "reorder_statuses_api_masters_statuses_reorder_post": ("Masters", "ステータス並び替え", "`ordered_ids` の順に `sort_order` を更新する。"),
    # --- Masters: SubtaskType ---
    "create_subtask_type_api_masters_subtask_types_post": ("Masters", "サブタスク種別作成", "サブタスク種別マスタを作成する。"),
    "update_subtask_type_api_masters_subtask_types__type_id__patch": ("Masters", "サブタスク種別更新", "サブタスク種別マスタを部分更新する。存在しない場合は 404。"),
    "delete_subtask_type_api_masters_subtask_types__type_id__delete": ("Masters", "サブタスク種別削除", "サブタスク種別マスタを削除する。存在しない場合は 404。"),
    "reorder_subtask_types_api_masters_subtask_types_reorder_post": ("Masters", "サブタスク種別並び替え", "`ordered_ids` の順に `sort_order` を更新する。"),
    # --- Masters: Member ---
    "create_member_api_masters_members_post": ("Masters", "メンバ作成", "メンバマスタを作成する。"),
    "update_member_api_masters_members__member_id__patch": ("Masters", "メンバ更新", "メンバマスタを部分更新する。存在しない場合は 404。"),
    "delete_member_api_masters_members__member_id__delete": ("Masters", "メンバ削除", "メンバマスタを削除する。存在しない場合は 404。"),
    "reorder_members_api_masters_members_reorder_post": ("Masters", "メンバ並び替え", "`ordered_ids` の順に `sort_order` を更新する。"),
    # --- Masters: Holiday ---
    "create_holiday_api_masters_holidays_post": ("Masters", "休日作成", "休日マスタを作成する。"),
    "update_holiday_api_masters_holidays__holiday_id__patch": ("Masters", "休日更新", "休日マスタを部分更新する。存在しない場合は 404。"),
    "delete_holiday_api_masters_holidays__holiday_id__delete": ("Masters", "休日削除", "休日マスタを削除する。存在しない場合は 404。"),
    "sync_holidays_api_masters_holidays_sync_post": (
        "Masters", "休日同期", "holidays-jp API から日本の祝日を取得し、休日マスタへ追加/更新する。",
    ),
    # --- System Settings ---
    "get_ticket_url_api_settings_ticket_url_get": ("System Settings", "チケットURLテンプレート取得", "チケットURLテンプレート設定を取得する。未設定時は 404。"),
    "set_system_setting_api_settings__key__put": (
        "System Settings", "システム設定更新",
        "任意のキーのシステム設定を登録/更新する（チケットURL・ステータス条件・稼働率/予実差しきい値・DevOps同期条件など）。",
    ),
    # --- Initial Data ---
    "get_initial_data_api_initial_data_get": (
        "Initial Data", "初期データ取得",
        "ステータス/サブタスク種別/メンバ/休日/マーカーの各マスタと、各種システム設定値をまとめて取得する。",
    ),
    # --- Markers ---
    "get_markers_api_markers_get": ("Markers", "マーカー一覧取得", "全マーカーを取得する。"),
    "create_or_update_marker_api_markers_post": ("Markers", "マーカー作成/更新", "マーカーを作成、または同一日付があれば更新する。"),
    "update_marker_api_markers__marker_id__patch": ("Markers", "マーカー更新", "指定マーカーを部分更新する。存在しない場合は 404。"),
    "delete_marker_api_markers__marker_id__delete": ("Markers", "マーカー削除", "指定マーカーを削除する。存在しない場合は 404。"),
    # --- Dashboard ---
    "get_dashboard_api_dashboard_get": ("Dashboard", "ダッシュボード取得", "KPI・進捗・遅延・ステータス集計・予実乖離などのダッシュボード集計データを取得する。"),
    # --- Import / Export ---
    "get_import_template_api_import_template_get": ("Import / Export", "インポートテンプレート取得", "インポート用 Excel テンプレート（.xlsx）をダウンロードする。"),
    "preview_import_api_import_preview_post": (
        "Import / Export", "インポートプレビュー",
        "アップロードした Excel を検証し、行ごとの解析結果とエラー、取込可否を返す。",
    ),
    "execute_import_api_import_execute_post": ("Import / Export", "インポート実行", "プレビュー結果の行データを実際に DB へ取り込む。失敗時は 400。"),
    # --- Shared Filters ---
    "create_shared_filter_api_shared_filters_post": ("Shared Filters", "共有フィルタ作成", "フィルタ条件を保存し、共有用トークンを発行する。"),
    "get_shared_filter_api_shared_filters__token__get": ("Shared Filters", "共有フィルタ取得", "トークンから共有フィルタ条件を取得する。存在しない場合は 404。"),
    # --- Azure DevOps ---
    "sync_to_azure_devops_integrations_azure_devops_sync_post": (
        "Azure DevOps", "Azure DevOps 同期",
        "WBS の日付項目を Azure DevOps Work Item へ同期する。`X-Sync-Token` ヘッダ必須。"
        "`dry_run=true` で書き込みせず差分のみ評価。多重実行時は 409。",
    ),
    "get_child_work_item_candidates_integrations_azure_devops_work_items__parent_work_item_id__children_get": (
        "Azure DevOps", "子 Work Item 候補取得",
        "親 Work Item の子 Work Item 一覧を取得する。`filter_by_work_item_type` と `subtask_type_id` で種別フィルタ可能。",
    ),
    "list_azure_devops_users_integrations_azure_devops_users_get": (
        "Azure DevOps", "Azure DevOps ユーザ一覧取得",
        "Azure DevOps のユーザ一覧を取得する（ローカルには保存しない）。",
    ),
}

# 認証が必要なエンドポイント（operationId）
SECURED_OPERATIONS = {"sync_to_azure_devops_integrations_azure_devops_sync_post"}


def build() -> dict:
    schema = app.openapi()

    # info / servers / tags の上書き
    schema["info"].update(INFO)
    schema["servers"] = SERVERS
    schema["tags"] = TAGS

    # セキュリティスキーム定義
    components = schema.setdefault("components", {})
    components.setdefault("securitySchemes", {})["SyncToken"] = {
        "type": "apiKey",
        "in": "header",
        "name": "X-Sync-Token",
        "description": "Azure DevOps 同期用の共有トークン。サーバの環境変数 WBS_SYNC_TOKEN と一致する必要がある。",
    }

    # 各オペレーションへタグ/サマリ/説明/セキュリティを付与
    missing = []
    for path, ops in schema["paths"].items():
        for method, op in ops.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            op_id = op.get("operationId", "")
            meta = META.get(op_id)
            if meta:
                tag, summary, description = meta
                op["tags"] = [tag]
                op["summary"] = summary
                op["description"] = description
            else:
                missing.append(op_id)
            if op_id in SECURED_OPERATIONS:
                op["security"] = [{"SyncToken": []}]

    if missing:
        print("WARN: メタ情報未設定の operationId:")
        for m in missing:
            print("  -", m)

    return schema


def main() -> None:
    os.makedirs(DOCS_DIR, exist_ok=True)
    schema = build()

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(schema, f, ensure_ascii=False, indent=2)

    with open(YAML_PATH, "w", encoding="utf-8") as f:
        yaml.safe_dump(schema, f, allow_unicode=True, sort_keys=False, width=120)

    n_paths = len(schema["paths"])
    n_ops = sum(
        1
        for ops in schema["paths"].values()
        for m in ops
        if m in {"get", "post", "put", "patch", "delete"}
    )
    n_schemas = len(schema.get("components", {}).get("schemas", {}))
    print(f"OK: paths={n_paths}, operations={n_ops}, schemas={n_schemas}")
    print(f"  -> {YAML_PATH}")
    print(f"  -> {JSON_PATH}")


if __name__ == "__main__":
    main()
