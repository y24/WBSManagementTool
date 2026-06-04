import { useEffect, useState } from 'react';
import { format } from 'date-fns';

const getCurrentDateString = () => format(new Date(), 'yyyy-MM-dd');

const getMillisecondsUntilNextDate = () => {
  const now = new Date();
  const nextDate = new Date(now);
  nextDate.setHours(24, 0, 1, 0);
  return Math.max(1000, nextDate.getTime() - now.getTime());
};

export function useCurrentDateString() {
  const [currentDateString, setCurrentDateString] = useState(getCurrentDateString);

  useEffect(() => {
    let timerId: ReturnType<typeof window.setTimeout> | null = null;

    const syncDate = () => {
      setCurrentDateString((prev) => {
        const next = getCurrentDateString();
        return prev === next ? prev : next;
      });
    };

    const scheduleNextDateCheck = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }

      timerId = window.setTimeout(() => {
        syncDate();
        scheduleNextDateCheck();
      }, getMillisecondsUntilNextDate());
    };

    const handleVisibilityOrFocus = () => {
      syncDate();
      scheduleNextDateCheck();
    };

    scheduleNextDateCheck();
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  return currentDateString;
}
