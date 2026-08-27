import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import { authFetch } from '../../lib/authFetch';
import { useAuth, type AuthUser } from '../../context/AuthContext';

type AuditLogEntry = {
  id: string;
  username: string;
  action: string;
  details: string;
  createdAt: string;
};

const ACTION_LABEL: Record<string, string> = {
  login: 'Đăng nhập',
  change_own_password: 'Đổi mật khẩu',
  create_user: 'Tạo người dùng',
  update_user: 'Cập nhật người dùng',
  delete_user: 'Xóa người dùng',
  update_settings: 'Cập nhật phân quyền / cài đặt',
  leave_request: 'Đăng ký nghỉ phép',
  leave_approve: 'Duyệt đơn nghỉ phép',
  leave_reject: 'Từ chối đơn nghỉ phép',
  leave_cancel: 'Hủy đơn nghỉ phép',
};

const ACTION_COLOR: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  login: 'default',
  change_own_password: 'warning',
  create_user: 'primary',
  update_user: 'primary',
  delete_user: 'error',
  update_settings: 'primary',
  leave_request: 'default',
  leave_approve: 'success',
  leave_reject: 'error',
  leave_cancel: 'warning',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN');
}

export function ActivityLog({ token }: { token: AuthUser['token'] }) {
  const { logout } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/admin/audit-log', token, logout);
      if (!res) return;
      const data = (await res.json()) as { logs?: AuditLogEntry[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Không thể tải nhật ký hoạt động.');
      setLogs(data.logs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Nhật ký hoạt động</Typography>
        <IconButton size="small" onClick={() => void fetchLogs()} disabled={loading}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lịch sử đăng nhập, đổi mật khẩu, quản lý người dùng, phân quyền và nghỉ phép — chỉ Admin xem được.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Thời gian</TableCell>
              <TableCell>Người dùng</TableCell>
              <TableCell>Hành động</TableCell>
              <TableCell>Chi tiết</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Chưa có hoạt động nào được ghi nhận.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.createdAt)}</TableCell>
                <TableCell>{log.username}</TableCell>
                <TableCell>
                  <Chip
                    label={ACTION_LABEL[log.action] ?? log.action}
                    size="small"
                    color={ACTION_COLOR[log.action] ?? 'default'}
                  />
                </TableCell>
                <TableCell>{log.details || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
