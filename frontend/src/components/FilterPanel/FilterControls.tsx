import React from 'react';
import MultiSelect from '../MultiSelect';
import { FilterState, DisplayOptions, UNASSIGNED_ASSIGNEE_ID } from './FilterPanelTypes';
import { Project } from '../../types/wbs';
import { InitialData } from '../../types';

interface FilterControlsProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  displayOptions: DisplayOptions;
  projects: Project[];
  initialData: InitialData | null;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  setFilters,
  displayOptions,
  projects,
  initialData
}) => {
  const statuses = initialData?.statuses || [];
  const members = initialData?.members || [];
  const doneStatusId = initialData?.status_mapping_done ? parseInt(initialData.status_mapping_done, 10) : null;
  const removedStatusId = statuses.find(s => s.status_name === 'Removed')?.id || 7;

  return (
    <>
      {/* Project Filter */}
      <MultiSelect
        values={filters.projectIds}
        options={projects
          .filter(p => {
            // 選択中のプロジェクトは常に表示
            if (filters.projectIds.includes(p.id)) return true;

            if (!displayOptions.showRemoved && p.status_id === removedStatusId) return false;

            return true;
          })
          .map(p => {
            const isDoneProject = doneStatusId !== null && p.status_id === doneStatusId;
            return {
              id: p.id,
              name: p.project_name,
              badge: isDoneProject ? '完了済' : undefined,
              hiddenUntilSearch: isDoneProject && !displayOptions.showDoneProjects,
            };
          })}
        onChange={(ids) => setFilters((prev: FilterState) => ({ ...prev, projectIds: ids as number[] }))}
        placeholder="プロジェクトを選択"
        dropdownTitle="プロジェクト"
        className="hover:shadow-md h-[34px]"
      />

      {/* Status Filter */}
      <MultiSelect
        values={filters.statusIds}
        options={statuses.map(s => ({
          id: s.id,
          name: s.status_name,
          color: s.color_code,
          disabled: !displayOptions.showRemoved && s.status_name === 'Removed'
        }))}
        onChange={(ids) => setFilters((prev: FilterState) => ({ ...prev, statusIds: ids as number[] }))}
        placeholder="ステータスを選択"
        dropdownTitle="ステータス"
        className="hover:shadow-md h-[34px]"
      />

      {/* Assignee Filter */}
      <MultiSelect
        values={filters.assigneeIds}
        options={[
          { id: UNASSIGNED_ASSIGNEE_ID, name: '未アサイン' },
          ...members.map(m => ({ id: m.id, name: m.member_name })),
        ]}
        onChange={(ids) => setFilters((prev: FilterState) => ({ ...prev, assigneeIds: ids as number[] }))}
        placeholder="担当者を選択"
        dropdownTitle="担当者"
        className="hover:shadow-md h-[34px]"
      />

    </>
  );
};

export default FilterControls;
