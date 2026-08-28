export const WORK_MODES = [
  'offline_team_live',
  'offline_team_office',
  'offline_team_media',
  'offline_khac',
  'online',
] as const;

export type WorkMode = (typeof WORK_MODES)[number];

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  offline_team_live: 'Offline - Team Live',
  offline_team_office: 'Offline - Team Office',
  offline_team_media: 'Offline - Team Media',
  offline_khac: 'Offline - Khác',
  online: 'Online',
};
