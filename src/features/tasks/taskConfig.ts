import type { TaskPriority, TaskRecord, TaskStatus } from '../../types';

export const TASK_STATUSES: { id: TaskStatus; label: string; hint: string }[] = [
  { id: 'todo', label: 'Cần làm', hint: 'Việc đã giao, chưa bắt đầu' },
  { id: 'in_progress', label: 'Đang làm', hint: 'Đang thực hiện' },
  { id: 'review', label: 'Chờ duyệt', hint: 'Đã xong, chờ người giao kiểm tra' },
  { id: 'done', label: 'Hoàn thành', hint: 'Đã nghiệm thu' },
];

export const STATUS_LABEL: Record<TaskStatus, string> = Object.fromEntries(
  TASK_STATUSES.map((s) => [s.id, s.label])
) as Record<TaskStatus, string>;

export const TASK_PRIORITIES: { id: TaskPriority; label: string }[] = [
  { id: 'low', label: 'Thấp' },
  { id: 'medium', label: 'Trung bình' },
  { id: 'high', label: 'Cao' },
  { id: 'urgent', label: 'Khẩn cấp' },
];

export const PRIORITY_LABEL: Record<TaskPriority, string> = Object.fromEntries(
  TASK_PRIORITIES.map((p) => [p.id, p.label])
) as Record<TaskPriority, string>;

export const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

export function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('vi-VN');
}

export function formatDateTime(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** `YYYY-MM-DD` in local time for `<input type="date">`. */
export function toDateInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DueState = 'none' | 'overdue' | 'today' | 'soon' | 'later' | 'done';

/** How urgent the due date is, for colouring the chip on a card. */
export function dueState(task: Pick<TaskRecord, 'dueDate' | 'status'>): DueState {
  if (task.status === 'done') return 'done';
  if (!task.dueDate) return 'none';
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return 'none';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 2) return 'soon';
  return 'later';
}

export function dueLabel(task: Pick<TaskRecord, 'dueDate' | 'status'>): string {
  const state = dueState(task);
  if (state === 'none') return 'Không hạn';
  const date = formatDate(task.dueDate);
  if (state === 'overdue') return `Quá hạn · ${date}`;
  if (state === 'today') return `Hôm nay · ${date}`;
  return date;
}

export function checklistProgress(task: Pick<TaskRecord, 'checklist'>): { done: number; total: number } {
  const total = task.checklist?.length ?? 0;
  const done = task.checklist?.filter((c) => c.done).length ?? 0;
  return { done, total };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Stable pastel colour per username for avatar bubbles. */
export function avatarColor(username: string): string {
  let hash = 0;
  for (const ch of username) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 55% 42%)`;
}
