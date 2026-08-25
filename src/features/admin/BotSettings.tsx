import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { apiUrl } from '../../lib/api';
import { useAuth, type AuthUser } from '../../context/AuthContext';

const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

type BotEnabled = { zalo: boolean };

type Props = {
  token: AuthUser['token'];
  botEnabled: BotEnabled;
  onSaved: (updated: BotEnabled) => void;
};

export function BotSettings({ token, botEnabled, onSaved }: Props) {
  const { logout } = useAuth();
  const [enabled, setEnabled] = useState<BotEnabled>(botEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(apiUrl('/admin/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ botEnabled: enabled }),
      });
      if (res.status === 401) {
        logout(SESSION_EXPIRED_MESSAGE);
        return;
      }
      const data = (await res.json()) as { botEnabled?: BotEnabled; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Lưu thất bại.');
      onSaved(data.botEnabled ?? enabled);
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
        Bật / Tắt Bot
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Khi tắt, bot sẽ không gửi báo cáo tự động theo lịch hàng ngày.
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <FormControlLabel
        sx={{ display: 'flex', mb: 1 }}
        control={
          <Switch
            checked={enabled.zalo}
            onChange={(e) => setEnabled((prev) => ({ ...prev, zalo: e.target.checked }))}
          />
        }
        label="Zalo Bot – Báo cáo biến thể bán chạy"
      />

      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
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
