import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { authFetch } from '../lib/authFetch';
import { useAuth } from '../context/AuthContext';

type Props = {
  open: boolean;
  onClose: () => void;
};

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

export function ChangePasswordDialog({ open, onClose }: Props) {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleClose() {
    setForm(EMPTY);
    setError(null);
    setSuccess(false);
    onClose();
  }

  async function handleSubmit() {
    if (!form.currentPassword || !form.newPassword) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    if (form.newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch('/admin/change-password', user?.token ?? '', logout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      if (!res) return;
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Đổi mật khẩu thất bại.');
      setSuccess(true);
      setForm(EMPTY);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Đổi mật khẩu</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        {success ? (
          <Alert severity="success">Đã đổi mật khẩu thành công.</Alert>
        ) : (
          <>
            <TextField
              label="Mật khẩu hiện tại"
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              autoComplete="current-password"
              fullWidth
              size="small"
            />
            <TextField
              label="Mật khẩu mới"
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              autoComplete="new-password"
              fullWidth
              size="small"
            />
            <TextField
              label="Xác nhận mật khẩu mới"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              autoComplete="new-password"
              fullWidth
              size="small"
            />
            {error && <Alert severity="error">{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>{success ? 'Đóng' : 'Hủy'}</Button>
        {!success && (
          <Button
            variant="contained"
            onClick={() => void handleSubmit()}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            Đổi mật khẩu
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
