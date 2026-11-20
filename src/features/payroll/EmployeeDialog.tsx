import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import {
  GROUP_LABELS,
  KIND_LABELS,
  parseNumberText,
  type PayComponent,
  type PayComponentKind,
  type PayGroup,
  type PayrollEmployee,
} from './payrollTypes';
import type { TaskUser } from '../../types';

/**
 * Numbers are edited as text so "1.5" or an empty field don't fight the
 * input; percentages are shown ×100 (1 = 1%).
 */
type FormComponent = { kind: PayComponentKind; id: string; label: string; fields: Record<string, string>; taxExempt: boolean };

const PCT_FIELDS = new Set(['pct', 'weight']);

const KIND_FIELDS: Record<PayComponentKind, { key: string; label: string }[]> = {
  qty_rate: [
    { key: 'rate', label: 'Đơn giá (đ)' },
    { key: 'max', label: 'Tối đa (đ) – trống = không giới hạn' },
  ],
  fixed: [{ key: 'amount', label: 'Số tiền / tháng (đ)' }],
  percent: [
    { key: 'pct', label: 'Tỷ lệ (%)' },
    { key: 'weight', label: 'Tỷ trọng (%) – để trống = 100%' },
    { key: 'threshold', label: 'Chỉ tính khi doanh thu > (đ)' },
  ],
  kpi_base: [
    { key: 'baseAmount', label: 'Lương KPI (đ)' },
    { key: 'includedQty', label: 'Số lượng trong KPI' },
    { key: 'overRate', label: 'Đơn giá vượt KPI (đ)' },
  ],
  live_hours: [
    { key: 'rate', label: 'Đơn giá / giờ (đ)' },
    { key: 'standardAmount', label: 'Lương tiêu chuẩn HĐLĐ (đ) – thường = mức đóng BH' },
  ],
};

const HAS_METRIC = new Set<PayComponentKind>(['qty_rate', 'percent', 'kpi_base']);
const HAS_GROUP = new Set<PayComponentKind>(['qty_rate', 'fixed', 'percent', 'kpi_base']);
const CAN_EXEMPT = new Set<PayComponentKind>(['qty_rate', 'fixed']);

function toForm(c: PayComponent): FormComponent {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(c)) {
    if (['kind', 'id', 'label', 'taxExempt'].includes(k) || v === undefined) continue;
    fields[k] = typeof v === 'number' && PCT_FIELDS.has(k) ? String(+(v * 100).toFixed(6)) : String(v);
  }
  return { kind: c.kind, id: c.id, label: c.label, fields, taxExempt: 'taxExempt' in c && Boolean(c.taxExempt) };
}

/** Throws with a readable message when a number field holds garbage. */
function fromForm(f: FormComponent): PayComponent {
  const out: Record<string, unknown> = { kind: f.kind, id: f.id, label: f.label };
  for (const [k, raw] of Object.entries(f.fields)) {
    if (k === 'metric' || k === 'group') {
      out[k] = raw;
      continue;
    }
    if (raw.trim() === '') continue;
    const n = parseNumberText(raw);
    if (n === null) throw new Error(`"${f.label}": "${raw}" không phải số.`);
    out[k] = PCT_FIELDS.has(k) ? n / 100 : n;
  }
  if (f.taxExempt && CAN_EXEMPT.has(f.kind)) out.taxExempt = true;
  return out as PayComponent;
}

const EMPTY: PayrollEmployee = {
  code: '',
  fullName: '',
  team: '',
  position: '',
  contractType: 'ctv',
  insuranceBase: 0,
  taxCode: '',
  idNumber: '',
  dependents: 0,
  username: '',
  payNote: '',
  components: [],
  isActive: true,
};

type Props = {
  open: boolean;
  employee: PayrollEmployee | null;
  teams: string[];
  metricLabels: Record<string, string>;
  users: TaskUser[];
  onClose: () => void;
  onSave: (employee: PayrollEmployee) => Promise<void>;
};

