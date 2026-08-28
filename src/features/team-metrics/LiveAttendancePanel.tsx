import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { authFetch } from '../../lib/authFetch';
import { useAuth } from '../../context/AuthContext';

type EmployeeLiveReport = {
  employeeName: string;
  totalHours: number;
  sessionCount: number;
  lateCount: number;
  underMinDurationCount: number;
  byPlatform: { tiktok: number; facebook: number };
};

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LiveAttendancePanel() {
  const { user, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<Record<string, unknown> | null>(null);

  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<EmployeeLiveReport[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  async function fetchReport() {
    if (!user) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await authFetch(`/team-metrics/live/report?from=${from}&to=${to}`, user.token, logout);
      if (!res) return;
      const data = (await res.json()) as { report?: EmployeeLiveReport[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Yêu cầu thất bại.');
      setReport(data.report ?? []);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setReportLoading(false);
    }
  }

  async function handleUpload() {
    if (!user || !file) return;
    setUploading(true);
    setUploadError(null);
    setUploadSummary(null);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('referenceDate', from);
      const res = await authFetch('/team-metrics/live/upload-tiktok', user.token, logout, {
        method: 'POST',
        body,
      });
      if (!res) return;
      const data = (await res.json()) as { summary?: Record<string, unknown>; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload thất bại.');
      setUploadSummary(data.summary ?? null);
      await fetchReport();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Team Live — giờ live &amp; trễ giờ
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Kết hợp lịch phân công trên Google Drive (tự động) + giờ live thật từ Facebook (tự động qua API) +
        báo cáo TikTok (upload file Excel export từ Seller Center, vì TikTok không có API).
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3, flexWrap: 'wrap' }}>
        <Button component="label" variant="outlined">
          {file ? file.name : 'Chọn file TikTok (.xlsx)'}
          <input
            type="file"
            hidden
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </Button>
        <Button variant="contained" onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? <CircularProgress size={20} /> : 'Tải lên & tính'}
        </Button>
      </Box>

      {uploadError && <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>}
      {uploadSummary && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Khớp được {String(uploadSummary.matched)} phiên. Không có lịch: {String(uploadSummary.noSchedule)}.
          Lệch quá xa (bỏ qua): {String(uploadSummary.unmatched)}.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Từ ngày"
          type="date"
          size="small"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          size="small"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <Button variant="outlined" onClick={fetchReport} disabled={reportLoading}>
          {reportLoading ? <CircularProgress size={20} /> : 'Xem báo cáo'}
        </Button>
      </Box>

      {reportError && <Alert severity="error" sx={{ mb: 2 }}>{reportError}</Alert>}

      {report && (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nhân viên</TableCell>
                <TableCell>Tổng giờ live</TableCell>
                <TableCell>TikTok</TableCell>
                <TableCell>Facebook</TableCell>
                <TableCell>Số phiên</TableCell>
                <TableCell>Số lần trễ</TableCell>
                <TableCell>Số phiên thiếu thời lượng</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>Chưa có dữ liệu trong khoảng ngày này.</TableCell>
                </TableRow>
              )}
              {report.map((r) => (
                <TableRow key={r.employeeName}>
                  <TableCell>{r.employeeName}</TableCell>
                  <TableCell>{r.totalHours}h</TableCell>
                  <TableCell>{r.byPlatform.tiktok}h</TableCell>
                  <TableCell>{r.byPlatform.facebook}h</TableCell>
                  <TableCell>{r.sessionCount}</TableCell>
                  <TableCell>{r.lateCount}</TableCell>
                  <TableCell>{r.underMinDurationCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
