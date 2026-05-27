# 担当者ビュー 再設計計画

## 1. 目的

現行の担当者ビューは「計画と実績の比較」「空き期間の把握」「遅延の検知」「負荷偏りの確認」という4つの目的を同じ情報密度で提示しようとしているが、結果としてどれも視認性が低い状態にある。本改修はこれら4つの目的をそれぞれ独立した視覚要素に分解し、運用効率を大幅に改善することを目的とする。

---

## 2. 現状の問題点

| # | 問題 | 詳細 |
|---|------|------|
| 1 | 計画と実績が縦2分割レーン | 計画行・実績行が上下に分かれており、一致・乖離を確認するには視線の往復と頭の中での重ね合わせが必要 |
| 2 | 色の意味レイヤーが多すぎる | ステータス色・空き背景（薄黄）・今日ライン・休日色が混在し、どの色が何を示すか覚えきれない |
| 3 | 負荷が件数しか出ない | 進行中/遅延/今週終了の件数はあるが「何日分の作業を抱えているか」という定量的な工数負荷が見えない |
| 4 | 未アサインが担当者と同列 | 性質の異なる「未アサイン」行が担当者リストに混在し、負荷集計の分母がブレる |
| 5 | ソート順が運用目的に合っていない | 現状は進行中件数降順で、遅延者・過負荷者が先頭に来ない |

---

## 3. 設計方針

### 方針 1: 計画と実績を1本のバーに重ねる

計画バー（薄いグレー）を背景レイヤー、実績バー（ステータス色）を前景レイヤーとして同一トラック内に重ねて表示する。

- **オンスケ**: 実績バーの幅 ≈ 計画バーの幅
- **進捗遅れ（実績が計画より短い）**: 実績バーが計画バーの右端に到達していない
- **遅延（計画終了日を過ぎても未完了）**: 実績バーが計画バーの右端を突き破って延伸する

これにより、パターン認識で計画・実績の乖離を即座に判断できる。現行の上下レーン分割・「計画」「実績」ラベルは廃止する。

### 方針 2: 「負荷率」を独立した数値カラムに出す

`負荷` 列を追加し、担当者ごとの計画工数日数 ÷ 稼働可能日数（％）を常時表示する。

| 負荷率 | 色 | 意味 |
|--------|-----|------|
| ≦ 30% | グレー | 空き多い（要アサイン検討） |
| 31–99% | グリーン系 | 健全 |
| 100–120% | アンバー | やや過負荷 |
| > 120% | レッド系 | 過負荷 |

### 方針 3: 色の意味レイヤーを整理する

- ステータスを示す色（進行中・レビュー中・完了・遅延）は維持
- 「空き期間」は背景色塗りをやめ、**斜線パターン**に変更（「何かが無い場所」として直感的に認識される）
- 行背景への赤みの付与（遅延担当者）は行単位でのみ適用し、ガントエリアの背景色と干渉しないよう管理する

### 方針 4: 担当者の状態を行のメタ情報に集約する

リストパネルの担当者名の下に進行/遅延/完了の件数バッジを表示。遅延がある担当者は行全体に薄い赤の背景を敷き、リストをスクロールしたときに「赤い行を探す」だけで遅延者を発見できるようにする。

### 方針 5: 未アサインを別セクションに分離する

未アサインは「担当者」ではなく「割り振るべきタスク群」であるため、担当者リストの下部に折りたたみ可能な別セクションとして分離する。これにより負荷集計の分母がブレなくなる。

### 方針 6: ソート順を運用目的に合わせる

デフォルトの並び順を以下の優先度で変更する。

1. 遅延あり（`delayedCount > 0`）
2. 過負荷（`loadRate > 100`）
3. 通常（`loadRate 30–100`）
4. 空き多い（`loadRate < 30`）
5. 同カテゴリ内は `delayedCount DESC` → `loadRate DESC` → 名前昇順

---

## 4. 画面構成の変更

### 現行

```
[チームサマリーなし]

[担当者名 | 進行中 | 遅延 | 今週終了 | レビュー | 種別]
[ガントヘッダー]
担当者A   |  2  |  0  |  1  |  0  | 計画(グレー行)  ← 計画レーン
                                   | 実績(白行)     ← 実績レーン
担当者B   |  ...                   | 計画
                                   | 実績
[未アサイン行（担当者と同列）]
```