export function EmployeeDialog({ open, employee, teams, metricLabels, users, onClose, onSave }: Props) {
  const [form, setForm] = useState<PayrollEmployee>(EMPTY);
  const [components, setComponents] = useState<FormComponent[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const base = employee ?? EMPTY;
    setForm(base);
    setComponents(base.components.map(toForm));
    setError(null);
  }, [open, employee]);

  const metricOptions = Object.keys(metricLabels);
  const set = <K extends keyof PayrollEmployee>(key: K, value: PayrollEmployee[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setComp = (i: number, patch: Partial<FormComponent>) =>
    setComponents((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setField = (i: number, key: string, value: string) =>
    setComponents((cs) => cs.map((c, j) => (j === i ? { ...c, fields: { ...c.fields, [key]: value } } : c)));

  function addComponent() {
    const n = components.length + 1;
    setComponents((cs) => [
      ...cs,
      { kind: 'qty_rate', id: `k${Date.now().toString(36)}`, label: `Khoản ${n}`, fields: { metric: 'workDays', group: 'performance' }, taxExempt: false },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // fromForm throws on a malformed number; the catch below shows it.
      await onSave({ ...form, components: components.map(fromForm) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể lưu.');
    } finally {
      setSaving(false);
    }
  }

  const num = (v: string) => parseNumberText(v) ?? 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{employee ? `Sửa ${employee.code} – ${employee.fullName}` : 'Thêm nhân viên'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
          <TextField size="small" label="Mã nhân viên (như file Excel)" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} required />
          <TextField size="small" label="Họ và tên" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
          <TextField select size="small" label="Team" value={form.team} onChange={(e) => set('team', e.target.value)}>
            <MenuItem value="">(chưa xếp)</MenuItem>
            {teams.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Vị trí công việc" value={form.position} onChange={(e) => set('position', e.target.value)} />
          <TextField select size="small" label="Loại hợp đồng" value={form.contractType} onChange={(e) => set('contractType', e.target.value as PayrollEmployee['contractType'])}>
            <MenuItem value="hdld">HĐLĐ (đóng BH, thuế lũy tiến)</MenuItem>
            <MenuItem value="ctv">CTV (khấu trừ 10%)</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Mức đóng BH (đ)"
            value={form.insuranceBase || ''}
            disabled={form.contractType !== 'hdld'}
            onChange={(e) => set('insuranceBase', num(e.target.value))}
          />
          <TextField size="small" label="Mã số thuế" value={form.taxCode} onChange={(e) => set('taxCode', e.target.value)} />
          <TextField size="small" label="CMT/CCCD" value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} />
          <TextField size="small" label="Số người phụ thuộc" value={form.dependents || ''} onChange={(e) => set('dependents', num(e.target.value))} />
          <TextField select size="small" label="Tài khoản MeiT Tools" value={form.username} onChange={(e) => set('username', e.target.value)}>
            <MenuItem value="">(không liên kết)</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.username} value={u.username}>{u.fullName || u.username} ({u.username})</MenuItem>
            ))}
          </TextField>
          <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label="Đang làm việc" />
        </Box>
        <TextField
          size="small"
          label="Cách tính lương (ghi chú)"
          value={form.payNote}
          onChange={(e) => set('payNote', e.target.value)}
          multiline
          minRows={2}
          fullWidth
          sx={{ mt: 2 }}
        />

        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
          Công thức lương
        </Typography>
        {components.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Chưa có khoản nào. Thêm từng khoản, ví dụ: giờ live × đơn giá, số công × lương ngày, % doanh thu FB, phí cố định…
          </Typography>
        )}
        {components.map((c, i) => (
          <Box key={c.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5, mb: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.3fr 1.6fr 1.3fr auto' }, gap: 1.5, alignItems: 'center' }}>
              <TextField
                select
                size="small"
                label="Loại"
                value={c.kind}
                onChange={(e) => {
                  const kind = e.target.value as PayComponentKind;
                  setComp(i, { kind, fields: { metric: c.fields.metric ?? 'workDays', group: c.fields.group ?? 'performance' } });
                }}
              >
                {(Object.keys(KIND_LABELS) as PayComponentKind[]).map((k) => (
                  <MenuItem key={k} value={k}>{KIND_LABELS[k]}</MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Tên khoản" value={c.label} onChange={(e) => setComp(i, { label: e.target.value })} />
              {HAS_GROUP.has(c.kind) ? (
                <TextField select size="small" label="Nhóm (cột bảng lương)" value={c.fields.group ?? 'performance'} onChange={(e) => setField(i, 'group', e.target.value)}>
                  {(Object.keys(GROUP_LABELS) as PayGroup[]).map((g) => (
                    <MenuItem key={g} value={g}>{GROUP_LABELS[g]}</MenuItem>
                  ))}
                </TextField>
              ) : (
                <span />
              )}
              <IconButton aria-label="Xóa khoản" onClick={() => setComponents((cs) => cs.filter((_, j) => j !== i))}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5, mt: 1.5 }}>
              {HAS_METRIC.has(c.kind) && (
                <Autocomplete
                  freeSolo
                  size="small"
                  options={metricOptions}
                  getOptionLabel={(o) => (metricLabels[o] ? `${metricLabels[o]} (${o})` : o)}
                  value={c.fields.metric ?? ''}
                  onChange={(_e, v) => setField(i, 'metric', v ?? '')}
                  onInputChange={(_e, v, reason) => reason === 'input' && setField(i, 'metric', v)}
                  renderInput={(params) => <TextField {...params} label={c.kind === 'percent' ? 'Doanh thu tính %' : 'Chỉ số số lượng'} />}
                />
              )}
              {KIND_FIELDS[c.kind].map((f) => (
                <TextField
                  key={f.key}
                  size="small"
                  label={f.label}
                  value={c.fields[f.key] ?? ''}
                  onChange={(e) => setField(i, f.key, e.target.value)}
                  slotProps={{ htmlInput: { inputMode: 'decimal' } }}
                />
              ))}
              {CAN_EXEMPT.has(c.kind) && (
                <FormControlLabel
                  control={<Checkbox checked={c.taxExempt} onChange={(e) => setComp(i, { taxExempt: e.target.checked })} />}
                  label="Miễn thuế TNCN"
                />
              )}
            </Box>
            {c.kind === 'live_hours' && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                Nhập hàng tháng: giờ live (không gồm lễ), giờ live đêm, giờ chủ nhật, giờ ngày lễ. Hệ số đêm / chủ nhật / lễ lấy ở tab Cài đặt.
              </Typography>
            )}
          </Box>
        ))}
        <Button startIcon={<AddIcon />} onClick={addComponent}>
          Thêm khoản lương
        </Button>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Hủy</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || !form.code}>
          Lưu
        </Button>
      </DialogActions>
    </Dialog>
  );
}
