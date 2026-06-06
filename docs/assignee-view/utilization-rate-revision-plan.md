# 担当者ビュー 稼働率ロジック 改修計画

## 1. 背景と目的

担当者ビューには2つの稼働率指標がある。

| 指標 | フィールド | 目的 |
|------|-----------|------|
| 予定稼働率 | `ResourceRow.loadRate` | 今日より**後**の一定期間で、サブタスクの計画がどの程度埋まっているか。アサインしすぎ／直近アサイン未定のメンバーを可視化 |
| 実績稼働率 | `ResourceRow.actualLoadRate` | 今日より**前**の一定期間で、サブタスクの実績がどの程度満たされているか。負荷の高い／仕事が少なかったメンバーを可視化 |

設計意図としては、以下は「実際は稼働していない」ものとして除外されているはずである。

- **中断期間** … 実際は手が動いていないため。
- **計画のみのサブタスクの Pending** … このままでは開始しないので、未計画と同じ。

しかし運用上、これらの数字が実態と合っていないという声がある。本書では現行ロジックをコードベースで確認し、乖離の原因を考察した上で、あるべきロジックと改修方針をまとめる。

対象ファイル: [`frontend/src/pages/mainboard/useResourceData.ts`](../../frontend/src/pages/mainboard/useResourceData.ts)

---

## 2. 現状ロジックの要約

すべての計算は `useResourceData.ts` のフロントエンドで完結している。

### 2.1 共通の前処理

