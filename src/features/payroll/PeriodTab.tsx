import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import CircularProgress from '@mui/material/CircularProgress';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { PayrollApi } from './payrollApi';
import { monthLabel, numberText, parseNumberText, vnd, type MetricColumn, type PayrollEntry, type PeriodListItem, type PeriodRow, type PeriodView } from './payrollTypes';
import { PayslipDialog } from './PayslipDialog';

const ENTRY_FIELDS: { key: 'bonus' | 'advance' | 'carryOver'; label: string }[] = [
  { key: 'bonus', label: 'Thưởng' },
  { key: 'advance', label: 'Tạm ứng' },
  { key: 'carryOver', label: 'Bù trừ kỳ trước' },
];

// Code + name stay visible while the accountant scrolls across the input columns.
const STICKY_CODE = { position: 'sticky', left: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 80 } as const;
const STICKY_NAME = { position: 'sticky', left: 80, zIndex: 2, bgcolor: 'background.paper', minWidth: 180, borderRight: 1, borderRightColor: 'divider' } as const;

/** Unsaved edits: code → field ("m:<metric>" for metrics) → raw text. */
type Drafts = Record<string, Record<string, string>>;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function applyDrafts(entry: PayrollEntry, draft: Record<string, string> | undefined): PayrollEntry | string {
  if (!draft) return entry;
  const next: PayrollEntry = { ...entry, metrics: { ...entry.metrics } };
  for (const [field, text] of Object.entries(draft)) {
    if (field === 'note') {
      next.note = text;
      continue;
    }
    if (field === 'pitOverride' && text.trim() === '') {
      // Cleared → back to the computed tax.
      next.pitOverride = null;
      continue;
    }
    const n = parseNumberText(text);
    if (n === null) return `${entry.code}: "${text}" không phải số.`;
    if (field.startsWith('m:')) next.metrics[field.slice(2)] = n;
    else (next as unknown as Record<string, number>)[field] = n;
  }
  return next;
}

