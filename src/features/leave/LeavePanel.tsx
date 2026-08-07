import { useEffect, useState } from 'react';
import type { LeaveBalance, LeaveInputDraft, LeaveRecord } from '../../types';
import { apiUrl } from '../../lib/api';
import { UiButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_DRAFT: LeaveInputDraft = {
  employeeName: '',
  startDate: todayIso(),
  endDate: todayIso(),
  reason: '',
};

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('vi-VN');
}

export function LeavePanel({ toolDescription }: { toolDescription: string }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<LeaveInputDraft>(EMPTY_DRAFT);
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const isAdmin = user?.role === 'admin';

  const authHeader = { Authorization: `Bearer ${user?.token ?? ''}` };

  const loadRecords = async () => {
    setListLoading(true);
    try {
      const res = await fetch(apiUrl('/leave/mine'), { headers: authHeader });
      const data = (await res.json().catch(() => ({}))) as {
        records?: LeaveRecord[];
        error?: string;
      };
      if (res.ok && data.records) setRecords(data.records);
    } catch {
      // ignore, keep last known list
    } finally {
      setListLoading(false);
    }
  };

  const loadBalances = async () => {
    setBalancesLoading(true);
    try {
      const res = await fetch(apiUrl('/leave/balances'), { headers: authHeader });
      const data = (await res.json().catch(() => ({}))) as {
        balances?: LeaveBalance[];
        error?: string;
      };
      if (res.ok && data.balances) setBalances(data.balances);
    } catch {
      // ignore, keep last known list
    } finally {
      setBalancesLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
    if (isAdmin) void loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token, isAdmin]);

  const updateField = (key: keyof LeaveInputDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/leave'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(draft),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Không thể ghi nhận nghỉ phép.');
      setDraft((prev) => ({ ...EMPTY_DRAFT, employeeName: prev.employeeName }));
      await loadRecords();
      if (isAdmin) await loadBalances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể ghi nhận nghỉ phép.');
    } finally {
      setLoading(false);
    }
  };

  const removeRecord = async (id: string) => {
    try {
      await fetch(apiUrl(`/leave/${id}`), { method: 'DELETE', headers: authHeader });
      setRecords((prev) => prev.filter((r) => r._id !== id));
      if (isAdmin) await loadBalances();
    } catch {
      // ignore
    }
  };

  const totalDays = records.reduce((sum, r) => sum + r.days, 0);

  return (
    <>
      <p className="tool-intro muted">{toolDescription}</p>

      <section className="card" aria-labelledby="leave-form-title">
        <h2 id="leave-form-title" className="section-title">
          Ghi nhận nghỉ phép
        </h2>
        <div className="salary-form-grid">
          <label className="webhook-register-field">
            <span>Tên nhân viên</span>
            <input
              type="text"
              className="search-input webhook-url-input"
              value={draft.employeeName}
              onChange={(e) => updateField('employeeName', e.target.value)}
              placeholder={user?.username ?? 'Nguyễn Văn A'}
            />
          </label>
          <label className="webhook-register-field">
            <span>Từ ngày</span>
            <input
              type="date"
              className="search-input webhook-url-input"
              value={draft.startDate}
              onChange={(e) => updateField('startDate', e.target.value)}
            />
          </label>
          <label className="webhook-register-field">
            <span>Đến ngày</span>
            <input
              type="date"
              className="search-input webhook-url-input"
              value={draft.endDate}
              onChange={(e) => updateField('endDate', e.target.value)}
            />
          </label>
          <label className="webhook-register-field">
            <span>Lý do</span>
            <input
              type="text"
              className="search-input webhook-url-input"
              value={draft.reason}
              onChange={(e) => updateField('reason', e.target.value)}
              placeholder="Nghỉ phép năm, việc gia đình,…"
            />
          </label>
        </div>

        <div className="webhook-register-actions">
          <UiButton onClick={() => void submit()} disabled={loading}>
            {loading ? 'Đang lưu…' : 'Ghi nhận nghỉ phép'}
          </UiButton>
        </div>
        {error && <p className="hint hint-error">{error}</p>}
      </section>

      {isAdmin && (
        <section className="card card-table" aria-labelledby="leave-balances-title">
          <h2 id="leave-balances-title" className="section-title">
            Số phép còn lại theo nhân viên
          </h2>
          {balancesLoading && <p className="muted">Đang tải…</p>}
          {!balancesLoading && balances.length === 0 && (
            <p className="muted small">Chưa có dữ liệu nhân viên.</p>
          )}
          {balances.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Tổng phép năm</th>
                  <th>Đã dùng</th>
                  <th>Còn lại</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.username}>
                    <td>{b.username}</td>
                    <td>{b.paidLeaveTotal}</td>
                    <td>{b.usedDays}</td>
                    <td>{b.remainingDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="card card-table" aria-labelledby="leave-history-title">
        <h2 id="leave-history-title" className="section-title">
          Lịch sử nghỉ phép {totalDays > 0 && `· Tổng ${totalDays} ngày`}
        </h2>
        {listLoading && <p className="muted">Đang tải…</p>}
        {!listLoading && records.length === 0 && (
          <p className="muted small">Chưa có bản ghi nghỉ phép nào.</p>
        )}
        {records.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Từ ngày</th>
                <th>Đến ngày</th>
                <th>Số ngày</th>
                <th>Lý do</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{r.employeeName}</td>
                  <td>{formatDate(r.startDate)}</td>
                  <td>{formatDate(r.endDate)}</td>
                  <td>{r.days}</td>
                  <td>{r.reason || '—'}</td>
                  <td>
                    <UiButton
                      variant="tiny"
                      tone="danger"
                      onClick={() => void removeRecord(r._id)}
                    >
                      Xóa
                    </UiButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
