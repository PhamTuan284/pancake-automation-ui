import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { authFetch } from '../../lib/authFetch';
import { useAuth, type AuthUser } from '../../context/AuthContext';

type OfficeWorkHours = { checkIn: string; checkOut: string; graceMinutes: number };

type Props = {
  token: AuthUser['token'];
  officeWorkHours: OfficeWorkHours;
  liveMinSessionMinutes: number;
  onSaved: (updated: { officeWorkHours: OfficeWorkHours; liveMinSessionMinutes: number }) => void;
};

export function WorkHoursSettings({ token, officeWorkHours, liveMinSessionMinutes, onSaved }: Props) {
  const { logout } = useAuth();
  const [hours, setHours] = useState<OfficeWorkHours>(officeWorkHours);
  const [minSession, setMinSession] = useState(String(liveMinSessionMinutes));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await authFetch('/admin/settings', token, logout, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          officeWorkHours: hours,
          liveMinSessionMinutes: Number(minSession),
        }),
      });
      if (!res) return;
      const data = (await res.json()) as {
        officeWorkHours?: OfficeWorkHours;
        liveMinSessionMinutes?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Lưu thất bại.');
      onSaved({
        officeWorkHours: data.officeWorkHours ?? hours,
        liveMinSessionMinutes: data.liveMinSessionMinutes ?? Number(minSession),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Giờ làm chuẩn
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Áp dụng cho tab "Số liệu team" — dùng làm mốc so sánh khi tính đi trễ/về sớm (Team Office) và phiên
        live không đủ thời lượng (Team Live).
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Team Office
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <TextField
          label="Giờ vào chuẩn"
          type="time"
          value={hours.checkIn}
          onChange={(e) => setHours((h) => ({ ...h, checkIn: e.target.value }))}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Giờ ra chuẩn"
          type="time"
          value={hours.checkOut}
          onChange={(e) => setHours((h) => ({ ...h, checkOut: e.target.value }))}
          size="small"
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Số phút cho phép trễ (grace)"
          type="number"
          value={hours.graceMinutes}
          onChange={(e) => setHours((h) => ({ ...h, graceMinutes: Number(e.target.value) }))}
          size="small"
          slotProps={{ htmlInput: { min: 0 } }}
        />
      </Box>

      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Team Live
      </Typography>
      <Box sx={{ mb: 3 }}>
        <TextField
          label="Thời lượng live tối thiểu (phút)"
          type="number"
          value={minSession}
          onChange={(e) => setMinSession(e.target.value)}
          size="small"
          slotProps={{ htmlInput: { min: 0 } }}
          helperText="Phiên live ngắn hơn mức này sẽ bị đánh dấu 'không đủ thời lượng'."
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          Lưu thay đổi
        </Button>
        {success && <Alert severity="success" sx={{ py: 0 }}>Đã lưu.</Alert>}
        {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
      </Box>
    </Box>
  );
}
