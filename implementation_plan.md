# 担当者ビュー機能 実装計画

WBS管理ツールに「担当者ビュー」機能を追加する要件定義（`docs/05_requirements_resource_view.md`）に基づき、以下の実装計画を提案します。

## 概要
メイン画面に「WBSビュー」と「担当者ビュー」を切り替えるセグメントコントロールを追加し、担当者軸でのガントチャート（リソース状況、遅延・負荷の可視化）を提供するビューを新設します。

## 仕様決定事項
1. **切り替えUI**: 既存の`ModeSwitcher`（標準/計画/実績）とは独立した「ビュー切り替え（WBS / 担当者）」のセグメントコントロール（`ViewSwitcher.tsx`）を `FilterPanel` のヘッダー内に新しく配置します。
2. **標準キャパシティ (ヒートマップ用)**: 1日あたり **1.0 (人日相当)** を基準とします（将来的に調整可能となるよう定数設定とします）。
3. **予定工数の参照プロパティ**: サブタスクの工数計算には `planned_effort` を使用します。

## 推奨されるファイル変更（Proposed Changes）

### Frontend State & Types
#### [MODIFY] `frontend/src/components/FilterPanel/FilterPanelTypes.ts`
- `DisplayOptions` に `viewMode: 'wbs' | 'resource'` を追加します。

#### [MODIFY] `frontend/src/pages/mainboard/storage.ts`
- `DisplayOptions`の初期値やlocalStorageへの永続化に `viewMode` を含めるよう更新します。旧設定の互換性維持(`wbs`のデフォルト設定）を追加します。

### UI Components (FilterPanel)
#### [NEW] `frontend/src/components/FilterPanel/ViewSwitcher.tsx`
- 「WBS・担当者」を切り替えるセグメントコントロールを作成します。
#### [MODIFY] `frontend/src/components/FilterPanel.tsx`
- ヘッダー部分に `ViewSwitcher` を配置します。

### Data Processing Logic (Hooks)
#### [NEW] `frontend/src/pages/mainboard/useResourceData.ts`
既存の `filteredProjects` を元に、担当者を軸にした以下のようなデータ構造 (`ResourceRow[]`) へ変換する独自フックを作成します。
- 進行中件数、遅延件数、今週終了予定件数、レビュー待ち件数、今週予定工数（`planned_effort`の合計）の算出ロジックを実装します。

### Resource View Components
#### [MODIFY] `frontend/src/pages/mainboard/MainBoardContent.tsx`
- `displayOptions.viewMode` が `'resource'` の場合、既存の `WBSTree` と `GanttChart` の代わりに `ResourceBoard` を描画するようにルーティングします。
#### [NEW] `frontend/src/components/ResourceView/ResourceBoard.tsx`
- 担当者ビューのメインレイアウト（左ペイン: リスト、右ペイン: ガントチャート）を定義し、スクロール同期等の制御を行います。
#### [NEW] `frontend/src/components/ResourceView/ResourceList.tsx`
- 担当者名および各サマリー数値を表示する行ヘッダー領域です。
#### [NEW] `frontend/src/components/ResourceView/ResourceGantt.tsx`
- 担当者ごとの横行に対し、複数のサブタスクバーを横軸（日付）で配置します。
- ヒートマップ背景（1日あたりの`planned_effort`合計が`1.0`を超過する日に赤系ハイライト）、バーの遅延赤枠、遅延・ステータスに合わせた色分け、ツールチップを実装します。

## 検証計画 (Verification Plan)
### 手動検証
1. モード切替ボタンが機能し、画面が切り替わること（既存のフィルタ条件が維持されるか）。
2. Resource View側で正しく担当者の行にバーが複数描画されること。
3. 同一日に1.0を超えるタスクをアサインした際、ヒートマップ（赤背景）が表示されること。
4. 遅延タスクのバー外枠が赤色で表示されていること。
5. バーをホバーした際、詳細な情報を含むツールチップが表示されること。
