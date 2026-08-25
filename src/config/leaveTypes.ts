export const LEAVE_TYPES = [
  { id: 'annual', label: 'Nghỉ phép năm' },
  { id: 'vacation', label: 'Nghỉ mát' },
  { id: 'paternity', label: 'Nghỉ do vợ sinh' },
  { id: 'bereavement', label: 'Nghỉ tang' },
  { id: 'maternity', label: 'Nghỉ thai sản' },
  { id: 'marriage', label: 'Bản thân kết hôn' },
  { id: 'childMarriage', label: 'Con đẻ/con nuôi kết hôn' },
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number]['id'];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = Object.fromEntries(
  LEAVE_TYPES.map((t) => [t.id, t.label])
) as Record<LeaveType, string>;
