import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
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

type MatchedSession = {
  platform: 'tiktok' | 'facebook';
  sessionId: string;
  date: string;
  employeeNames: string[];
  scheduledSlotLabel: string;
  scheduledStart: string;
  actualStart: string;
  actualEnd: string;
  durationMinutes: number;
  lateMinutes: number;
  underMinDuration: boolean;
};

type ErrorSession = {
  platform: 'tiktok' | 'facebook';
  sessionId: string;
  actualStart: string;
  actualEnd: string;
  reason: 'no_schedule' | 'too_far_off';
};

type UploadSummary = {
  matched: number;
  noSchedule: number;
  unmatched: number;
  sessions: MatchedSession[];
  errorSessions: ErrorSession[];
  employeeReport: EmployeeLiveReport[];
};

const ERROR_REASON_LABEL: Record<ErrorSession['reason'], string> = {
  no_schedule: 'Không có lịch ngày này',
  too_far_off: 'Lệch quá xa mọi ca (bỏ qua)',
};

function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function formatVnTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}

export function LiveAttendancePanel() {
  const { user, logout } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);

  const [from, setFrom] = useState(firstDayOfMonth());

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
      const data = (await res.json()) as { summary?: UploadSummary; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Upload thất bại.');
      setUploadSummary(data.summary ?? null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Team Live — giờ live &amp; trễ giờ
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Kết hợp lịch phân công trên Google Drive (tự động) + giờ live thật từ Facebook (tự động qua API) +
        báo cáo TikTok (upload file Excel export từ Seller Center, vì TikTok không có API).
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Đang ở chế độ tạm thời: chỉ tính và hiển thị kết quả, <b>chưa lưu vào database</b>. Mỗi lần bấm
        "Tải lên & tính" là 1 lần tính độc lập, tải lại trang sẽ mất kết quả.
      </Alert>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="Ngày tham chiếu (xác định năm của lịch phân công)"
          type="date"
          size="small"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 260 }}
        />
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
        <>
          <Alert severity="success" sx={{ mb: 3 }}>
            Khớp được {uploadSummary.matched} phiên. Không có lịch: {uploadSummary.noSchedule}. Lệch quá xa
            (bỏ qua): {uploadSummary.unmatched}.
          </Alert>

          <Typography variant="subtitle1" gutterBottom>
            Từng phiên live vừa tính ({uploadSummary.sessions.length})
          </Typography>
          <Box sx={{ overflowX: 'auto', mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nền tảng</TableCell>
                  <TableCell>Nhân viên (ca)</TableCell>
                  <TableCell>Ca theo lịch</TableCell>
                  <TableCell>Bắt đầu thực tế</TableCell>
                  <TableCell>Kết thúc thực tế</TableCell>
                  <TableCell>Thời lượng</TableCell>
                  <TableCell>Trễ (phút)</TableCell>
                  <TableCell>Thiếu thời lượng?</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {uploadSummary.sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>Không có phiên nào khớp được lịch.</TableCell>
                  </TableRow>
                )}
                {uploadSummary.sessions.map((s) => (
                  <TableRow key={`${s.platform}-${s.sessionId}`}>
                    <TableCell>{s.platform === 'tiktok' ? 'TikTok' : 'Facebook'}</TableCell>
                    <TableCell>{s.employeeNames.join(', ')}</TableCell>
                    <TableCell>
                      {s.scheduledSlotLabel} ({s.scheduledStart})
                    </TableCell>
                    <TableCell>{formatVnTime(s.actualStart)}</TableCell>
                    <TableCell>{formatVnTime(s.actualEnd)}</TableCell>
                    <TableCell>{Math.round(s.durationMinutes)}p</TableCell>
                    <TableCell>{s.lateMinutes > 0 ? s.lateMinutes : '—'}</TableCell>
                    <TableCell>{s.underMinDuration ? 'Có' : ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {uploadSummary.errorSessions.length > 0 && (
            <>
              <Typography variant="subtitle1" gutterBottom>
                Phiên lỗi — không tính được ({uploadSummary.errorSessions.length})
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                "Không có lịch ngày này" = ngày đó chưa có tab tuần tương ứng trong file phân công trên Drive.
                "Lệch quá xa mọi ca" = giờ bắt đầu thực tế cách xa mọi ca đã phân công (có thể không phải live
                thật, hoặc lịch phân công sai).
              </Typography>
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Nền tảng</TableCell>
                      <TableCell>ID phiên</TableCell>
                      <TableCell>Bắt đầu thực tế</TableCell>
                      <TableCell>Kết thúc thực tế</TableCell>
                      <TableCell>Lý do</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {uploadSummary.errorSessions.map((s) => (
                      <TableRow key={`${s.platform}-${s.sessionId}`}>
                        <TableCell>{s.platform === 'tiktok' ? 'TikTok' : 'Facebook'}</TableCell>
                        <TableCell>{s.sessionId}</TableCell>
                        <TableCell>{formatVnTime(s.actualStart)}</TableCell>
                        <TableCell>{formatVnTime(s.actualEnd)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={s.reason === 'no_schedule' ? 'default' : 'warning'}
                            label={ERROR_REASON_LABEL[s.reason]}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </>
          )}
        </>
      )}

      {uploadSummary && (
        <>
          <Typography variant="subtitle1" sx={{ mt: 4, mb: 1 }}>
            Báo cáo theo nhân viên (từ lần tính này)
          </Typography>
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
                {uploadSummary.employeeReport.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>Không có phiên nào khớp được lịch.</TableCell>
                  </TableRow>
                )}
                {uploadSummary.employeeReport.map((r) => (
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
        </>
      )}
    </Box>
  );
}
