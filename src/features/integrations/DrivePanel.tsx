import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { authFetch } from '../../lib/authFetch';
import { useAuth } from '../../context/AuthContext';

/** Test panel for the Google Drive API integration (env-configured service account + file ID). */
export function DrivePanel() {
  const { user, logout } = useAuth();
  const [sheetNames, setSheetNames] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/drive/schedule-sheets', user.token, logout);
      if (!res) return;
      const data = (await res.json()) as { sheetNames?: string[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Yêu cầu thất bại.');
      setSheetNames(data.sheetNames ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Google Drive API — lịch phân công
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gọi backend <code>/drive/schedule-sheets</code>, backend dùng Service Account đọc file trên Drive
        (GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY/GOOGLE_DRIVE_FILE_ID trong .env) và trả về tên các sheet
        (mỗi sheet = 1 tuần lịch).
      </Typography>
      <Button variant="contained" onClick={handleFetch} disabled={loading}>
        {loading ? <CircularProgress size={20} /> : 'Lấy danh sách sheet'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {sheetNames && (
        <Alert severity={sheetNames.length ? 'success' : 'warning'} sx={{ mt: 2 }}>
          {sheetNames.length
            ? `Đọc được ${sheetNames.length} sheet: ${sheetNames.join(', ')}`
            : 'File không có sheet nào.'}
        </Alert>
      )}
    </Box>
  );
}
