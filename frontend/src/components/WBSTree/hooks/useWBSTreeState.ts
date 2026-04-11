import { useState, useCallback, useRef, useEffect } from 'react';

export const useWBSTreeState = () => {
  // Resizing logic
  const getInitialWidth = (key: string, defaultWidth: number): number => {
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return defaultWidth;
  };

  const [nameWidth, setNameWidth] = useState(() => getInitialWidth('wbs_name_width', 320));
  const [assigneeWidth, setAssigneeWidth] = useState(() => getInitialWidth('wbs_assignee_width', 112));
  const [resizingColumn, setResizingColumn] = useState<'name' | 'assignee' | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  useEffect(() => {
    localStorage.setItem('wbs_name_width', nameWidth.toString());
  }, [nameWidth]);

  useEffect(() => {
    localStorage.setItem('wbs_assignee_width', assigneeWidth.toString());
  }, [assigneeWidth]);

  const startResizing = (e: React.MouseEvent, column: 'name' | 'assignee') => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(column);
    resizeStartX.current = e.pageX;
    resizeStartWidth.current = column === 'name' ? nameWidth : assigneeWidth;
  };

  useEffect(() => {
    if (!resizingColumn) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.pageX - resizeStartX.current;
      const minWidth = resizingColumn === 'name' ? 150 : 40;
      const newWidth = Math.max(minWidth, resizeStartWidth.current + delta);
      if (resizingColumn === 'name') {
        setNameWidth(newWidth);
      } else {
        setAssigneeWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setResizingColumn(null);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn]);

  return {
    nameWidth,
    assigneeWidth,
    startResizing
  };
};

