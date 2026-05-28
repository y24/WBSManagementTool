import { InitialData } from '../types';

export interface LoadRateThresholds {
  criticalLow: number;
  warningLow: number;
  normalHigh: number;
  warningHigh: number;
  overload: number;
}

export type LoadRateThresholdInputs = Record<keyof LoadRateThresholds, string>;

export interface ScheduleVarianceThresholds {
  normal: number;
  warning: number;
  critical: number;
}

export type ScheduleVarianceThresholdInputs = Record<keyof ScheduleVarianceThresholds, string>;

export const defaultLoadRateThresholds: LoadRateThresholds = {
  criticalLow: 30,
  warningLow: 70,
  normalHigh: 120,
  warningHigh: 150,
  overload: 200,
};

export const defaultScheduleVarianceThresholds: ScheduleVarianceThresholds = {
  normal: 10,
  warning: 20,
  critical: 40,
};

const parseThreshold = (value: string | null | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parsePositiveThreshold = (value: string | null | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getLoadRateThresholds = (initialData: InitialData | null | undefined): LoadRateThresholds => ({
  criticalLow: parseThreshold(initialData?.load_rate_critical_low, defaultLoadRateThresholds.criticalLow),
  warningLow: parseThreshold(initialData?.load_rate_warning_low, defaultLoadRateThresholds.warningLow),
  normalHigh: parseThreshold(initialData?.load_rate_normal_high, defaultLoadRateThresholds.normalHigh),
  warningHigh: parseThreshold(initialData?.load_rate_warning_high, defaultLoadRateThresholds.warningHigh),
  overload: parseThreshold(initialData?.load_rate_overload, defaultLoadRateThresholds.overload),
});

export const getScheduleVarianceThresholds = (
  initialData: InitialData | null | undefined
): ScheduleVarianceThresholds => ({
  normal: parsePositiveThreshold(initialData?.schedule_variance_normal, defaultScheduleVarianceThresholds.normal),
  warning: parsePositiveThreshold(initialData?.schedule_variance_warning, defaultScheduleVarianceThresholds.warning),
  critical: parsePositiveThreshold(initialData?.schedule_variance_critical, defaultScheduleVarianceThresholds.critical),
});

export const toLoadRateThresholdInputs = (thresholds: LoadRateThresholds): LoadRateThresholdInputs => ({
  criticalLow: String(thresholds.criticalLow),
  warningLow: String(thresholds.warningLow),
  normalHigh: String(thresholds.normalHigh),
  warningHigh: String(thresholds.warningHigh),
  overload: String(thresholds.overload),
});

export const toScheduleVarianceThresholdInputs = (
  thresholds: ScheduleVarianceThresholds
): ScheduleVarianceThresholdInputs => ({
  normal: String(thresholds.normal),
  warning: String(thresholds.warning),
  critical: String(thresholds.critical),
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

export const parseScheduleVarianceThresholdInputs = (
  inputs: ScheduleVarianceThresholdInputs
): ScheduleVarianceThresholds | null => {
  const entries = Object.entries(inputs) as [keyof ScheduleVarianceThresholds, string][];
  if (entries.some(([, value]) => value.trim() === '')) {
    return null;
  }

  const parsed = entries.map(([key, value]) => [key, Number(value)] as const);

  if (parsed.some(([, value]) => !Number.isFinite(value) || value < 0)) {
    return null;
  }

  return Object.fromEntries(parsed) as unknown as ScheduleVarianceThresholds;
};

export const isLoadRateThresholdsValid = (thresholds: LoadRateThresholds): boolean =>
  thresholds.criticalLow >= 0 &&
  thresholds.criticalLow < thresholds.warningLow &&
  thresholds.warningLow < thresholds.normalHigh &&
  thresholds.normalHigh < thresholds.warningHigh &&
  thresholds.warningHigh < thresholds.overload;

export const isScheduleVarianceThresholdsValid = (thresholds: ScheduleVarianceThresholds): boolean =>
  thresholds.normal > 0 &&
  thresholds.normal < thresholds.warning &&
  thresholds.warning < thresholds.critical;

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

export const getScheduleVarianceTextColor = (
  variancePt: number | null,
  thresholds: ScheduleVarianceThresholds
): string => {
  if (variancePt === null) return 'text-slate-300 dark:text-slate-600';
  const abs = Math.abs(variancePt);
  if (abs === 0) return 'text-emerald-600 dark:text-emerald-400';
  if (abs <= thresholds.normal) return 'text-emerald-600 dark:text-emerald-400';
  if (abs <= thresholds.warning) return 'text-slate-700 dark:text-slate-200';
  if (abs <= thresholds.critical) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
};

export const getScheduleVarianceBadgeClasses = (
  variancePt: number | null,
  thresholds: ScheduleVarianceThresholds
): string => {
  if (variancePt === null) return 'bg-slate-100 dark:bg-slate-800';
  const abs = Math.abs(variancePt);
  if (abs <= thresholds.normal) return 'bg-emerald-50 dark:bg-emerald-950/25';
  if (abs <= thresholds.warning) return 'bg-slate-100 dark:bg-slate-800';
  if (abs <= thresholds.critical) return 'bg-amber-50 dark:bg-amber-950/25';
  return 'bg-rose-50 dark:bg-rose-950/25';
};
