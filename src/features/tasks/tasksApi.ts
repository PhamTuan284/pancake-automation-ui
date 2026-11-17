import { authFetch } from '../../lib/authFetch';
import type { TaskRecord, TaskStats, TaskStatus, TaskUser, TaskWorkloadRow } from '../../types';

type Logout = (reason?: string) => void;

export type TaskFilters = {
  scope: 'all' | 'mine' | 'created';
  status?: TaskStatus | '';
  assignee?: string;
  department?: string;
  priority?: string;
  q?: string;
  archived?: boolean;
};

export type TaskDraft = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: string;
  assignees: string[];
  department: string;
  labels: string[];
  startDate: string;
  dueDate: string;
  checklist?: string[];
};

/**
 * Thin client over `/tasks/*`. Every call returns the parsed JSON body or throws
 * with the server's Vietnamese error message; `null` means the session expired
 * and `logout` has already been triggered.
 */
export function createTasksApi(token: string, logout: Logout) {
  async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
    const res = await authFetch(path, token, logout, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res) return null;
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok) throw new Error(data.error || 'Yêu cầu thất bại.');
    return data;
  }

  const json = (body: unknown) => ({ body: JSON.stringify(body) });

  return {
    list(filters: TaskFilters) {
      const params = new URLSearchParams();
      params.set('scope', filters.scope);
      if (filters.status) params.set('status', filters.status);
      if (filters.assignee) params.set('assignee', filters.assignee);
      if (filters.department) params.set('department', filters.department);
      if (filters.priority) params.set('priority', filters.priority);
      if (filters.q) params.set('q', filters.q);
      if (filters.archived) params.set('archived', '1');
      return call<{ tasks: TaskRecord[] }>(`/tasks?${params.toString()}`);
    },
    get(id: string) {
      return call<{ task: TaskRecord }>(`/tasks/${id}`);
    },
    users() {
      return call<{ users: TaskUser[] }>('/tasks/users');
    },
    stats(scope: 'all' | 'mine') {
      return call<{ stats: TaskStats }>(`/tasks/stats?scope=${scope}`);
    },
    workload() {
      return call<{ workload: TaskWorkloadRow[] }>('/tasks/workload');
    },
    create(draft: TaskDraft) {
      return call<{ task: TaskRecord }>('/tasks', { method: 'POST', ...json(draft) });
    },
    update(id: string, patch: Partial<TaskDraft>) {
      return call<{ task: TaskRecord }>(`/tasks/${id}`, { method: 'PATCH', ...json(patch) });
    },
    move(id: string, status: TaskStatus, order?: number) {
      return call<{ task: TaskRecord }>(`/tasks/${id}/move`, { method: 'POST', ...json({ status, order }) });
    },
    reorder(status: TaskStatus, ids: string[]) {
      return call<Record<string, never>>('/tasks/reorder', { method: 'POST', ...json({ status, ids }) });
    },
    archive(id: string, archived: boolean) {
      return call<{ task: TaskRecord }>(`/tasks/${id}/archive`, { method: 'POST', ...json({ archived }) });
    },
    remove(id: string) {
      return call<Record<string, never>>(`/tasks/${id}`, { method: 'DELETE' });
    },
    addComment(id: string, text: string) {
      return call<{ task: TaskRecord }>(`/tasks/${id}/comments`, { method: 'POST', ...json({ text }) });
    },
    deleteComment(id: string, commentId: string) {
      return call<{ task: TaskRecord }>(`/tasks/${id}/comments/${commentId}`, { method: 'DELETE' });
    },
    addChecklistItem(id: string, text: string) {
      return call<{ task: TaskRecord }>(`/tasks/${id}/checklist`, { method: 'POST', ...json({ text }) });
    },
    updateChecklistItem(id: string, itemId: string, patch: { done?: boolean; text?: string; remove?: boolean }) {
      return call<{ task: TaskRecord }>(`/tasks/${id}/checklist/${itemId}`, { method: 'PATCH', ...json(patch) });
    },
  };
}

export type TasksApi = ReturnType<typeof createTasksApi>;
