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

type EmployeeOfficeReport = {
  employeeName: string;
  daysRecorded: number;
  lateCount: number;
  totalLateMinutes: number;
  earlyLeaveCount: number;
  totalEarlyLeaveMinutes: number;
};

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OfficeAttendancePanel() {
  const { user, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadOk, setUploadOk] = useState(false);

  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());
  const [report, setReport] = useState<EmployeeOfficeReport[] | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  async function fetchReport() {
    if (!user) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await authFetch(`/team-metrics/office/report?from=${from}&to=${to}`, user.token, logout);
      if (!res) return;
      const data = (await res.json()) as { report?: EmployeeOfficeReport[]; error?: string };
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
    setUploadOk(false);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await authFetch('/team-metrics/office/upload', user.token, logout, {
        method: 'POST',
        body,
      });
      if (!res) return;
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload thất bại.');
      setUploadOk(true);
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
        Team Office — đi trễ / về sớm
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        So giờ vào/ra thực tế (từ máy chấm công) với giờ chuẩn đặt ở Admin → Giờ làm chuẩn, hoặc với đơn
        "Đi làm khác giờ chuẩn" đã duyệt nếu nhân viên có xin phép ngày đó.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3, flexWrap: 'wrap' }}>
        <Button component="label" variant="outlined">
          {file ? file.name : 'Chọn file chấm công (.xlsx)'}
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
      {uploadOk && <Alert severity="success" sx={{ mb: 2 }}>Đã tính và lưu kết quả.</Alert>}

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
                <TableCell>Số ngày có dữ liệu</TableCell>
                <TableCell>Số lần đi trễ</TableCell>
                <TableCell>Tổng phút trễ</TableCell>
                <TableCell>Số lần về sớm</TableCell>
                <TableCell>Tổng phút về sớm</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {report.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>Chưa có dữ liệu trong khoảng ngày này.</TableCell>
                </TableRow>
              )}
              {report.map((r) => (
                <TableRow key={r.employeeName}>
                  <TableCell>{r.employeeName}</TableCell>
                  <TableCell>{r.daysRecorded}</TableCell>
                  <TableCell>{r.lateCount}</TableCell>
                  <TableCell>{r.totalLateMinutes}</TableCell>
                  <TableCell>{r.earlyLeaveCount}</TableCell>
                  <TableCell>{r.totalEarlyLeaveMinutes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
