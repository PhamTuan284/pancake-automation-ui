import { useEffect, useState } from 'react';
import type { LeaveBalance, LeaveInputDraft, LeaveRecord, LeaveStatus } from '../../types';
import { LEAVE_TYPES, LEAVE_TYPE_LABEL } from '../../config/leaveTypes';
import { apiUrl } from '../../lib/api';
import { UiButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_DRAFT: LeaveInputDraft = {
  employeeName: '',
  type: 'annual',
  startDate: todayIso(),
  endDate: todayIso(),
  reason: '',
};

function formatDate(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('vi-VN');
}

function statusLabel(status: LeaveStatus): string {
  if (status === 'approved') return 'Đã duyệt';
  if (status === 'rejected') return 'Từ chối';
  return 'Chờ duyệt';
}

function statusClass(status: LeaveStatus): string {
  if (status === 'approved') return 'status-badge status-approved';
  if (status === 'rejected') return 'status-badge status-rejected';
  return 'status-badge status-pending';
}

function typeLabel(type: string): string {
  return LEAVE_TYPE_LABEL[type as keyof typeof LEAVE_TYPE_LABEL] ?? type;
}

function availableLeaveTypes(gender: 'male' | 'female' | undefined) {
  return LEAVE_TYPES.filter((t) => {
    if (t.id === 'maternity') return gender === 'female';
    if (t.id === 'paternity') return gender === 'male';
    return true;
  });
}

export function LeavePanel({ toolDescription }: { toolDescription: string }) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<LeaveInputDraft>(EMPTY_DRAFT);
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [pending, setPending] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState('');
  const [myBalance, setMyBalance] = useState<LeaveBalance | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
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

  const loadMyBalance = async () => {
    try {
      const res = await fetch(apiUrl('/leave/my-balance'), { headers: authHeader });
      const data = (await res.json().catch(() => ({}))) as { balance?: LeaveBalance; error?: string };
      if (res.ok && data.balance) setMyBalance(data.balance);
    } catch {
      // ignore
    }
  };

  const loadPending = async () => {
    try {
      const res = await fetch(apiUrl('/leave/all'), { headers: authHeader });
      const data = (await res.json().catch(() => ({}))) as { records?: LeaveRecord[]; error?: string };
      if (res.ok && data.records) setPending(data.records.filter((r) => r.status === 'pending'));
    } catch {
      // ignore
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
    void loadMyBalance();
    if (isAdmin) {
      void loadPending();
      void loadBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token, isAdmin]);

  const updateField = (key: keyof LeaveInputDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const refreshAll = async () => {
    await loadRecords();
    await loadMyBalance();
    if (isAdmin) {
      await loadPending();
      await loadBalances();
    }
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
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể ghi nhận nghỉ phép.');
    } finally {
      setLoading(false);
    }
  };

  const removeRecord = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/leave/${id}`), { method: 'DELETE', headers: authHeader });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Không thể hủy đơn.');
      setRecords((prev) => prev.filter((r) => r._id !== id));
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể hủy đơn.');
    }
  };

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    let reason: string | undefined;
    if (decision === 'reject') {
      reason = window.prompt('Lý do từ chối (không bắt buộc):') ?? undefined;
      if (reason === undefined) return; // user cancelled the prompt
    }
    setDecidingId(id);
    try {
      const res = await fetch(apiUrl(`/leave/${id}/${decision}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ reason }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Không thể xử lý đơn.');
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xử lý đơn.');
    } finally {
      setDecidingId(null);
    }
  };

  const totalDays = records.reduce((sum, r) => sum + r.days, 0);

  return (
    <>
      <p className="tool-intro muted">{toolDescription}</p>

      <section className="card" aria-labelledby="leave-form-title">
        <h2 id="leave-form-title" className="section-title">
          Đăng ký nghỉ phép
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
            <span>Loại nghỉ phép</span>
            <select
              className="search-input webhook-url-input"
              value={draft.type}
              onChange={(e) => updateField('type', e.target.value)}
            >
              {availableLeaveTypes(user?.gender).map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
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
            {loading ? 'Đang gửi…' : 'Gửi đơn xin nghỉ'}
          </UiButton>
        </div>
        <p className="hint">Đơn sẽ ở trạng thái "Chờ duyệt" cho đến khi Admin xác nhận.</p>
        {error && <p className="hint hint-error">{error}</p>}
      </section>

      <section className="card card-table" aria-labelledby="leave-my-balance-title">
        <h2 id="leave-my-balance-title" className="section-title">
          Số phép còn lại của tôi
        </h2>
        {!myBalance && <p className="muted">Đang tải…</p>}
        {myBalance && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Loại nghỉ phép</th>
                <th>Tổng</th>
                <th>Đã dùng</th>
                <th>Còn lại</th>
              </tr>
            </thead>
            <tbody>
              {myBalance.types
                .filter((t) => (t.type !== 'maternity' && t.type !== 'paternity') || t.quota > 0)
                .map((t) => (
                <tr key={t.type}>
                  <td>{t.label}</td>
                  <td>{t.quota}</td>
                  <td>{t.usedDays}</td>
                  <td>{t.remainingDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {isAdmin && (
        <section className="card card-table" aria-labelledby="leave-pending-title">
          <h2 id="leave-pending-title" className="section-title">
            Đơn chờ duyệt {pending.length > 0 && `· ${pending.length}`}
          </h2>
          {pending.length === 0 && <p className="muted small">Không có đơn nào đang chờ duyệt.</p>}
          {pending.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Loại</th>
                  <th>Từ ngày</th>
                  <th>Đến ngày</th>
                  <th>Số ngày</th>
                  <th>Lý do</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r._id}>
                    <td>{r.employeeName}</td>
                    <td>{typeLabel(r.type)}</td>
                    <td>{formatDate(r.startDate)}</td>
                    <td>{formatDate(r.endDate)}</td>
                    <td>{r.days}</td>
                    <td>{r.reason || '—'}</td>
                    <td style={{ display: 'flex', gap: 8 }}>
                      <UiButton
                        variant="tiny"
                        disabled={decidingId === r._id}
                        onClick={() => void decide(r._id, 'approve')}
                      >
                        Duyệt
                      </UiButton>
                      <UiButton
                        variant="tiny"
                        tone="danger"
                        disabled={decidingId === r._id}
                        onClick={() => void decide(r._id, 'reject')}
                      >
                        Từ chối
                      </UiButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

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
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Phòng ban</th>
                    {LEAVE_TYPES.map((t) => (
                      <th key={t.id}>{t.label}<br /><span className="muted small">còn lại/tổng</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr key={b.username}>
                      <td>{b.username}</td>
                      <td>{b.department || '—'}</td>
                      {b.types.map((t) => (
                        <td key={t.type}>{t.remainingDays}/{t.quota}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                <th>Loại</th>
                <th>Từ ngày</th>
                <th>Đến ngày</th>
                <th>Số ngày</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r._id}>
                  <td>{r.employeeName}</td>
                  <td>{typeLabel(r.type)}</td>
                  <td>{formatDate(r.startDate)}</td>
                  <td>{formatDate(r.endDate)}</td>
                  <td>{r.days}</td>
                  <td>{r.reason || '—'}</td>
                  <td>
                    <span className={statusClass(r.status)}>{statusLabel(r.status)}</span>
                    {r.status === 'rejected' && r.rejectReason && (
                      <div className="muted small">{r.rejectReason}</div>
                    )}
                  </td>
                  <td>
                    {r.status === 'pending' && (
                      <UiButton
                        variant="tiny"
                        tone="danger"
                        onClick={() => void removeRecord(r._id)}
                      >
                        Hủy
                      </UiButton>
                    )}
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
