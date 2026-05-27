import { InitialData } from '../types';

export interface LoadRateThresholds {
  criticalLow: number;
  warningLow: number;
  normalHigh: number;
  warningHigh: number;
  overload: number;
}

export type LoadRateThresholdInputs = Record<keyof LoadRateThresholds, string>;

export const defaultLoadRateThresholds: LoadRateThresholds = {
  criticalLow: 30,
  warningLow: 70,
  normalHigh: 120,
  warningHigh: 150,
  overload: 200,
};

const parseThreshold = (value: string | null | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getLoadRateThresholds = (initialData: InitialData | null | undefined): LoadRateThresholds => ({
  criticalLow: parseThreshold(initialData?.load_rate_critical_low, defaultLoadRateThresholds.criticalLow),
  warningLow: parseThreshold(initialData?.load_rate_warning_low, defaultLoadRateThresholds.warningLow),
  normalHigh: parseThreshold(initialData?.load_rate_normal_high, defaultLoadRateThresholds.normalHigh),
  warningHigh: parseThreshold(initialData?.load_rate_warning_high, defaultLoadRateThresholds.warningHigh),
  overload: parseThreshold(initialData?.load_rate_overload, defaultLoadRateThresholds.overload),
});

export const toLoadRateThresholdInputs = (thresholds: LoadRateThresholds): LoadRateThresholdInputs => ({
  criticalLow: String(thresholds.criticalLow),
  warningLow: String(thresholds.warningLow),
  normalHigh: String(thresholds.normalHigh),
  warningHigh: String(thresholds.warningHigh),
  overload: String(thresholds.overload),
});

export const parseLoadRateThresholdInputs = (inputs: LoadRateThresholdInputs): LoadRateThresholds | null => {
  const entries = Object.entries(inputs) as [keyof LoadRateThresholds, string][];
  if (entries.some(([, value]) => value.trim() === '')) {
    return null;
  }

  const parsed = entries.map(([key, value]) => [key, Number(value)] as const);

  if (parsed.some(([, value]) => !Number.isFinite(value) || value < 0)) {
    return null;
  }

  return Object.fromEntries(parsed) as unknown as LoadRateThresholds;
};

export const isLoadRateThresholdsValid = (thresholds: LoadRateThresholds): boolean =>
  thresholds.criticalLow >= 0 &&
  thresholds.criticalLow < thresholds.warningLow &&
  thresholds.warningLow < thresholds.normalHigh &&
  thresholds.normalHigh < thresholds.warningHigh &&
  thresholds.warningHigh < thresholds.overload;

export const getLoadRateTextColor = (rate: number, thresholds: LoadRateThresholds): string => {
  if (rate <= 0) return 'text-slate-300 dark:text-slate-600';
  if (rate <= thresholds.criticalLow) return 'text-rose-600 dark:text-rose-400';
  if (rate <= thresholds.warningLow) return 'text-amber-500 dark:text-amber-400';
  if (rate <= thresholds.normalHigh) return 'text-emerald-600 dark:text-emerald-400';
  if (rate <= thresholds.warningHigh) return 'text-amber-500 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
};

export const getLoadRateBarColor = (rate: number, thresholds: LoadRateThresholds): string => {
  if (rate <= thresholds.criticalLow) return '#e11d48';
  if (rate <= thresholds.warningLow) return '#f59e0b';
  if (rate <= thresholds.normalHigh) return '#059669';
  if (rate <= thresholds.warningHigh) return '#f59e0b';
  return '#e11d48';
};
