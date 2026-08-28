import { useEffect, useState } from 'react';
import type { LeaveBalance, LeaveInputDraft, LeaveRecord, LeaveStatus } from '../../types';
import {
  LEAVE_TYPES,
  LEAVE_TYPE_LABEL,
  NO_QUOTA_LEAVE_TYPES,
  TIME_RANGE_LEAVE_TYPES,
  type LeaveType,
} from '../../config/leaveTypes';
import { authFetch } from '../../lib/authFetch';
import { UiButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_DRAFT: LeaveInputDraft = {
  type: 'annual',
  startDate: todayIso(),
  endDate: todayIso(),
  session: 'full',
  checkInTime: '',
  checkOutTime: '',
  reason: '',
};

const SESSION_LABEL: Record<LeaveInputDraft['session'], string> = {
  full: 'Cả ngày',
  morning: 'Nửa ngày (buổi sáng)',
  afternoon: 'Nửa ngày (buổi chiều)',
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

function reasonCell(r: LeaveRecord): string {
  if (r.checkInTime || r.checkOutTime) {
    const times = `Vào: ${r.checkInTime ?? '—'} · Về: ${r.checkOutTime ?? '—'}`;
    return r.reason ? `${times} — ${r.reason}` : times;
  }
  return r.reason || '—';
}

function daysLabel(r: LeaveRecord): string {
  if (NO_QUOTA_LEAVE_TYPES.has(r.type as LeaveType)) return '—';
  if (r.session === 'morning') return `${r.days} (sáng)`;
  if (r.session === 'afternoon') return `${r.days} (chiều)`;
  return String(r.days);
}

const BALANCE_LEAVE_TYPES = LEAVE_TYPES.filter((t) => !NO_QUOTA_LEAVE_TYPES.has(t.id));

/**
 * Calendar days from `startIso` to `endIso` inclusive, excluding Sundays —
 * Sunday is already everyone's weekly day off, so it never counts against
 * leave quota. Mirrors `countLeaveDays` in the server's `common/leaveTypes.ts`.
 */
function countLeaveDays(startIso: string, endIso: string): { days: number; hasSunday: boolean } {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return { days: 0, hasSunday: false };
  }
  let days = 0;
  let hasSunday = false;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    if (cursor.getUTCDay() === 0) hasSunday = true;
    else days += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { days, hasSunday };
}

function availableLeaveTypes(gender: 'male' | 'female' | undefined) {
  return LEAVE_TYPES.filter((t) => {
    if (t.id === 'maternity') return gender === 'female';
    if (t.id === 'paternity') return gender === 'male';
    return true;
  });
}

export function LeavePanel({ toolDescription }: { toolDescription: string }) {
  const { user, logout } = useAuth();
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
  const token = user?.token ?? '';

  const loadRecords = async () => {
    setListLoading(true);
    try {
      const res = await authFetch('/leave/mine', token, logout);
      if (!res) return;
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
      const res = await authFetch('/leave/my-balance', token, logout);
      if (!res) return;
      const data = (await res.json().catch(() => ({}))) as { balance?: LeaveBalance; error?: string };
      if (res.ok && data.balance) setMyBalance(data.balance);
    } catch {
      // ignore
    }
  };

  const loadPending = async () => {
    try {
      const res = await authFetch('/leave/all', token, logout);
      if (!res) return;
      const data = (await res.json().catch(() => ({}))) as { records?: LeaveRecord[]; error?: string };
      if (res.ok && data.records) setPending(data.records.filter((r) => r.status === 'pending'));
    } catch {
      // ignore
    }
  };

  const loadBalances = async () => {
    setBalancesLoading(true);
    try {
      const res = await authFetch('/leave/balances', token, logout);
      if (!res) return;
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
  }, [token, isAdmin]);

  const isNoQuotaType = NO_QUOTA_LEAVE_TYPES.has(draft.type as LeaveType);
  const isTimeRangeType = TIME_RANGE_LEAVE_TYPES.has(draft.type as LeaveType);

  const updateField = (key: 'type' | 'startDate' | 'endDate' | 'reason', value: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      // "Đi muộn"/"Về sớm" are single-occurrence permission requests.
      if (key === 'type' && NO_QUOTA_LEAVE_TYPES.has(value as LeaveType)) {
        next.endDate = next.startDate;
        next.session = 'full';
      }
      if (key === 'startDate' && NO_QUOTA_LEAVE_TYPES.has(next.type as LeaveType)) {
        next.endDate = value;
      }
      // Half-day only makes sense for a single-day request.
      if ((key === 'startDate' || key === 'endDate') && next.startDate !== next.endDate) {
        next.session = 'full';
      }
      return next;
    });
  };

  const isSingleDay = draft.startDate === draft.endDate;
  const rangePreview = countLeaveDays(draft.startDate, draft.endDate);
  const previewDays = draft.session === 'full' ? rangePreview.days : 0.5;
  const includesSunday = draft.session === 'full' && rangePreview.hasSunday;
  const canSubmit = isTimeRangeType
    ? Boolean(draft.checkInTime && draft.checkOutTime)
    : isNoQuotaType || previewDays > 0;

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
      const res = await authFetch('/leave', token, logout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!res) return;
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Không thể ghi nhận nghỉ phép.');
      setDraft(EMPTY_DRAFT);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể ghi nhận nghỉ phép.');
    } finally {
      setLoading(false);
    }
  };

  const removeRecord = async (id: string) => {
    try {
      const res = await authFetch(`/leave/${id}`, token, logout, { method: 'DELETE' });
      if (!res) return;
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
      const res = await authFetch(`/leave/${id}/${decision}`, token, logout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res) return;
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
              value={user?.fullName || user?.username || ''}
              disabled
              readOnly
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
          {!isNoQuotaType && (
            <label className="webhook-register-field">
              <span>Đến ngày</span>
              <input
                type="date"
                className="search-input webhook-url-input"
                value={draft.endDate}
                onChange={(e) => updateField('endDate', e.target.value)}
              />
            </label>
          )}
          {!isNoQuotaType && (
            <label className="webhook-register-field">
              <span>Buổi nghỉ</span>
              <select
                className="search-input webhook-url-input"
                value={draft.session}
                disabled={!isSingleDay}
                onChange={(e) => setDraft((prev) => ({ ...prev, session: e.target.value as LeaveInputDraft['session'] }))}
              >
                {(Object.keys(SESSION_LABEL) as LeaveInputDraft['session'][]).map((s) => (
                  <option key={s} value={s}>{SESSION_LABEL[s]}</option>
                ))}
              </select>
              {!isSingleDay && <span className="muted small">Chỉ chọn được nửa ngày khi nghỉ 1 ngày duy nhất.</span>}
            </label>
          )}
          {isTimeRangeType && (
            <>
              <label className="webhook-register-field">
                <span>Giờ vào làm</span>
                <input
                  type="time"
                  className="search-input webhook-url-input"
                  value={draft.checkInTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, checkInTime: e.target.value }))}
                />
              </label>
              <label className="webhook-register-field">
                <span>Giờ về</span>
                <input
                  type="time"
                  className="search-input webhook-url-input"
                  value={draft.checkOutTime}
                  onChange={(e) => setDraft((prev) => ({ ...prev, checkOutTime: e.target.value }))}
                />
              </label>
            </>
          )}
          <label className="webhook-register-field">
            <span>Lý do</span>
            <input
              type="text"
              className="search-input webhook-url-input"
              value={draft.reason}
              onChange={(e) => updateField('reason', e.target.value)}
              placeholder={
                isTimeRangeType
                  ? 'VD: Đưa con đi khám bệnh, việc gia đình đột xuất…'
                  : isNoQuotaType
                  ? 'VD: Đi muộn 30 phút do tắc đường, về sớm 1 tiếng do việc gia đình…'
                  : 'Nghỉ phép năm, việc gia đình,…'
              }
            />
          </label>
        </div>

        {isNoQuotaType ? (
          <p className="hint">
            {isTimeRangeType
              ? 'Đi làm khác giờ chuẩn không tính vào ngày nghỉ phép.'
              : 'Đi muộn/Về sớm không tính vào ngày nghỉ phép.'}
          </p>
        ) : (
          <p className="hint">
            Số ngày nghỉ: <strong>{previewDays}</strong> ngày
            {includesSunday && ' (đã trừ Chủ nhật)'}
          </p>
        )}

        <div className="webhook-register-actions">
          <UiButton onClick={() => void submit()} disabled={loading || !canSubmit}>
            {loading ? 'Đang gửi…' : 'Gửi đơn xin nghỉ'}
          </UiButton>
        </div>
        <p className="hint">Đơn sẽ ở trạng thái "Chờ duyệt" cho đến khi Admin xác nhận.</p>
        {!isNoQuotaType && previewDays <= 0 && (
          <p className="hint hint-error">Khoảng ngày đã chọn không có ngày nào được tính (Chủ nhật không tính vào ngày nghỉ).</p>
        )}
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
                  <th>Phòng ban</th>
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
                    <td>{r.department || '—'}</td>
                    <td>{typeLabel(r.type)}</td>
                    <td>{formatDate(r.startDate)}</td>
                    <td>{formatDate(r.endDate)}</td>
                    <td>{daysLabel(r)}</td>
                    <td>{reasonCell(r)}</td>
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
                    {BALANCE_LEAVE_TYPES.map((t) => (
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
                  <td>{daysLabel(r)}</td>
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
