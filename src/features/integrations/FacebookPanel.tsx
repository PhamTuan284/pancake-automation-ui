import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Link from '@mui/material/Link';
import { authFetch } from '../../lib/authFetch';
import { useAuth } from '../../context/AuthContext';

type FbLiveVideo = {
  id: string;
  status?: string;
  title?: string;
  description?: string;
  creation_time?: string;
  broadcast_start_time?: string;
  permalink_url?: string;
  live_views?: number;
  video?: { id?: string; length?: number; picture?: string };
};

function formatVnTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
}

function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || Number.isNaN(seconds)) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m${String(s).padStart(2, '0')}s`;
}

/** Test panel for the Facebook Graph API integration (env-configured FB_PAGE_ID / FB_PAGE_ACCESS_TOKEN). */
export function FacebookPanel() {
  const { user, logout } = useAuth();
  const [videos, setVideos] = useState<FbLiveVideo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/facebook/live-videos', user.token, logout);
      if (!res) return;
      const data = (await res.json()) as { videos?: FbLiveVideo[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Yêu cầu thất bại.');
      setVideos(data.videos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Facebook Live Video API
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gọi backend <code>/facebook/live-videos</code>, backend gọi Graph API bằng
        FB_PAGE_ID/FB_PAGE_ACCESS_TOKEN cấu hình trong .env.
      </Typography>
      <Button variant="contained" onClick={handleFetch} disabled={loading}>
        {loading ? <CircularProgress size={20} /> : 'Lấy danh sách live video'}
      </Button>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {videos && (
        <>
          <Alert severity="info" sx={{ mt: 3 }}>
            <b>Trạng thái:</b> <code>LIVE</code> = video đang phát trực tiếp tại thời điểm gọi API;{' '}
            <code>VOD</code> (Video On Demand) = live đã kết thúc, chỉ còn bản ghi phát lại.
            <br />
            <b>"Tạo lúc" sớm hơn "Bắt đầu":</b> <code>creation_time</code> là lúc Facebook tạo phiên
            live (ngay khi phần mềm live bắt đầu kết nối stream), còn <code>broadcast_start_time</code>{' '}
            là lúc stream chính thức phát tới người xem — độ lệch vài chục giây đến vài phút là bình
            thường, đó là thời gian kết nối/chuẩn bị trước khi lên sóng thật. Nên dùng{' '}
            <b>"Bắt đầu"</b> làm giờ live thực tế khi đối chiếu lịch phân công.
            <br />
            <b>Thời lượng:</b> lấy từ video đã lưu (VOD) — video đang <code>LIVE</code> chưa có giá trị
            này vì chưa kết thúc. <b>Lượt xem</b> chỉ là số người xem tại thời điểm gọi API (với phiên
            đã kết thúc, đây thường là số cuối cùng trước khi kết thúc), không phải tổng lượt xem tích
            lũy.
          </Alert>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ mt: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Tiêu đề</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell>Bắt đầu (giờ VN)</TableCell>
                  <TableCell>Tạo lúc (giờ VN)</TableCell>
                  <TableCell>Thời lượng</TableCell>
                  <TableCell>Lượt xem</TableCell>
                  <TableCell>Link</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {videos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>Không có dữ liệu trả về.</TableCell>
                  </TableRow>
                )}
                {videos.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{v.id}</TableCell>
                    <TableCell>{v.title ?? ''}</TableCell>
                    <TableCell>{v.status ?? ''}</TableCell>
                    <TableCell>{formatVnTime(v.broadcast_start_time)}</TableCell>
                    <TableCell>{formatVnTime(v.creation_time)}</TableCell>
                    <TableCell>{formatDuration(v.video?.length)}</TableCell>
                    <TableCell>{v.live_views ?? ''}</TableCell>
                    <TableCell>
                      {v.permalink_url && (
                        <Link href={`https://facebook.com${v.permalink_url}`} target="_blank" rel="noreferrer">
                          Xem
                        </Link>
                      )}
                    </TableCell>
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
