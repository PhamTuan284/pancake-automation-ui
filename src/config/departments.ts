export const DEPARTMENTS = [
  'Livestream',
  'Media',
  'Marketing',
  'Model',
  'Sale',
  'Warehouse',
  'Accountant',
  'Admin',
] as const;

export type Department = (typeof DEPARTMENTS)[number];
