export const LEAVE_TYPES = [
  { id: 'annual', label: 'Nghỉ phép năm' },
  { id: 'vacation', label: 'Nghỉ mát' },
  { id: 'paternity', label: 'Nghỉ do vợ sinh' },
  { id: 'bereavement', label: 'Nghỉ tang' },
  { id: 'maternity', label: 'Nghỉ thai sản' },
  { id: 'marriage', label: 'Bản thân kết hôn' },
  { id: 'childMarriage', label: 'Con đẻ/con nuôi kết hôn' },
  { id: 'lateArrival', label: 'Đi muộn' },
  { id: 'earlyDeparture', label: 'Về sớm' },
  { id: 'customHours', label: 'Đi làm khác giờ chuẩn' },
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number]['id'];

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = Object.fromEntries(
  LEAVE_TYPES.map((t) => [t.id, t.label])
) as Record<LeaveType, string>;

/**
 * "Đi muộn" / "Về sớm" / "Đi làm khác giờ chuẩn" are permission requests,
 * not day-off absences — they don't deduct from any leave quota and aren't
 * shown in balance tables.
 */
export const NO_QUOTA_LEAVE_TYPES: ReadonlySet<LeaveType> = new Set([
  'lateArrival',
  'earlyDeparture',
  'customHours',
]);

/** Leave types that collect a check-in/check-out time instead of a date range. */
export const TIME_RANGE_LEAVE_TYPES: ReadonlySet<LeaveType> = new Set(['customHours']);
