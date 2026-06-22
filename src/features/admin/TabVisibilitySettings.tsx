import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { TOOLS } from '../../config/tools';
import { apiUrl } from '../../lib/api';
import type { AuthUser } from '../../context/AuthContext';

export type TabAccessLevel = 'guest' | 'user' | 'admin';

const ACCESS_OPTIONS: { value: TabAccessLevel; label: string }[] = [
  { value: 'guest', label: 'Tất cả (không cần đăng nhập)' },
  { value: 'user', label: 'Người dùng đã đăng nhập' },
  { value: 'admin', label: 'Chỉ Admin' },
];

type Props = {
  token: AuthUser['token'];
  tabAccess: Record<string, TabAccessLevel>;
  onSaved: (updated: Record<string, TabAccessLevel>) => void;
};

const ADMIN_TOOL_ID = 'admin';

export function TabVisibilitySettings({ token, tabAccess, onSaved }: Props) {
  const configurableTools = TOOLS.filter((t) => t.id !== ADMIN_TOOL_ID);

  const [access, setAccess] = useState<Record<string, TabAccessLevel>>(() => {
    const init: Record<string, TabAccessLevel> = {};
    for (const t of configurableTools) {
      init[t.id] = tabAccess[t.id] ?? 'guest';
    }
    return init;
  });
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
        body: JSON.stringify({ tabAccess: access }),
      });
      const data = (await res.json()) as { tabAccess?: Record<string, TabAccessLevel>; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Lưu thất bại.');
      onSaved(data.tabAccess ?? access);
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
        Phân quyền truy cập Tab
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Chọn vai trò tối thiểu cần có để xem từng tab. Tab Admin luôn hiển thị với tất cả (nhưng yêu cầu đăng nhập bên trong).
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Tab</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 280 }}>Vai trò được phép xem</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {configurableTools.map((tool) => (
            <TableRow key={tool.id} sx={{ '&:last-child td': { border: 0 } }}>
              <TableCell>
                {tool.label}
                {tool.disabled && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (Sắp có)
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <FormControl size="small" fullWidth>
                  <Select
                    value={access[tool.id] ?? 'guest'}
                    onChange={(e) =>
                      setAccess((prev) => ({
                        ...prev,
                        [tool.id]: e.target.value as TabAccessLevel,
                      }))
                    }
                  >
                    {ACCESS_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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
