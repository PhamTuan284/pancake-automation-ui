import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type { PayrollApi } from './payrollApi';
import { parseNumberText, type InsuranceRates, type PayrollSettings } from './payrollTypes';

type Props = {
  api: PayrollApi;
  settings: PayrollSettings;
  onSaved: (s: PayrollSettings) => void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
};

/** Every field is edited as text; rates are shown in % (8 = 8%). Keys are dotted paths into PayrollSettings. */
type Form = Record<string, string>;

const RATE_KEYS: (keyof InsuranceRates)[] = ['bhxh', 'bhyt', 'bhtn', 'union'];
const RATE_LABELS: Record<keyof InsuranceRates, string> = { bhxh: 'BHXH', bhyt: 'BHYT', bhtn: 'BHTN', union: 'Công đoàn / đoàn phí' };
const pct = (n: number) => String(+(n * 100).toFixed(4));

function toForm(s: PayrollSettings): { form: Form; brackets: { upTo: string; rate: string }[] } {
  const form: Form = {
    'pit.personalDeduction': String(s.pit.personalDeduction),
    'pit.dependentDeduction': String(s.pit.dependentDeduction),
    'pit.ctvThreshold': String(s.pit.ctvThreshold),
    'pit.ctvRate': pct(s.pit.ctvRate),
    'live.nightMultiplier': String(s.live.nightMultiplier),
    'live.sundayBonusPct': pct(s.live.sundayBonusPct),
    'live.holidayMultiplier': String(s.live.holidayMultiplier),
  };
  for (const who of ['employee', 'company'] as const) {
    for (const k of RATE_KEYS) form[`insurance.${who}.${k}`] = pct(s.insurance[who][k]);
  }
  return { form, brackets: s.pit.brackets.map((b) => ({ upTo: b.upTo === null ? '' : String(b.upTo), rate: pct(b.rate) })) };
}

export function SettingsTab({ api, settings, onSaved, onError, onNotice }: Props) {
  const [form, setForm] = useState<Form>({});
  const [brackets, setBrackets] = useState<{ upTo: string; rate: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const f = toForm(settings);
    setForm(f.form);
    setBrackets(f.brackets);
  }, [settings]);

  function value(key: string, asPct = false): number {
    const n = parseNumberText(form[key] ?? '');
    if (n === null) throw new Error(`Giá trị "${form[key]}" không phải số.`);
    return asPct ? n / 100 : n;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const rates = (who: 'employee' | 'company') =>
        Object.fromEntries(RATE_KEYS.map((k) => [k, value(`insurance.${who}.${k}`, true)])) as InsuranceRates;
      const next: PayrollSettings = {
        insurance: { employee: rates('employee'), company: rates('company') },
        pit: {
          personalDeduction: value('pit.personalDeduction'),
          dependentDeduction: value('pit.dependentDeduction'),
          brackets: brackets.map((b) => ({
            upTo: b.upTo.trim() === '' ? null : parseNumberText(b.upTo),
            rate: (parseNumberText(b.rate) ?? 0) / 100,
          })),
          ctvThreshold: value('pit.ctvThreshold'),
          ctvRate: value('pit.ctvRate', true),
        },
        live: {
          nightMultiplier: value('live.nightMultiplier'),
          sundayBonusPct: value('live.sundayBonusPct', true),
          holidayMultiplier: value('live.holidayMultiplier'),
        },
      };
      const data = await api.saveSettings(next);
      if (data) {
        onSaved(data.settings);
        onNotice('Đã lưu cài đặt. Kỳ lương nháp cần bấm "Áp cài đặt mới" để dùng tỷ lệ mới.');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không thể lưu cài đặt.');
    } finally {
      setSaving(false);
    }
  }

  const field = (key: string, label: string) => (
    <TextField
      key={key}
      size="small"
      label={label}
      value={form[key] ?? ''}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      slotProps={{ htmlInput: { inputMode: 'decimal' } }}
    />
  );
  const grid = { display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' }, gap: 2 } as const;

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 900 }}>
      <Box>
        <Typography variant="subtitle1" gutterBottom>Bảo hiểm – người lao động đóng (%)</Typography>
        <Box sx={grid}>{RATE_KEYS.map((k) => field(`insurance.employee.${k}`, RATE_LABELS[k]))}</Box>
      </Box>
      <Box>
        <Typography variant="subtitle1" gutterBottom>Bảo hiểm – công ty đóng (%)</Typography>
        <Box sx={grid}>{RATE_KEYS.map((k) => field(`insurance.company.${k}`, RATE_LABELS[k]))}</Box>
      </Box>
      <Box>
        <Typography variant="subtitle1" gutterBottom>Thuế TNCN</Typography>
        <Box sx={grid}>
          {field('pit.personalDeduction', 'Giảm trừ bản thân (đ)')}
          {field('pit.dependentDeduction', 'Giảm trừ / người phụ thuộc (đ)')}
          {field('pit.ctvThreshold', 'CTV: khấu trừ khi thu nhập từ (đ)')}
          {field('pit.ctvRate', 'CTV: tỷ lệ khấu trừ (%)')}
        </Box>
        <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
          Biểu thuế lũy tiến (HĐLĐ) — để trống "đến" ở bậc cuối:
        </Typography>
        {brackets.map((b, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'center' }}>
            <Typography variant="body2" sx={{ width: 50 }}>Bậc {i + 1}</Typography>
            <TextField
              size="small"
              label="Thu nhập tính thuế đến (đ)"
              value={b.upTo}
              onChange={(e) => setBrackets((bs) => bs.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)))}
            />
            <TextField
              size="small"
              label="Thuế suất (%)"
              value={b.rate}
              onChange={(e) => setBrackets((bs) => bs.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))}
              sx={{ width: 130 }}
            />
            <IconButton aria-label="Xóa bậc" size="small" onClick={() => setBrackets((bs) => bs.filter((_, j) => j !== i))}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
        <Button size="small" startIcon={<AddIcon />} onClick={() => setBrackets((bs) => [...bs, { upTo: '', rate: '' }])}>
          Thêm bậc
        </Button>
      </Box>
      <Box>
        <Typography variant="subtitle1" gutterBottom>Livestream</Typography>
        <Box sx={grid}>
          {field('live.nightMultiplier', 'Hệ số giờ đêm (× đơn giá)')}
          {field('live.sundayBonusPct', 'Thưởng chủ nhật (% đơn giá)')}
          {field('live.holidayMultiplier', 'Hệ số ngày lễ (× đơn giá)')}
        </Box>
      </Box>
      <Box>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          Lưu cài đặt
        </Button>
      </Box>
    </Box>
  );
}
