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
  const getInitialNameWidth = (): number => {
    const saved = localStorage.getItem('wbs_name_width');
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 320;
  };

  const [nameWidth, setNameWidth] = useState(getInitialNameWidth);
  const [isResizingName, setIsResizingName] = useState(false);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  useEffect(() => {
    localStorage.setItem('wbs_name_width', nameWidth.toString());
  }, [nameWidth]);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingName(true);
    resizeStartX.current = e.pageX;
    resizeStartWidth.current = nameWidth;
  };

  useEffect(() => {
    if (!isResizingName) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.pageX - resizeStartX.current;
      setNameWidth(Math.max(150, resizeStartWidth.current + delta));
    };
    const handleMouseUp = () => {
      setIsResizingName(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingName]);

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
    startResizing
  };
};
