import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import { authFetch } from '../../lib/authFetch';
import { useAuth } from '../../context/AuthContext';

type EasyInvoiceApiResult = { httpStatus: number; body: unknown; error?: string };

/** Test panel for the EasyInvoice (SoftDreams) e-invoice API (env-configured EASYINVOICE_*). */
export function EasyInvoicePanel() {
  const { user, logout } = useAuth();
  const [result, setResult] = useState<EasyInvoiceApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pattern, setPattern] = useState('');
  const [serial, setSerial] = useState('2C26MTT');
  const [ikey, setIkey] = useState('');

  async function callEndpoint(path: string, body?: Record<string, unknown>) {
    if (!user) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await authFetch(path, user.token, logout, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res) return;
      const data = (await res.json()) as EasyInvoiceApiResult;
      if (!res.ok) throw new Error(data.error ?? 'Yêu cầu thất bại.');
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        EasyInvoice (SoftDreams) API
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gọi backend <code>/easyinvoice/*</code>, backend ký request bằng EASYINVOICE_USERNAME/PASSWORD/
        TAXCODE trong .env và gọi thẳng API hóa đơn điện tử SoftDreams (api.softdreams.vn).
      </Typography>

      <Button variant="contained" onClick={() => callEndpoint('/easyinvoice/test-connection')} disabled={loading}>
        {loading ? <CircularProgress size={20} /> : 'Kiểm tra kết nối'}
      </Button>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 3 }}>
        <TextField label="Pattern (mẫu số)" size="small" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <TextField label="Serial (ký hiệu)" size="small" value={serial} onChange={(e) => setSerial(e.target.value)} />
        <TextField label="ikey" size="small" value={ikey} onChange={(e) => setIkey(e.target.value)} />
        <Button
          variant="outlined"
          disabled={loading || !pattern || !serial || !ikey}
          onClick={() => callEndpoint('/easyinvoice/check-status', { pattern, serial, ikey })}
        >
          Tra cứu trạng thái hóa đơn
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity={result.httpStatus >= 200 && result.httpStatus < 300 ? 'success' : 'warning'} sx={{ mt: 2 }}>
          <b>HTTP {result.httpStatus}</b>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '8px 0 0' }}>
            {JSON.stringify(result.body, null, 2)}
          </pre>
        </Alert>
      )}
    </Box>
  );
}
