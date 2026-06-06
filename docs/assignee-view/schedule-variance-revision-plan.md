# 担当者ビュー 予実差（pt）ロジック 改修計画

## 1. 背景と目的

担当者ビューの一覧には「予実差」列があり、`±N pt` で表示される。設計上の目的は

> **今日より前のスコープ期間内で、予定（計画）と実績がどれだけ乖離しているか**を一目で把握する

ことである。しかし運用上、**ガントの計画バー（グレー）が大きくはみ出して明らかに遅れているメンバーでも `-6pt` 程度のほぼ正常値になる**など、見た目の乖離感と数字が一致しないという指摘がある。

例（報告事例）:

- 予定稼働 **195%** / 実績稼働 **80%**
- グレーの計画バーが実績よりかなり長くはみ出している（=計画に対して実作業が追いついていない）
- それでも予実差は **-6pt**（ほぼ問題なし表示）

本書では現行ロジックをコードベースで確認し、乖離感と数字がずれる原因を考察した上で、あるべきロジックと改修方針をまとめる。

対象ファイル:

- 計算: [`frontend/src/pages/mainboard/useResourceData.ts`](../../frontend/src/pages/mainboard/useResourceData.ts)
- 表示: [`frontend/src/components/ResourceView/ResourceList.tsx`](../../frontend/src/components/ResourceView/ResourceList.tsx)
- 閾値・色: [`frontend/src/utils/loadRateThresholds.ts`](../../frontend/src/utils/loadRateThresholds.ts)
- スコープ算出: [`frontend/src/components/ResourceView/ResourceBoard.tsx`](../../frontend/src/components/ResourceView/ResourceBoard.tsx)

---

## 2. 現状ロジックの要約

