import { authFetch } from '../../lib/authFetch';
import type {
  ImportPreview,
  PayrollEmployee,
  PayrollEntry,
  PayrollMeta,
  PayrollSettings,
  PeriodListItem,
  PeriodView,
} from './payrollTypes';

type Logout = (reason?: string) => void;

/**
 * Thin client over `/payroll/*` (admin-only). Every call returns the parsed
 * JSON body or throws with the server's Vietnamese error message; `null`
 * means the session expired and `logout` has already been triggered.
 */
export function createPayrollApi(token: string, logout: Logout) {
  async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
    const isForm = init?.body instanceof FormData;
    const res = await authFetch(path, token, logout, {
      ...init,
      headers: isForm ? init?.headers : { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    if (!res) return null;
    const data = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
    if (!res.ok) throw new Error(data.error || 'Yêu cầu thất bại.');
    return data;
  }

  async function download(path: string, fallbackName: string): Promise<void> {
    const res = await authFetch(path, token, logout);
    if (!res) return;
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || 'Không thể tải file.');
    }
    const match = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get('Content-Disposition') ?? '');
    const name = match ? decodeURIComponent(match[1]) : fallbackName;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const json = (body: unknown) => ({ body: JSON.stringify(body) });
  const form = (file: File, extra: Record<string, string> = {}) => {
    const body = new FormData();
    body.append('file', file);
    for (const [k, v] of Object.entries(extra)) body.append(k, v);
    return { method: 'POST', body };
  };

  return {
    meta() {
      return call<PayrollMeta>('/payroll/meta');
    },
    saveSettings(settings: PayrollSettings) {
      return call<{ settings: PayrollSettings }>('/payroll/settings', { method: 'PUT', ...json({ settings }) });
    },
    employees() {
      return call<{ employees: PayrollEmployee[] }>('/payroll/employees');
    },
    createEmployee(employee: PayrollEmployee) {
      return call<{ employee: PayrollEmployee }>('/payroll/employees', { method: 'POST', ...json(employee) });
    },
    updateEmployee(originalCode: string, employee: PayrollEmployee) {
      return call<{ employee: PayrollEmployee }>(`/payroll/employees/${encodeURIComponent(originalCode)}`, {
        method: 'PUT',
        ...json(employee),
      });
    },
    deleteEmployee(code: string) {
      return call<object>(`/payroll/employees/${encodeURIComponent(code)}`, { method: 'DELETE' });
    },
    exportEmployees() {
      return download('/payroll/employees/export', 'Thông tin lao động.xlsx');
    },
    periods() {
      return call<{ periods: PeriodListItem[] }>('/payroll/periods');
    },
    period(month: string) {
      return call<{ period: PeriodView }>(`/payroll/periods/${month}`);
    },
    createPeriod(month: string) {
      return call<{ period: PeriodView }>('/payroll/periods', { method: 'POST', ...json({ month }) });
    },
    deletePeriod(month: string) {
      return call<object>(`/payroll/periods/${month}`, { method: 'DELETE' });
    },
    saveEntries(month: string, entries: PayrollEntry[]) {
      return call<{ period: PeriodView }>(`/payroll/periods/${month}/entries`, { method: 'PUT', ...json({ entries }) });
    },
    importInputs(month: string, file: File) {
      return call<{ period: PeriodView }>(`/payroll/periods/${month}/inputs`, form(file));
    },
    refreshSettings(month: string) {
      return call<{ period: PeriodView }>(`/payroll/periods/${month}/refresh-settings`, { method: 'POST' });
    },
    lock(month: string) {
      return call<{ period: PeriodView }>(`/payroll/periods/${month}/lock`, { method: 'POST' });
    },
    unlock(month: string) {
      return call<{ period: PeriodView }>(`/payroll/periods/${month}/unlock`, { method: 'POST' });
    },
    exportPeriod(month: string) {
      return download(`/payroll/periods/${month}/export`, `BANG_LUONG_${month}.xlsx`);
    },
    importPreview(file: File) {
      return call<{ preview: ImportPreview }>('/payroll/import/preview', form(file));
    },
    importApply(file: File, withEntries: boolean) {
      return call<{ result: { month: string | null; employees: number; entries: number } }>(
        '/payroll/import/apply',
        form(file, { withEntries: String(withEntries) })
      );
    },
  };
}

export type PayrollApi = ReturnType<typeof createPayrollApi>;