### 改修後

```
[チームサマリーバー: 平均負荷 | 遅延人数 | 空き>5日 | 過負荷人数]

[担当者名 | 負荷% | 進行中 | 遅延 | 完了]
[ガントヘッダー]
担当者A   | 82%  |  2  |  0  |  2  | [重ねたバー×n本] ← 1レーン
担当者B   | 118% |  3  |  0  |  1  | [重ねたバー×n本]
担当者C   | 65%  |  1  |  1  |  0  | [重ねたバー] ← 遅延あり: 行に薄赤

━━ 未アサイン（タスク n件）▼ ━━━━━━━━━━━━━━━━
未アサイン             | [タスクバー群]
```

---

## 5. コンポーネント別 変更内容

### 5.1 `useResourceData.ts`

#### 変更点

**`ResourceRow` インターフェースの変更**

```typescript
// 追加
loadRate: number;          // 0–200+ (%)

// 変更: plannedTracks + actualTracks → overlaidTracks に統合
overlaidTracks: ResourceSubtask[][];  // 計画+実績の外包を使ったパッキング

// 削除（overlaidTracksで代替）
// tracks: ResourceSubtask[][];
// plannedTracks: ResourceSubtask[][];
// actualTracks: ResourceSubtask[][];

// 追加（ステータス数表示の変更）
completedCount: number;    // 今週終了・レビュー待ちは削除し、完了件数に差し替え
```

**削除するフィールド**
- `endingThisWeekCount` — 今週終了は負荷コンテキストで重要度が低い。削除してリストを簡潔にする。
- `reviewWaitingCount` — 同上。

**`loadRate` の計算仕様**

```
表示期間（ganttRange.start_date ～ ganttRange.end_date）内の:

  稼働可能日数 = 表示期間の暦日数 − 土曜日数 − 日曜日数 − 祝日数

  担当者の計画工数日数 =
    Σ (各サブタスクの planned_start_date ～ planned_end_date のうち
       表示期間内かつ稼働日（非土日・非祝日）の日数)
    ※ 並行タスクは重複加算する（= 過負荷を正しく 100%超で表現するため）
    ※ Removed ステータスのサブタスクは除外

  loadRate = 計画工数日数 / 稼働可能日数 × 100
```

**引数の追加**

```typescript
// 現行
useResourceData(projects, initialData, todayStr)

// 改修後
useResourceData(projects, initialData, todayStr, ganttRange?)
// ganttRange が null の場合は loadRate = 0 で返す
```

**`overlaidTracks` のパッキング仕様**

各サブタスクの「外包範囲」= `min(planned_start, actual_start)` ～ `max(planned_end, actual_end)` を使って重複判定・トラックパッキングを行う。既存の `packTracks` 関数を流用し、 bounds 関数だけ差し替える。

**ソート順変更**

```typescript
// 優先度 1: 遅延あり（delayedCount > 0）
// 優先度 2: 過負荷（loadRate > 100）
// 優先度 3: 通常
// 優先度 4: 空き多い（loadRate < 30）
// 同カテゴリ内: delayedCount DESC, loadRate DESC, member_name ASC
```

---

### 5.2 `ResourceList.tsx`

#### 変更点

**ヘッダー列の変更**

| 現行 | 改修後 |
|------|--------|
| 担当者名 | 担当者名（幅拡張） |
| 進行中（w-12） | 負荷%（w-16）← 新規 |
| 遅延（w-12） | 進行中（w-10） |
| 今週終了（w-12） | 遅延（w-10） |
| レビュー（w-12） | 完了（w-10） |
| 種別（sticky right, 52px） | **廃止** |

**行の変更**

- `getResourceRowHeight` を `overlaidTracks` ベースに変更
  ```typescript
  const OVERLAID_TRACK_HEIGHT = 36;
  const OVERLAID_STACKED_HEIGHT = 26;
  const getRowHeight = (row: ResourceRow) =>
    Math.max(1, row.overlaidTracks.length) *
    (row.overlaidTracks.length > 1 ? OVERLAID_STACKED_HEIGHT : OVERLAID_TRACK_HEIGHT);
  ```