予実差 `ResourceRow.scheduleVariancePt`（[L19](../../frontend/src/pages/mainboard/useResourceData.ts#L19)）は、サブタスクごとの **「実績進捗率 − あるべき進捗率」を計画工数で加重平均** した値である（[L544-568](../../frontend/src/pages/mainboard/useResourceData.ts#L544)）。

### 2.1 スコープ期間

`resourceLoadScope`（1w/2w/1m/2m/3m）から **左右対称** に算出される（[`ResourceBoard.tsx` L154-164](../../frontend/src/components/ResourceView/ResourceBoard.tsx#L154)）。予実差の判定対象はこの **両側** の合算スコープである（[L473-474](../../frontend/src/pages/mainboard/useResourceData.ts#L473)）。

```
combinedScopeStartDate = actualLoadScopeStartDate  = today − N   （過去側）
combinedScopeEndDate   = loadScopeEndDate          = today + N   （未来側）
```

### 2.2 対象サブタスクの判定（`inScope`）

[L546-559](../../frontend/src/pages/mainboard/useResourceData.ts#L546):

```
各サブタスク {
    Removed は除外
    inScope = 計画期間[planned_start, planned_end] が [today−N, today+N] と重なる
           OR 実績期間[actual_start, displayActualEnd] が [today−N, today+N] と重なる
    !inScope なら除外

    expectedProgress = getExpectedProgressPercent(subtask)   // null ならスキップ
    actualProgress   = progress_percent ?? 0
    weight           = getVarianceWeight(subtask)
    weightedVariance += (actualProgress − expectedProgress) × weight
    totalWeight      += weight
}
scheduleVariancePt = round(weightedVariance / totalWeight)   // 重みゼロなら null
```

### 2.3 あるべき進捗率 `getExpectedProgressPercent`（[L489-503](../../frontend/src/pages/mainboard/useResourceData.ts#L489)）

```
計画日が無ければ null
today < planned_start         → 0     （まだ始まっていない）
today ≥ planned_end           → 100   （終わっているはず）
それ以外（計画期間の途中）     → 経過営業日 / 全営業日 × 100
```

### 2.4 加重ウェイト `getVarianceWeight`（[L505-518](../../frontend/src/pages/mainboard/useResourceData.ts#L505)）

優先順位: `planned_effort_days` または `work_days` → 計画スパンの営業日数 → `actual_effort_days` → 1。
**いずれも「タスク全体の規模」であり、今日までに消化されているべき分量ではない。**

### 2.5 表示と閾値

- 表示: [`ResourceList.tsx` L258-267](../../frontend/src/components/ResourceView/ResourceList.tsx#L258)。`null` は `—`、それ以外は `±N pt`。
- 色: `getScheduleVarianceTextColor`（[`loadRateThresholds.ts` L139-148](../../frontend/src/utils/loadRateThresholds.ts#L139)）は **`critical`（既定 40pt）以上のときだけ** 赤、それ以外は灰色。`normal(10)` / `warning(20)` はテキスト色では未使用（バッジ色 `getScheduleVarianceBadgeClasses` でのみ使用）。

---

## 3. 実感と合わない原因の考察

報告事例（予定 195% / 実績 80% なのに −6pt）は、複数の希釈・相殺要因が重なって発生している。

| # | 問題 | 影響 |
|---|------|------|
| **V-1** | **未来側（未着手）の計画タスクが分母を希釈する（主因）** | スコープが `[today−N, today+N]` と未来まで含むため、**まだ始まっていない計画タスク**（`today < planned_start`）が `inScope` に入る。これらは `expectedProgress=0`・`actualProgress=0` で **寄与は 0** だが、**計画工数ぶんの重みは満額** 加算される。予定稼働 195% のように未来に大量の計画があると、この「差0・重み大」が分母を支配し、過去側の本当の遅れを 0 方向へ強く引っ張る。**これが −6pt になる最大の理由。** |
| **V-2** | **重みが「今日までに消化されているべき分量」ではなく「タスク全体規模」** | 長期間に渡る進行中タスクは、まだ着手して間もなくても **計画工数の満額** が重みになる。あるべき進捗が小さい（=1ポイントあたりの差が小さい）ため、短期で大きく遅れているタスクが希釈されて埋もれる。重みは「今日までに終わっているべき工数（経過分）」であるべき。 |
| **V-3** | **`progress_percent` を見ており、ガントの見た目（日付・工数）と別物** | ユーザーが見ている「グレーのはみ出し」は **計画スパン（日付・工数）と実働セグメントの差** で決まる。一方この指標は別フィールドの **進捗率** を使う。両者は連動しておらず、進捗率が未入力なら `?? 0`、逆に甘めに入っていれば実態より良く見える。**目で見る乖離と数値が別の量を測っている。** |
| **V-4** | **完了済み・期限超過タスクが痕跡を残さない** | `today ≥ planned_end` で `expectedProgress=100`。Done（進捗100）なら差 0。**どれだけ遅れて終わったか**は反映されず、さらにこれら「差0」タスクが分母を希釈する。 |
| **V-5** | **加重平均なので「進んでいる」タスクと「遅れている」タスクが相殺する** | 目的は「乖離度合い（=どれだけズレているか）」だが、ネットの加重平均では `+` と `−` が打ち消し合う。前倒し1件で遅延1件が相殺され 0 付近になりうる。乖離を見たいのに相殺で隠れる。 |
| **V-6** | **計画のみ・実績のみタスクの非対称** | 計画日が無いタスクは `expectedProgress=null` で **完全に除外**（[L559](../../frontend/src/pages/mainboard/useResourceData.ts#L559)）。計画なしで実作業しているタスクは予実差に寄与しない。 |
| **V-7** | **閾値の実効性が低い** | テキスト色は `critical(40pt)` 以上でしか変化しない（[L145-147](../../frontend/src/utils/loadRateThresholds.ts#L145)）。V-1〜V-2 の希釈で値が 0 付近に潰れるため、40pt に到達せず **ほぼ常に灰色**。異常検知としてほとんど機能していない。 |

### 3.1 報告事例の数値的説明

未来側に大量の計画（予定 195%）→ V-1 で「差0・重み大」のタスクが分母の多数を占める。過去側の本当に遅れているタスク（グレーがはみ出している分）は V-2 で相対的に軽い重みになり、さらに V-5 で前倒し分と相殺。結果として加重平均は 0 付近（−6pt）に収束する。**「乖離が小さい」のではなく「乖離が希釈・相殺されて見えなくなっている」。**

---

## 4. あるべきロジックの方針

ユーザーの定義に立ち返る:

> **今日より前のスコープ期間内**で、**予定と実績の乖離度合い**を見る

ここから2つの設計原則を導く。

1. **未来側を判定対象から外す。** 対象ウィンドウを過去側 `[today−N, today]`（=実績スコープと同じ）に限定し、まだ来ていない計画は乖離の分母に入れない（V-1 解消）。
2. **「今日までに終わっているべき量」を基準に測る。** 重み・分母は「今日時点で消化されているべき計画工数」にする（V-2 解消）。

### 4.1 推奨案 ── 工数ベースの予実差（Option B）

ガントのグレーはみ出し（=日付・工数の差）と直結させるため、`progress_percent` ではなく **既存の工数エンジンを再利用** する。予定稼働・実績稼働がすでに使っている `effortInWindow(subtask, windowStart, windowEnd, mode)`（[L380-417](../../frontend/src/pages/mainboard/useResourceData.ts#L380)）と実働セグメント（中断除外済み, [`getActualWorkSegments` L292-364](../../frontend/src/pages/mainboard/useResourceData.ts#L292)）をそのまま使う。

過去ウィンドウ `[today−N, today]` について:

```
plannedDueEffort = Σ effortInWindow(subtask, scopeStart, today, 'planned')
                   // 今日までに計画上こなされているはずの工数（グレーの“今日まで”の面積）

actualDoneEffort = Σ effortInWindow(subtask, scopeStart, today, 'actual')
                   // 実際にこなした工数（中断除外。実績稼働と同じ計算）

scheduleVariancePt = plannedDueEffort > 0
    ? round((actualDoneEffort − plannedDueEffort) / plannedDueEffort × 100)
    : null
```

- 負 = 計画より遅れている / 正 = 前倒し。
- **未来側の未着手タスクは `effortInWindow(..., today, 'planned')` が 0** になるので自然に分母から外れる（V-1 解消）。
- 分母が「今日までの計画消化量」なので、長期タスクも経過分だけが効く（V-2 解消）。
- 日付・工数ベースなのでガントのはみ出しと意味が一致する（V-3 解消）。
- 既にテスト・運用実績のある工数計算を流用できるため、新規ロジックのリスクが小さい。
- Done タスクも「過去ウィンドウで計画上こなされているはずだった工数 vs 実際の工数」で評価され、遅れの痕跡が残る（V-4 緩和）。

#### 乖離（相殺）の扱い ── V-5

「乖離度合い」を強調するなら、前倒しタスクで遅延を相殺させない指標も併せて検討する。

- **ネット差（推奨・既定）**: 上式どおり。チーム全体としての進み/遅れを表す。直感的で符号がある。
- **遅れ総量（behind-only）**: `Σ max(0, plannedDueEffort_i − actualDoneEffort_i) / Σ plannedDueEffort_i`。相殺されない「どれだけ遅れているか」専用指標。ツールチップや補助表示に向く。

第1段階はネット差のみとし、behind-only はツールチップでの補足に留めるのが安全。

### 4.2 代替案 ── 進捗ベースのまま過去限定＋経過重み（Option A・低リスク）

`progress_percent` ベースを維持しつつ、最小限の修正で V-1・V-2 だけ潰す。「pt（進捗ポイント）」という単位と既存閾値を温存できる。

```
各サブタスク {
    対象は「計画が今日までに始まっているべきもの」だけに限定:
        planned_start ≤ today（=expectedProgress > 0）かつ過去ウィンドウと重なる
    weight = elapsedPlannedWorkingDays
           = countWorkingDaysInRange(planned_start, min(today, planned_end))
           // 今日までに終わっているべき営業日数。未来タスクは 0。
    weightedVariance += (actualProgress − expectedProgress) × weight
}
scheduleVariancePt = round(weightedVariance / Σweight)
```

- 未来タスクは `weight=0` で自動的に除外（V-1 解消）。
- 重みが経過分量になる（V-2 解消）。
- ただし `progress_percent` 依存（V-3）と相殺（V-5）は残る。

### 4.3 推奨

| 観点 | Option A（進捗ベース） | Option B（工数ベース・推奨） |
|------|------|------|
| ガントの見た目との一致 | △（進捗率依存） | ◎（日付・工数で一致） |
| 既存資産の再利用 | ○ | ◎（`effortInWindow` 流用） |
| 単位・閾値の互換性 | ◎（ptのまま） | △（要再定義） |
| 実装コスト | 小 | 中 |

**Option B を本命**とし、進捗率の入力運用が不十分な現状では特に有効。閾値再定義のコストを避けたい場合は Option A を第1段階として入れ、後から B へ移行する二段構えも可。

---

## 5. 具体的な改修案（Option B）

### 5.1 計算 `useResourceData.ts`

[L544-568](../../frontend/src/pages/mainboard/useResourceData.ts#L544) の加重平均ブロックを、過去ウィンドウの工数差し引きに置き換える。

```typescript
// 過去ウィンドウ [scopeStart, today] のみを対象にする
const varianceScopeStart = actualLoadScopeStartDate ?? todayStr;

let plannedDueEffort = 0;
let actualDoneEffort = 0;
row.subtasks.forEach(subtask => {
  if (subtask.status_id === removedStatusId) return;
  plannedDueEffort += effortInWindow(subtask, varianceScopeStart, todayStr, 'planned');
  actualDoneEffort += effortInWindow(subtask, varianceScopeStart, todayStr, 'actual');
});

row.scheduleVariancePt = plannedDueEffort > 0
  ? Math.round(((actualDoneEffort - plannedDueEffort) / plannedDueEffort) * 100)
  : null;
```

- `getExpectedProgressPercent` / `getVarianceWeight` / `hasDateOverlap`（予実差用途分）と `combinedScopeStartDate/EndDate` は予実差からは不要になる。他で未使用なら削除を検討。
- `effortInWindow` の `'planned'` モードは現状 `getPlannedWorkSegments`（レビュー期間除外済み）を使う点に注意。予実差でレビュー期間を含めたい場合はモード分岐の調整が必要（要件確認）。

### 5.2 「遅れ総量」ツールチップ（任意・V-5補足）

`ResourceList.tsx` の予実差セル（[L258-267](../../frontend/src/components/ResourceView/ResourceList.tsx#L258)）に、`title` もしくはツールチップで以下を補足表示すると「相殺で隠れる」問題を緩和できる。

- 計画消化予定: `plannedDueEffort` 人日
- 実績消化: `actualDoneEffort` 人日
- 遅れているタスク件数 / behind-only 値

### 5.3 閾値・表示の再定義

Option B では単位が「pt（進捗）」から「計画消化量に対する達成率の差（%ポイント）」に変わる。

- ラベル/ツールチップ文言を更新（[`ResourceList.tsx` L131](../../frontend/src/components/ResourceView/ResourceList.tsx#L131), [L261](../../frontend/src/components/ResourceView/ResourceList.tsx#L261)）。
  - 現行: 「スコープ内サブタスクごとの今日時点の実績進捗 − 計画進捗」
  - 案: 「今日までの実績工数 − 計画消化予定工数（計画比）」
- `ScheduleVarianceThresholds`（normal/warning/critical）を新しいスケールで見直す。
- `getScheduleVarianceTextColor`（[L139-148](../../frontend/src/utils/loadRateThresholds.ts#L139)）が `critical` しか使っていない点（V-7）も合わせて修正し、warning から色が変わるようにする。

### 5.4 影響範囲

| 項目 | 変更 |
|------|------|
| `useResourceData.ts` | 予実差計算ブロック差し替え。未使用化したヘルパー整理 |
| `ResourceList.tsx` | 列ヘッダ/セルの説明文言、（任意で）ツールチップ |
| `loadRateThresholds.ts` | 閾値スケール再定義、テキスト色ロジック修正 |
| ソート | `scheduleVariancePt` のソート（`ResourceBoard` の `compareRowsBySort`）は値の意味が変わるだけで動作互換 |

### 5.5 段階的導入と検証

1. **第1段階**: 計算ロジックのみ Option B に差し替え（または Option A）。報告事例（予定195%/実績80%）で値が実感に近い大きな負値になることを確認。
2. **第2段階**: 閾値・色・文言の再定義。
3. **第3段階（任意）**: behind-only 補足表示。

#### 検証観点（テストケース）

| ケース | 期待 |
|--------|------|
| 過去に大幅遅延 + 未来に大量計画（報告事例） | 過去の遅れが希釈されず、明確な負値 |
| 計画どおり消化 | 0 付近 |
| 前倒し（実績が計画を上回る） | 正値 |
| 完了済みだが遅れて終了 | 過去ウィンドウ内で負値が残る |
| 未来計画のみ・過去実績なし | `plannedDueEffort=0` → `null`（—表示） |
| 中断のあるタスク | 中断分が実績から除外される（実績稼働と整合） |

---

## 6. まとめ

現行の予実差は **「進捗率ベースの加重平均」かつ「未来側を含む左右対称スコープ」** であるため、

- 未着手の未来計画が「差0・重み大」で分母を希釈（V-1）
- 重みがタスク全体規模で経過分を反映しない（V-2）
- 進捗率がガントの見た目（日付・工数）と乖離（V-3）
- 前倒しと遅延が相殺（V-5）

が重なり、明確に遅れているメンバーでも 0 付近（−6pt）に潰れる。

**対象を過去ウィンドウ `[today−N, today]` に限定し、既存の工数エンジンで「今日までの計画消化予定工数 vs 実績工数」を比較する（Option B）** ことで、ガントのグレーはみ出しと意味が一致し、実感に沿った乖離指標になる。
