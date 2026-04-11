import { useCallback } from 'react';
import { Project } from '../../../types/wbs';

interface UseWBSTreeExpansionProps {
  projects: Project[];
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  setExpandedTasks: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}

export const useWBSTreeExpansion = ({
  projects,
  setExpandedProjects,
  setExpandedTasks
}: UseWBSTreeExpansionProps) => {
  const handleProjectLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    projects.forEach(p => { newExpandedProjects[p.id] = false; });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks({});
  }, [projects, setExpandedProjects, setExpandedTasks]);

  const handleTaskLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => { newExpandedTasks[t.id] = false; });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  }, [projects, setExpandedProjects, setExpandedTasks]);

  const handleSubtaskLevel = useCallback(() => {
    const newExpandedProjects: Record<number, boolean> = {};
    const newExpandedTasks: Record<number, boolean> = {};
    projects.forEach(p => {
      newExpandedProjects[p.id] = true;
      p.tasks.forEach(t => { newExpandedTasks[t.id] = true; });
    });
    setExpandedProjects(newExpandedProjects);
    setExpandedTasks(newExpandedTasks);
  }, [projects, setExpandedProjects, setExpandedTasks]);

  const toggleProjectExpand = useCallback((id: number) => {
    setExpandedProjects(prev => ({ ...prev, [id]: !(prev[id] !== false) }));
  }, [setExpandedProjects]);

  const toggleTaskExpand = useCallback((id: number) => {
    setExpandedTasks(prev => ({ ...prev, [id]: !(prev[id] !== false) }));
  }, [setExpandedTasks]);

  return {
    handleProjectLevel,
    handleTaskLevel,
    handleSubtaskLevel,
    toggleProjectExpand,
    toggleTaskExpand
  };
};