- 遅延担当者（`row.delayedCount > 0`）の行に `bg-rose-50/40 dark:bg-rose-950/20` を適用
- 担当者名の下に「進行 N / 遅延 N / 完了 N」小バッジを配置
- 遅延ありの場合は担当者名の右に `AlertCircle` アイコン表示
- 「種別（計画/実績）」列は廃止

**負荷% 表示仕様**

```
数値: 18px, font-medium
カラー:
  loadRate ≦ 30   : text-slate-400 (グレー)
  loadRate ≦ 99   : text-emerald-600 dark:text-emerald-400 (グリーン)
  loadRate ≦ 120  : text-amber-600 dark:text-amber-400 (アンバー)
  loadRate > 120   : text-rose-600 dark:text-rose-400 (レッド)

プログレスバー（4px height, border-radius 2px）:
  バー幅 = min(loadRate, 100)%（100%でクランプして見た目を維持）
```

---

### 5.3 `ResourceGantt.tsx`

#### 変更点

**レーン構造の変更**（最大の変更点）

現行の「計画レーン（上）+ 実績レーン（下）」を廃止し、担当者ごとに **1本の overlaid レーン** に変更する。

```tsx
// 現行: 1担当者あたり 2つの div
<div className="resource-lane-planned" style={{ height: plannedLaneHeight }}>
  {/* 計画バー */}
</div>
<div className="resource-lane-actual" style={{ height: actualLaneHeight }}>
  {/* 実績バー */}
</div>

// 改修後: 1担当者あたり 1つの div
<div className="resource-lane-overlaid" style={{ height: overlaidLaneHeight }}>
  {row.overlaidTracks.map((track, trackIndex) => (
    <div key={trackIndex} style={{ height: trackHeight }}>
      {track.map((subtask) => (
        // 1. 計画バー（背景・グレー ghost）
        <GanttBar ... barVisibility="planned" overridePlannedBarColor={ghostColor} />
        // 2. 実績バー（前景・ステータス色）
        <GanttBar ... barVisibility="actual" />
      ))}
    </div>
  ))}
</div>
```

**計画バー（ghost）のスタイル**

- `overridePlannedBarColor` に `rgba(180, 180, 170, 0.35)` を渡す（ライト）/ `rgba(100, 116, 139, 0.3)`（ダーク）
- `colorByTask=true` の場合は担当者色の 30% 透過
- ラベル（タスク名）は実績バーのみに表示。計画 ghost バーはラベルなし

**遅延バーのスタイル**

実績 `actual_end_date > planned_end_date` かつ未完了 → 実績バーが計画バーを突き抜ける形で自然に描画される。追加で実績バーの色を `rose-500` でオーバーライドする条件を `GanttBar` の props として渡す（`isOverdue?: boolean`）。

**削除する機能**

- `renderHeatmap` は `showResourceOverlapHighlight` が `false` の場合に加え、1レーン化で意味が変わるため **廃止**。代わりに `loadRate` で負荷を定量表示する。
- `renderUnplannedHighlights` は維持するが、default ON に変更する（設定トグルは削除）。

**`GanttBar` への追加 props**

```typescript
isOverdue?: boolean;  // 遅延時の実績バーを赤でオーバーライドするフラグ
```

---

### 5.4 新規: `ResourceSummaryBar.tsx`

担当者ビューの上部に常設するチームサマリーコンポーネント。

```typescript
interface ResourceSummaryBarProps {
  data: ResourceRow[];
  loadRateThreshold?: number; // 過負荷判定閾値, default: 100
  idleThresholdDays?: number; // 空き日数閾値, default: 5
}
```

**表示項目**

| カード | 色 | 内容 |
|-------|-----|------|
| 平均負荷率 | 中立 | data 全体の loadRate の平均値（%） |
| 遅延担当者 | 赤 | delayedCount > 0 の担当者数 |
| 空き > N日 | アンバー | `(1 - loadRate/100) * 稼働日数 > idleThresholdDays` の担当者数 |
| 過負荷 | アンバー | loadRate > loadRateThreshold の担当者数 |

---

### 5.5 `ResourceBoard.tsx`

