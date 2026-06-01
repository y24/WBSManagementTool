type ActualDateRangeSource = {
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  review_start_date?: string | null;
};

export const toDateKey = (date: string | null | undefined): string | null => {
  if (!date) return null;
  return date.split('T')[0] || null;
};

export const getDisplayActualEndDate = (item: ActualDateRangeSource): string | null => {
  const actualStart = toDateKey(item.actual_start_date);
  if (!actualStart) return null;

  const actualEnd = toDateKey(item.actual_end_date);
  if (actualEnd) return actualEnd;

  const reviewStart = toDateKey(item.review_start_date);
  if (reviewStart && reviewStart >= actualStart) return reviewStart;

  return actualStart;
};
