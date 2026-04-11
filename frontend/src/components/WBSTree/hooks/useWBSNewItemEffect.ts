import { useEffect } from 'react';
import { Project } from '../../../types/wbs';

export const useWBSNewItemEffect = (
  projects: Project[],
  lastAddedId: string | null,
  setLastAddedId: (id: string | null) => void
) => {
  useEffect(() => {
    if (lastAddedId) {
      let attempts = 0;
      const scrollInterval = setInterval(() => {
        const element = document.querySelector(`[data-wbs-id="${lastAddedId}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (lastAddedId.startsWith('p-') || lastAddedId.startsWith('t-')) {
            const nameInput = element.querySelector('.flex-1.min-w-0 > div');
            if (nameInput instanceof HTMLElement) {
              setTimeout(() => { nameInput.click(); }, 300);
            }
          }
          setLastAddedId(null);
          clearInterval(scrollInterval);
        } else if (++attempts > 20) {
          setLastAddedId(null);
          clearInterval(scrollInterval);
        }
      }, 100);
      return () => clearInterval(scrollInterval);
    }
  }, [projects, lastAddedId, setLastAddedId]);
};