- `useResourceData` への `dynamicGanttRange` 引数を追加
- `ResourceSummaryBar` を `ResourceList`/`ResourceGantt` の上部に追加
- 未アサイン行の分離: `data` を `assigned` / `unassigned` に分割して渡す

---

### 5.6 `SettingsDropdown.tsx`

**削除する設定項目（担当者ビューセクション）**

| 項目 | 理由 |
|------|------|
| タスク種別を表示 | 1レーン化で縦スペースが削減されるため常時表示でも圧迫しない。コンテキストメニュー or ツールチップに移動 |
| 未計画期間をハイライト | デフォルト ON とし、トグルを廃止 |
| タスクの重複をハイライト | `loadRate` 列に機能が置き換わるため廃止 |
| バーをタスクごとに色分け | 維持（担当者ビュー設定として残す） |

---

## 6. 型定義の変更サマリー

### `ResourceRow`（`useResourceData.ts`）

```typescript
// Before
export interface ResourceRow {
  assignee: MstMember | null;
  subtasks: ResourceSubtask[];
  tracks: ResourceSubtask[][];
  plannedTracks: ResourceSubtask[][];
  actualTracks: ResourceSubtask[][];
  inProgressCount: number;
  delayedCount: number;
  endingThisWeekCount: number;
  reviewWaitingCount: number;
}

// After
export interface ResourceRow {
  assignee: MstMember | null;
  subtasks: ResourceSubtask[];
  overlaidTracks: ResourceSubtask[][];   // 追加（plannedTracks/actualTracks を統合）
  loadRate: number;                      // 追加
  inProgressCount: number;
  delayedCount: number;
  completedCount: number;                // 追加（endingThisWeekCount を置き換え）
  // 削除: tracks, plannedTracks, actualTracks, endingThisWeekCount, reviewWaitingCount
}
```

---

## 7. 実装ステップ

独立性の高い順に実施し、各ステップで動作確認する。

| Step | 作業内容 | 変更ファイル |
|------|----------|-------------|
| 1 | `ResourceRow` に `overlaidTracks` と `completedCount` を追加。`loadRate` は仮値（0）で追加。既存の `plannedTracks`/`actualTracks` は残して動作を壊さない | `useResourceData.ts` |
| 2 | `ResourceGantt` をレーン1本化に変更。計画バーを ghost スタイルで overlay 描画 | `ResourceGantt.tsx` |
| 3 | `ResourceList` のヘッダー・行を新仕様に変更（負荷%列追加・種別列削除） | `ResourceList.tsx` |
| 4 | `loadRate` の計算ロジックを実装。`useResourceData` に `ganttRange` 引数を追加 | `useResourceData.ts`, `ResourceBoard.tsx` |
| 5 | ソート順を新仕様（遅延 → 過負荷 → 通常 → 空き）に変更 | `useResourceData.ts` |
| 6 | `ResourceSummaryBar` を新規作成し、`ResourceBoard` に組み込む | `ResourceSummaryBar.tsx`, `ResourceBoard.tsx` |
| 7 | 未アサインを別セクションに分離 | `ResourceBoard.tsx`, `ResourceList.tsx`, `ResourceGantt.tsx` |
| 8 | `SettingsDropdown` から廃止設定項目を削除 | `SettingsDropdown.tsx`, `FilterPanelTypes.ts`, `MainBoardContent.tsx` |
| 9 | 旧フィールド（`plannedTracks`/`actualTracks` 等）を `ResourceRow` から削除してリファクタリング | 全 Resource 系ファイル |

---

## 8. 検討事項・スコープ外

以下は今回のスコープ外とするが、将来的な検討価値がある。

| 項目 | 概要 |
|------|------|
| ヒートマップモード | ガントバーをやめ、日付×担当者の濃淡マスで負荷を見るモード。用途によって切り替え可能にする |
| 期間プリセット | 今週/今月/四半期の表示期間切り替え |
| `isOverdue` の GanttBar 対応 | 遅延時の実績バーを赤でオーバーライドするフラグの追加（Step 2 で `overrideActualBarColor` を使って暫定対応も可） |
| loadRate の精度向上 | 現計画では暦ベースで土日・祝日を除外するが、将来的には個人の休暇情報を加味したい |