- `isPlanOnlySuspendedSubtask`（[L63-69](../../frontend/src/pages/mainboard/useResourceData.ts#L63)）で **Pending / Blocked かつ「計画日あり・実績日なし」** のサブタスクを判定し、該当するものは `row.subtasks` に**一切積まない**（[L135](../../frontend/src/pages/mainboard/useResourceData.ts#L135) で early return）。
- スコープ期間は `resourceLoadScope`（1w/2w/1m/2m/3m）から左右対称に算出される（[`ResourceBoard.tsx` L154-164](../../frontend/src/components/ResourceView/ResourceBoard.tsx#L154)）。
  - 予定: `[today, today + N]`
  - 実績: `[today − N, today]`

### 2.2 予定稼働率 `loadRate`（[L326-343](../../frontend/src/pages/mainboard/useResourceData.ts#L326)）

```
availableWorkingDays = countWorkingDaysInRange(today, scopeEnd)   // 営業日（土日・祝日除外）

plannedEffortDays = Σ_subtask {
    Removed は除外
    planned_start / planned_end が無ければスキップ
    start = max(planned_start, today)
    end   = min(planned_end,   scopeEnd)
    countWorkingDaysInRange(start, end) × workloadFactor   // workload_percent/100, 既定 1.0
}

loadRate = round(plannedEffortDays / availableWorkingDays × 100)
```

### 2.3 実績稼働率 `actualLoadRate`（[L345-379](../../frontend/src/pages/mainboard/useResourceData.ts#L345)）

```
actualAvailableWorkingDays = countWorkingDaysInRange(scopeStart, today)

actualEffortDays = Σ_subtask {
    Removed は除外
    actual_start が無ければスキップ
    actualStart = actual_start
    actualEnd   = actual_end ?? today            // 未完了は今日まで
    overlap = [actualStart, actualEnd] ∩ [scopeStart, today]
    totalActualWorkingDays = countWorkingDaysInRange(actualStart, actualEnd)
    overlapWorkingDays     = countWorkingDaysInRange(overlap)

    if (actual_effort_days あり)
        actualEffortDays += actual_effort_days × (overlapWorkingDays / totalActualWorkingDays)
    else
        actualEffortDays += overlapWorkingDays × workloadFactor
}

actualLoadRate = round(actualEffortDays / actualAvailableWorkingDays × 100)
```

### 2.4 中断ロジックの所在（重要）

中断期間を実績スパンから差し引く処理は `getActualBounds`（[L181-218](../../frontend/src/pages/mainboard/useResourceData.ts#L181)）に実装されている。だが、この関数を呼んでいるのは **`getMergedBounds`（ガントのトラックパッキング = 可視化）だけ**であり、`actualLoadRate` の計算は中断を一切参照していない。

---

## 3. 実感と合わない原因の考察

### 3.1 実績稼働率の問題

| # | 問題 | 影響 |
|---|------|------|
| **A-1** | **中断期間が実績稼働率から除外されていない** | 中断分割を行う `getActualBounds` は可視化専用で、`actualLoadRate` は単純に `[actualStart, actualEnd]` の被覆営業日を数えている。設計意図「中断は稼働していないので除外」と**矛盾**。中断の多いメンバーほど過大評価される。 |
| **A-2** | **未完了タスクが `actual_end ?? today` で「今日まで毎日稼働」扱い** | 着手後に放置・停滞しているタスクが、毎営業日フル稼働として加算される。中断除外が効かないため特に悪化。 |
| **A-3** | **着手後に Pending/Blocked になったタスクが止まらない** | `isPlanOnlySuspendedSubtask` は「実績日あり」のものは除外しない（=残す）。中断レコードを持たず status だけ Pending にして止めたタスクは、`actual_end` も無ければ A-2 と同じく今日まで稼働扱いになる。 |
| **A-4** | **`actual_effort_days` の按分母数に中断日が含まれる** | `totalActualWorkingDays` が中断を含む全スパン。中断で母数が膨らみ、1日あたり工数が希釈され、スコープ内工数を過小評価する方向に歪む。A-1 と逆向きの歪みが混在し挙動が読みにくい。 |

### 3.2 予定稼働率の問題

| # | 問題 | 影響 |
|---|------|------|
| **P-1** | **完了(Done)・進行中タスクの「残作業」を区別していない** | 除外対象は Removed のみ。早期完了して `planned_end` が未来に残っている Done タスクは、未来の予定負荷として丸ごと加算される。進行中タスクも進捗に関係なく残スパン全体を負荷計上。→ 「アサインしすぎ」の判定が過大になる。 |
| **P-2** | **`planned_effort_days` を無視している** | 予定側は「計画スパンの被覆営業日」しか見ず、実績側が `actual_effort_days` を使うのと**非対称**。計画スパンが長く実工数が小さいタスク（例: 長期間に薄く張り付くレビュー）が、フルタイム稼働として過大評価される。 |
| **P-3** | **`workload_percent` 既定 100% への依存** | 実データで `workload_percent` を設定していないと、並行タスクが全て 100% 扱いになり、被覆日数が単純合算されて容易に 100% 超になる。 |

### 3.3 構造的・共通の問題

| # | 問題 | 影響 |
|---|------|------|
| **C-1** | **予定と実績で算出方式が非対称** | 予定=「スパン被覆日数のみ」、実績=「工数優先（按分）」。同じ「稼働率」という名前なのに分母・分子の作り方が違い、両者を見比べたときに直感的な整合が取れない。 |
| **C-2** | **「日数被覆率」モデルの限界** | スパンに1日でも掛かればその日を 1.0 人日として数える。低工数・長スパンタスクや並行タスクで容易に過大になり、`workload_percent`/`effort_days` で補正しない限り「予定をどれだけ詰め込んだか」ではなく「カレンダー上どれだけ日付が埋まっているか」を測ってしまう。 |
| **C-3** | **Pending と Blocked を同列で「計画のみ除外」** | 設計意図で除外対象に挙げられているのは Pending のみ。Blocked（再開予定がある一時停止）まで未計画扱いで丸ごと消すのは過剰除外の可能性。 |
| **C-4** | **分母が暦営業日のみ** | 個人の休暇・稼働率（時短勤務など）を考慮しない。中規模の歪み要因。`redesign-plan.md` でも将来課題として認識済み。 |

---

## 4. あるべきロジックの方針

### 4.1 基本コンセプトの統一

両指標を **「対象期間に割り当てられた工数（人日） ÷ 対象期間の稼働可能工数（人日）」** という同一モデルに統一する。これにより C-1・C-2 を根本解決する。

各サブタスクの「対象期間内工数」は次の手順で算出する（予定・実績共通の考え方）。

```
1. 工数源を決定（優先順位）
     明示工数（planned_effort_days / actual_effort_days）
       → なければ「稼働スパンの営業日数 × workloadFactor」
2. 稼働スパンを決定
     予定: [planned_start, planned_end]
     実績: [actual_start, actual_end] から「中断期間」を差し引いた実働セグメント群
3. 工数をスパンの実働営業日に均等配分
4. 対象ウィンドウ（予定=[today, scopeEnd] / 実績=[scopeStart, today]）と
     重なる営業日ぶんの工数だけを合算
```

この共通処理を `effortInWindow(subtask, windowStart, windowEnd, mode)` のような **共有ヘルパー** に切り出し、予定・実績の両方から呼ぶ。

### 4.2 実績稼働率の修正

- **中断の除外（A-1 解消）**: スパンを `getActualBounds` 由来の実働セグメント群に置き換え、中断日を分子・分母（按分母数）の双方から除外する（A-4 も同時に解消）。
- **未完了・停滞の扱い（A-2 / A-3 解消）**:
  - 着手後に Pending/Blocked かつ `actual_end` 無しのタスクは、**最終実働日（最後の中断開始日 or 最終 resumption 以降の停止点）で打ち切る**。今日まで稼働とみなさない。
  - 通常の進行中タスクは従来どおり `actual_end ?? today` を上限とするが、中断除外が効くため放置区間は自動的に落ちる。
- **明示工数の按分（A-4 解消）**: `actual_effort_days` を「実働営業日数（中断除外後）」で割って配分する。

### 4.3 予定稼働率の修正

- **残作業ベース化（P-1 解消）**:
  - Done は予定負荷から**除外**（残作業ゼロ）。
  - 進行中タスクは「未来側に残るスパン」を負荷とする。`start = max(planned_start, today)` で既に未来側のみを見ているため、現行の clip はおおむね残期間を表すが、`progress_percent` を用いて `残工数 = 工数 × (1 − progress/100)` で割り引く案も検討（4.5 参照）。
- **明示工数の利用（P-2 / C-1 解消）**: `planned_effort_days` があればそれを優先し、計画スパンの営業日に配分してウィンドウ重なりぶんを合算。実績側と対称にする。
- **Pending の扱い**: 現行どおり「計画のみ Pending」は除外を維持。ただし C-3 のとおり **Blocked は除外対象から外す**ことを検討（設計意図は Pending のみ）。

### 4.4 分母（稼働可能工数）

- 当面は現行の暦営業日（土日・祝日除外）を踏襲する。
- 将来的に個人の休暇・稼働率を反映できるよう、分母計算も `availableCapacity(member, windowStart, windowEnd)` としてヘルパー化しておく（C-4、スコープ外だが拡張点を用意）。

### 4.5 進捗割り引きの是非（要検討）

予定側で進捗割り引き（`× (1 − progress/100)`）を入れると「残りどれだけ予定が詰まっているか」をより正確に表せるが、進捗と日付の整合が崩れているデータ（進捗100%だが planned_end が未来 等）では直感に反する場合がある。
**第1段階では Done 除外のみ**を入れ、進捗割り引きは効果を見てから判断するのが安全。

---

## 5. 具体的な改修案

### 5.1 共有ヘルパーの新設

```typescript
// 実働セグメント（中断除外後）を返す。予定モードは中断を考慮しない。
function getWorkSegments(
  subtask: ResourceSubtask,
  mode: 'planned' | 'actual'
): DateBounds[];

// 対象ウィンドウ内に配分される工数（人日）を返す
function effortInWindow(
  subtask: ResourceSubtask,
  windowStart: string,
  windowEnd: string,
  mode: 'planned' | 'actual',
  holidaySet: Set<string>
): number {
  const segments = getWorkSegments(subtask, mode);              // 実働営業日セグメント
  const totalWorkingDays = Σ countWorkingDaysInRange(segments); // 中断除外後
  if (totalWorkingDays <= 0) return 0;

  const explicitEffort = mode === 'planned'
    ? subtask.planned_effort_days
    : subtask.actual_effort_days;

  const overlapWorkingDays = Σ countWorkingDaysInRange(seg ∩ window);
  if (overlapWorkingDays <= 0) return 0;

  return (explicitEffort != null && Number.isFinite(explicitEffort))
    ? explicitEffort * (overlapWorkingDays / totalWorkingDays)
    : overlapWorkingDays * getWorkloadFactor(subtask);
}
```

- `getWorkSegments('actual')` は既存 `getActualBounds` を流用（可視化と計算でロジックを共通化）。
- `getWorkSegments('planned')` は `[planned_start, planned_end]` を返すだけ（中断は実績概念のため）。

### 5.2 予定稼働率の置き換え

```typescript
if (availableWorkingDays > 0 && loadScopeEndDate) {
  let plannedEffortDays = 0;
  row.subtasks.forEach(subtask => {
    if (subtask.status_id === removedStatusId) return;
    if (doneStatusId !== null && subtask.status_id === doneStatusId) return; // ★ Done 除外
    plannedEffortDays += effortInWindow(subtask, todayStr, loadScopeEndDate, 'planned', holidaySet);
  });
  row.loadRate = Math.round((plannedEffortDays / availableWorkingDays) * 100);
}
```

### 5.3 実績稼働率の置き換え

```typescript
if (actualAvailableWorkingDays > 0 && actualLoadScopeStartDate) {
  let actualEffortDays = 0;
  row.subtasks.forEach(subtask => {
    if (subtask.status_id === removedStatusId) return;
    if (!subtask.actual_start_date) return;
    // getWorkSegments('actual') 内で中断除外＆停滞打ち切りを実施
    actualEffortDays += effortInWindow(subtask, actualLoadScopeStartDate, todayStr, 'actual', holidaySet);
  });
  row.actualLoadRate = Math.round((actualEffortDays / actualAvailableWorkingDays) * 100);
}
```

### 5.4 Blocked の扱い見直し（C-3）

`suspendedStatusIds` を Pending のみにする、または `isPlanOnlySuspendedSubtask` を Pending 限定にする。Blocked は計画として残す。
※ 運用上 Blocked を「実質中断」として扱っているなら現状維持。**ヒアリングで決定**。

---

## 6. 段階的実装ステップ

各ステップ後に担当者ビューで数値を目視確認する。

| Step | 内容 | 主な変更 |
|------|------|---------|
| 1 | `effortInWindow` / `getWorkSegments` ヘルパーを追加（既存 `getActualBounds` を流用） | `useResourceData.ts` |
| 2 | **実績稼働率**を `effortInWindow('actual')` に置換 → 中断除外（A-1/A-4）を解消 | `useResourceData.ts` |
| 3 | 着手後 Pending/Blocked・停滞タスクの実働打ち切り（A-2/A-3） | `getWorkSegments`/`useResourceData.ts` |
| 4 | **予定稼働率**を `effortInWindow('planned')` に置換＋Done 除外（P-1/P-2、C-1 で対称化） | `useResourceData.ts` |
| 5 | Blocked の除外可否を確定し反映（C-3） | `useResourceData.ts` |
| 6 | （任意）予定側の進捗割り引きを評価して採否決定（4.5） | `useResourceData.ts` |

---

## 7. 検討事項・スコープ外

| 項目 | 概要 |
|------|------|
| 個人別キャパシティ | 分母に休暇・稼働率を反映（C-4）。`availableCapacity` ヘルパーで拡張点のみ用意し、本実装は将来 |
| 進捗割り引き | 予定側の `× (1 − progress/100)`。データ品質次第で直感に反するため段階導入（4.5） |
| Blocked の意味付け | 運用での Blocked の使われ方をヒアリングして除外可否を確定（C-3 / Step 5） |
| しきい値の再調整 | ロジック変更で数値の出方が変わるため、`loadRateThresholds`（[`AssigneeViewSettingsSection.tsx`](../../frontend/src/components/masterSettings/AssigneeViewSettingsSection.tsx)）の既定値を再点検 |
