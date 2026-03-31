import { useState, useCallback, useRef, useEffect } from 'react';
import { Project } from '../../../types/wbs';

export const useWBSTreeState = (projects: Project[]) => {
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});

  const toggleProject = useCallback((id: number) => setExpandedProjects(p => ({ ...p, [id]: !(p[id] !== false) })), []);
  const toggleTask = useCallback((id: number) => setExpandedTasks(t => ({ ...t, [id]: !(t[id] !== false) })), []);

  const handleProjectLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = false;
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks({});
  }, [projects]);

  const handleTaskLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => {
        newExpandedTasks[t.id] = false;
      });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  }, [projects]);

  const handleSubtaskLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => {
        newExpandedTasks[t.id] = true;
      });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  }, [projects]);

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
    expandedProjects,
    setExpandedProjects,
    expandedTasks,
    setExpandedTasks,
    toggleProject,
    toggleTask,
    handleProjectLevel,
    handleTaskLevel,
    handleSubtaskLevel,
    nameWidth,
    assigneeWidth,
    startResizing
  };
};