export function PeriodTab({ api, onError }: { api: PayrollApi; onError: (msg: string) => void }) {
  const [periods, setPeriods] = useState<PeriodListItem[]>([]);
  const [month, setMonth] = useState<string>('');
  const [period, setPeriod] = useState<PeriodView | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState<string>('');
  const [drafts, setDrafts] = useState<Drafts>({});
  const [newMonth, setNewMonth] = useState(currentMonth());
  const [slip, setSlip] = useState<PeriodRow | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirtyCount = Object.keys(drafts).length;
  const locked = period?.status === 'locked';

  const loadPeriods = useCallback(async () => {
    try {
      const data = await api.periods();
      if (!data) return;
      setPeriods(data.periods);
      setMonth((m) => m || data.periods[0]?.month || '');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không thể tải kỳ lương.');
    }
  }, [api, onError]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (!month) {
      setPeriod(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDrafts({});
    api
      .period(month)
      .then((data) => {
        if (!cancelled && data) setPeriod(data.period);
      })
      .catch((err) => !cancelled && onError(err instanceof Error ? err.message : 'Không thể tải kỳ lương.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [api, month, onError]);

  async function run(action: () => Promise<{ period: PeriodView } | null>, after?: () => void) {
    setBusy(true);
    try {
      const data = await action();
      if (data) {
        setPeriod(data.period);
        setDrafts({});
        after?.();
        void loadPeriods();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDiscard(): boolean {
    return dirtyCount === 0 || window.confirm('Có thay đổi chưa lưu. Bỏ qua các thay đổi này?');
  }

  async function handleCreate() {
    await run(() => api.createPeriod(newMonth), () => setMonth(newMonth));
  }

  async function handleSave() {
    if (!period) return;
    const entries: PayrollEntry[] = [];
    for (const row of period.rows) {
      const draft = drafts[row.employee.code];
      if (!draft) continue;
      const next = applyDrafts(row.entry, draft);
      if (typeof next === 'string') {
        onError(next);
        return;
      }
      entries.push(next);
    }
    await run(() => api.saveEntries(period.month, entries));
  }

  async function handleDelete() {
    if (!period || !window.confirm(`Xóa kỳ lương ${monthLabel(period.month)} và toàn bộ số liệu đã nhập?`)) return;
    setBusy(true);
    try {
      await api.deletePeriod(period.month);
      setMonth('');
      setPeriod(null);
      await loadPeriods();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không thể xóa kỳ lương.');
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!period) return;
    if (dirtyCount > 0 && !window.confirm('File xuất ra chưa gồm các thay đổi chưa lưu. Vẫn xuất?')) return;
    try {
      await api.exportPeriod(period.month);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không thể xuất Excel.');
    }
  }

  function setDraft(code: string, field: string, value: string) {
    setDrafts((prev) => ({ ...prev, [code]: { ...prev[code], [field]: value } }));
  }

  const teams = useMemo(() => (period ? Object.keys(period.metricColumns).filter(Boolean) : []), [period]);
  const visibleRows = useMemo(
    () => (period ? period.rows.filter((r) => !team || r.employee.team === team) : []),
    [period, team]
  );
  const metricCols: MetricColumn[] = team && period ? period.metricColumns[team] ?? [] : [];

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Kỳ lương"
          value={periods.some((p) => p.month === month) ? month : ''}
          onChange={(e) => confirmDiscard() && setMonth(e.target.value)}
          sx={{ minWidth: 220 }}
        >
          {periods.length === 0 && <MenuItem value="" disabled>Chưa có kỳ lương</MenuItem>}
          {periods.map((p) => (
            <MenuItem key={p.month} value={p.month}>
              {monthLabel(p.month)} {p.status === 'locked' ? '· đã chốt' : '· nháp'}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="month"
          label="Tạo kỳ mới"
          value={newMonth}
          onChange={(e) => setNewMonth(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="outlined" onClick={handleCreate} disabled={busy || !newMonth}>
          Tạo kỳ
        </Button>
        <Box sx={{ flex: 1 }} />
        {period && (
          <>
            {!locked && (
              <Button variant="contained" startIcon={<SaveIcon />} disabled={busy || dirtyCount === 0} onClick={handleSave}>
                Lưu{dirtyCount ? ` (${dirtyCount})` : ''}
              </Button>
            )}
            <Button startIcon={<DownloadIcon />} onClick={handleExport} disabled={busy}>
              Xuất file bảng lương
            </Button>
            {!locked && (
              <>
                <Button startIcon={<UploadFileIcon />} disabled={busy} onClick={() => fileInput.current?.click()}>
                  Nhập số liệu từ Excel
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file && confirmDiscard()) void run(() => api.importInputs(period.month, file));
                  }}
                />
                <Button
                  disabled={busy}
                  onClick={() =>
                    window.confirm('Áp tỷ lệ bảo hiểm/thuế đang cài đặt cho kỳ này?') && run(() => api.refreshSettings(period.month))
                  }
                >
                  Áp cài đặt mới
                </Button>
                <Button
                  color="warning"
                  variant="outlined"
                  startIcon={<LockIcon />}
                  disabled={busy || dirtyCount > 0}
                  onClick={() =>
                    window.confirm(
                      `Chốt ${monthLabel(period.month)}? Sau khi chốt, bảng lương được lưu cố định — sửa công thức nhân viên sẽ không làm đổi kỳ này.`
                    ) && run(() => api.lock(period.month))
                  }
                >
                  Chốt kỳ
                </Button>
                <Button color="error" disabled={busy} onClick={handleDelete}>
                  Xóa kỳ
                </Button>
              </>
            )}
            {locked && (
              <Button
                color="warning"
                startIcon={<LockOpenIcon />}
                disabled={busy}
                onClick={() =>
                  window.confirm('Mở chốt sẽ tính lại kỳ này theo công thức hiện tại của nhân viên. Tiếp tục?') &&
                  run(() => api.unlock(period.month))
                }
              >
                Mở chốt
              </Button>
            )}
          </>
        )}
      </Box>

      {loading && <CircularProgress size={28} />}

      {!loading && !period && (
        <Alert severity="info">
          Chưa có kỳ lương nào. Tạo kỳ mới ở trên, hoặc vào tab <b>Đồng bộ Excel</b> để nạp nhân viên và số liệu từ file bảng lương.
        </Alert>
      )}

      {period && !loading && (
        <>
          {locked && (
            <Alert severity="success">
              Đã chốt {period.lockedAt ? new Date(period.lockedAt).toLocaleString('vi-VN') : ''}
              {period.lockedBy ? ` bởi ${period.lockedBy}` : ''}. Số liệu chỉ xem.
            </Alert>
          )}
          <Box className="task-stats">
            {[
              ['Nhân sự nhận lương', String(period.summary.headcount)],
              ['Tổng thu nhập', vnd(period.summary.gross)],
              ['Thuế TNCN', vnd(period.summary.pit)],
              ['BH NLĐ đóng', vnd(period.summary.insuranceEmployee)],
              ['BH công ty đóng', vnd(period.summary.insuranceCompany)],
              ['Thực lĩnh', vnd(period.summary.net)],
            ].map(([label, value]) => (
              <div key={label} className="task-stat">
                <span className="task-stat-value">{value}</span>
                <span className="task-stat-label">{label}</span>
              </div>
            ))}
          </Box>

          <Tabs value={team} onChange={(_e, v: string) => setTeam(v)} variant="scrollable" scrollButtons="auto">
            <Tab value="" label="Tất cả" />
            {teams.map((t) => {
              const s = period.summary.byTeam.find((b) => b.team === t);
              return <Tab key={t} value={t} label={s ? `${t} · ${vnd(s.gross)}` : t} />;
            })}
          </Tabs>

          {!team && !locked && (
            <Typography variant="body2" color="text.secondary">
              Quy trình: chọn từng team → nhập số liệu (giờ live, số công, doanh thu, sản lượng, thưởng, tạm ứng…) → <b>Lưu</b> → <b>Xuất file bảng lương</b> (đúng mẫu Excel: TH LƯƠNG, LƯƠNG Txx, CTV, TNCN, lương từng team) → kiểm tra → <b>Chốt kỳ</b>. Bấm tên nhân viên để xem phiếu lương.
            </Typography>
          )}

          <TableContainer sx={{ maxHeight: '70vh', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...STICKY_CODE, zIndex: 3 }}>Mã</TableCell>
                  <TableCell sx={{ ...STICKY_NAME, zIndex: 3 }}>Họ và tên</TableCell>
                  {!team && <TableCell>Team</TableCell>}
                  {metricCols.map((c) => (
                    <TableCell key={c.key} align="right" sx={{ minWidth: 110 }}>
                      {c.label}
                    </TableCell>
                  ))}
                  {ENTRY_FIELDS.map((f) => (
                    <TableCell key={f.key} align="right" sx={{ minWidth: 110 }}>
                      {f.label}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ minWidth: 110 }} title="Để trống = tự tính. Nhập 0 nếu không khấu trừ (vd trả ngoài).">
                    Thuế nhập tay
                  </TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Ghi chú</TableCell>
                  <TableCell align="right">Tổng thu nhập</TableCell>
                  <TableCell align="right">BH NLĐ</TableCell>
                  <TableCell align="right">Thuế TNCN</TableCell>
                  <TableCell align="right">Thực lĩnh</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleRows.map((row) => {
                  const code = row.employee.code;
                  const draft = drafts[code];
                  const used = new Set(row.employee.components.flatMap(metricsOf));
                  const cellInput = (field: string, value: number) => (
                    <TextField
                      size="small"
                      variant="standard"
                      value={draft?.[field] ?? numberText(value)}
                      onChange={(e) => setDraft(code, field, e.target.value)}
                      disabled={locked}
                      slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'right' } } }}
                      sx={{ width: 110 }}
                    />
                  );
                  return (
                    <TableRow key={code} hover selected={Boolean(draft)}>
                      <TableCell sx={STICKY_CODE}>{code}</TableCell>
                      <TableCell sx={STICKY_NAME}>
                        <Link component="button" type="button" onClick={() => setSlip(row)} underline="hover">
                          {row.employee.fullName}
                        </Link>
                        {row.employee.contractType === 'hdld' && <Chip label="HĐLĐ" size="small" sx={{ ml: 0.5 }} />}
                        {!row.employee.isActive && <Chip label="nghỉ" size="small" sx={{ ml: 0.5 }} />}
                      </TableCell>
                      {!team && <TableCell>{row.employee.team}</TableCell>}
                      {metricCols.map((c) => (
                        <TableCell key={c.key} align="right">
                          {used.has(c.key) ? cellInput(`m:${c.key}`, row.entry.metrics[c.key] ?? 0) : '—'}
                        </TableCell>
                      ))}
                      {ENTRY_FIELDS.map((f) => (
                        <TableCell key={f.key} align="right">
                          {cellInput(f.key, row.entry[f.key])}
                        </TableCell>
                      ))}
                      <TableCell align="right">
                        <TextField
                          size="small"
                          variant="standard"
                          placeholder="tự tính"
                          value={draft?.pitOverride ?? (typeof row.entry.pitOverride === 'number' ? numberText(row.entry.pitOverride) || '0' : '')}
                          onChange={(e) => setDraft(code, 'pitOverride', e.target.value)}
                          disabled={locked}
                          slotProps={{ htmlInput: { inputMode: 'decimal', style: { textAlign: 'right' } } }}
                          sx={{ width: 110 }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          variant="standard"
                          value={draft?.note ?? row.entry.note}
                          onChange={(e) => setDraft(code, 'note', e.target.value)}
                          disabled={locked}
                          sx={{ width: 160 }}
                        />
                      </TableCell>
                      <TableCell align="right">{vnd(row.payslip.gross)}</TableCell>
                      <TableCell align="right">{vnd(row.payslip.insuranceEmployee.total)}</TableCell>
                      <TableCell align="right" title={row.payslip.pit.overridden ? 'Thuế nhập tay' : undefined}>
                        {vnd(row.payslip.pit.amount)}
                        {row.payslip.pit.overridden && ' ✎'}
                      </TableCell>
                      <TableCell align="right">
                        <b>{vnd(row.payslip.net)}</b>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {dirtyCount > 0 && (
            <Alert severity="warning">
              {dirtyCount} nhân viên có số liệu chưa lưu — các cột tiền đang hiển thị số cũ, bấm <b>Lưu</b> để tính lại.
            </Alert>
          )}
        </>
      )}

      <PayslipDialog row={slip} month={period?.month ?? ''} onClose={() => setSlip(null)} />
    </Box>
  );
}

function metricsOf(c: PeriodRow['employee']['components'][number]): string[] {
  switch (c.kind) {
    case 'qty_rate':
    case 'percent':
    case 'kpi_base':
      return [c.metric];
    case 'live_hours':
      return ['liveHours', 'nightHours', 'sundayHours', 'holidayHours'];
    default:
      return [];
  }
}
