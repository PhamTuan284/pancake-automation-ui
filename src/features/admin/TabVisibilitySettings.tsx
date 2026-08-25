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
import Chip from '@mui/material/Chip';
import { TOOLS } from '../../config/tools';
import { DEPARTMENTS } from '../../config/departments';
import { apiUrl } from '../../lib/api';
import { useAuth, type AuthUser } from '../../context/AuthContext';

const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

/** Sentinel meaning "any logged-in user, regardless of department". */
const ALL_VALUE = '*';
const ALL_LABEL = 'Tất cả phòng ban';

const DEPARTMENT_OPTIONS: { value: string; label: string }[] = [
  { value: ALL_VALUE, label: ALL_LABEL },
  ...DEPARTMENTS.map((d) => ({ value: d, label: d })),
];

type Props = {
  token: AuthUser['token'];
  tabAccess: Record<string, string[]>;
  onSaved: (updated: Record<string, string[]>) => void;
};

const ADMIN_TOOL_ID = 'admin';

export function TabVisibilitySettings({ token, tabAccess, onSaved }: Props) {
  const { logout } = useAuth();
  const configurableTools = TOOLS.filter((t) => t.id !== ADMIN_TOOL_ID);

  const [access, setAccess] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const t of configurableTools) {
      init[t.id] = tabAccess[t.id] ?? [];
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleChange(toolId: string, nextValues: string[]) {
    setAccess((prev) => {
      const prevValues = prev[toolId] ?? [];
      let next = nextValues;
      // Selecting "Tất cả phòng ban" clears specific departments and vice versa.
      if (next.includes(ALL_VALUE) && !prevValues.includes(ALL_VALUE)) {
        next = [ALL_VALUE];
      } else if (next.length > 1 && next.includes(ALL_VALUE)) {
        next = next.filter((v) => v !== ALL_VALUE);
      }
      return { ...prev, [toolId]: next };
    });
  }

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
      if (res.status === 401) {
        logout(SESSION_EXPIRED_MESSAGE);
        return;
      }
      const data = (await res.json()) as { tabAccess?: Record<string, string[]>; error?: string };
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
        Chọn phòng ban được phép xem từng tab. Tài khoản có vai trò Admin luôn xem được mọi tab.
        Tab Admin chỉ dành cho vai trò Admin.
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Tab</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 360 }}>Phòng ban được phép xem</TableCell>
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
                    multiple
                    displayEmpty
                    value={access[tool.id] ?? []}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleChange(tool.id, typeof value === 'string' ? value.split(',') : value);
                    }}
                    renderValue={(selected) => {
                      const values = selected as string[];
                      if (values.length === 0) {
                        return <Typography variant="body2" color="text.secondary">Chỉ Admin</Typography>;
                      }
                      return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {values.map((v) => (
                            <Chip key={v} label={v === ALL_VALUE ? ALL_LABEL : v} size="small" />
                          ))}
                        </Box>
                      );
                    }}
                  >
                    {DEPARTMENT_OPTIONS.map((opt) => (
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
