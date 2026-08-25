import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import { apiUrl } from '../../lib/api';
import { useAuth, type AuthUser } from '../../context/AuthContext';
import { DEPARTMENTS } from '../../config/departments';

const ALL_VALUE = '__all__';

const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

type UserRow = {
  _id: string;
  username: string;
  fullName?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  paidLeaveTotal: number;
  department: string;
  hireDate?: string;
  gender?: 'male' | 'female';
  createdAt: string;
};

type Props = {
  token: AuthUser['token'];
  currentUsername: string;
};

type FormState = {
  username: string;
  password: string;
  fullName: string;
  role: 'admin' | 'user';
  paidLeaveTotal: string;
  department: string;
  hireDate: string;
  gender: '' | 'male' | 'female';
};

const EMPTY_FORM: FormState = {
  username: '',
  password: '',
  fullName: '',
  role: 'user',
  paidLeaveTotal: '12',
  department: '',
  hireDate: '',
  gender: '',
};

export function UserManagement({ token, currentUsername }: Props) {
  const { logout } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(ALL_VALUE);
  const [roleFilter, setRoleFilter] = useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);

  const authHeader = { Authorization: `Bearer ${token}` };

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((u) => {
      if (departmentFilter !== ALL_VALUE && u.department !== departmentFilter) return false;
      if (roleFilter !== ALL_VALUE && u.role !== roleFilter) return false;
      if (statusFilter !== ALL_VALUE && String(u.isActive) !== statusFilter) return false;
      if (query && !u.username.toLowerCase().includes(query) && !(u.fullName ?? '').toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  }, [users, search, departmentFilter, roleFilter, statusFilter]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/admin/users'), { headers: authHeader });
      if (res.status === 401) {
        logout(SESSION_EXPIRED_MESSAGE);
        return;
      }
      if (!res.ok) throw new Error('Không thể tải danh sách người dùng.');
      setUsers(await res.json() as UserRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  }, [token, logout]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditTarget(user);
    setForm({
      username: user.username,
      password: '',
      fullName: user.fullName ?? '',
      role: user.role,
      paidLeaveTotal: String(user.paidLeaveTotal ?? 12),
      department: user.department ?? '',
      hireDate: user.hireDate ? user.hireDate.slice(0, 10) : '',
      gender: user.gender ?? '',
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.username.trim()) {
      setFormError('Tên đăng nhập không được để trống.');
      return;
    }
    if (!editTarget && !form.password) {
      setFormError('Mật khẩu không được để trống.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (editTarget) {
        const body: Record<string, unknown> = {
          fullName: form.fullName,
          role: form.role,
          department: form.department,
          hireDate: form.hireDate,
          gender: form.gender,
        };
        if (form.password) body.password = form.password;
        const paidLeaveTotal = Number(form.paidLeaveTotal);
        if (Number.isFinite(paidLeaveTotal) && paidLeaveTotal >= 0) {
          body.paidLeaveTotal = paidLeaveTotal;
        }
        const res = await fetch(apiUrl(`/admin/users/${editTarget._id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          logout(SESSION_EXPIRED_MESSAGE);
          return;
        }
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Cập nhật thất bại.');
      } else {
        const res = await fetch(apiUrl('/admin/users'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify(form),
        });
        if (res.status === 401) {
          logout(SESSION_EXPIRED_MESSAGE);
          return;
        }
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Tạo người dùng thất bại.');
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(user: UserRow) {
    if (!window.confirm(`Xóa người dùng "${user.username}"?`)) return;
    try {
      const res = await fetch(apiUrl(`/admin/users/${user._id}`), {
        method: 'DELETE',
        headers: authHeader,
      });
      if (res.status === 401) {
        logout(SESSION_EXPIRED_MESSAGE);
        return;
      }
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Xóa thất bại.');
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Quản lý người dùng</Typography>
        <Button variant="contained" startIcon={<PersonAddIcon />} onClick={openCreate}>
          Thêm người dùng
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Tìm theo tên đăng nhập hoặc họ tên…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 260, flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Phòng ban</InputLabel>
          <Select
            label="Phòng ban"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <MenuItem value={ALL_VALUE}>Tất cả phòng ban</MenuItem>
            {DEPARTMENTS.map((dept) => (
              <MenuItem key={dept} value={dept}>{dept}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Vai trò</InputLabel>
          <Select
            label="Vai trò"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <MenuItem value={ALL_VALUE}>Tất cả vai trò</MenuItem>
            <MenuItem value="user">User</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Trạng thái</InputLabel>
          <Select
            label="Trạng thái"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value={ALL_VALUE}>Tất cả trạng thái</MenuItem>
            <MenuItem value="true">Hoạt động</MenuItem>
            <MenuItem value="false">Bị khóa</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Tên đăng nhập</TableCell>
              <TableCell>Họ và tên</TableCell>
              <TableCell>Vai trò</TableCell>
              <TableCell>Phòng ban</TableCell>
              <TableCell>Giới tính</TableCell>
              <TableCell>Ngày vào làm</TableCell>
              <TableCell>Trạng thái</TableCell>
              <TableCell>Tổng phép năm</TableCell>
              <TableCell>Ngày tạo</TableCell>
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={10}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Không tìm thấy người dùng phù hợp.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filteredUsers.map((u) => (
              <TableRow key={u._id}>
                <TableCell>{u.username}</TableCell>
                <TableCell>{u.fullName || '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={u.role === 'admin' ? 'Admin' : 'User'}
                    color={u.role === 'admin' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>{u.department || '—'}</TableCell>
                <TableCell>{u.gender === 'male' ? 'Nam' : u.gender === 'female' ? 'Nữ' : '—'}</TableCell>
                <TableCell>{u.hireDate ? new Date(u.hireDate).toLocaleDateString('vi-VN') : '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={u.isActive ? 'Hoạt động' : 'Bị khóa'}
                    color={u.isActive ? 'success' : 'error'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{u.paidLeaveTotal ?? 12}</TableCell>
                <TableCell>
                  {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(u)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={u.username === currentUsername}
                    onClick={() => handleDelete(u)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editTarget ? 'Sửa người dùng' : 'Thêm người dùng'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField
            label="Tên đăng nhập"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            disabled={!!editTarget}
            fullWidth
            size="small"
          />
          <TextField
            label="Họ và tên"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label={editTarget ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu'}
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            fullWidth
            size="small"
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Vai trò</InputLabel>
            <Select
              label="Vai trò"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))}
            >
              <MenuItem value="user">User</MenuItem>
              <MenuItem value="admin">Admin</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Phòng ban</InputLabel>
            <Select
              label="Phòng ban"
              value={form.department}
              onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
            >
              <MenuItem value="">— Không chọn —</MenuItem>
              {DEPARTMENTS.map((dept) => (
                <MenuItem key={dept} value={dept}>{dept}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Giới tính</InputLabel>
            <Select
              label="Giới tính"
              value={form.gender}
              onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as FormState['gender'] }))}
            >
              <MenuItem value="">— Không chọn —</MenuItem>
              <MenuItem value="male">Nam</MenuItem>
              <MenuItem value="female">Nữ</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Ngày vào làm"
            type="date"
            value={form.hireDate}
            onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
            fullWidth
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          {editTarget && (
            <TextField
              label="Tổng phép năm (ngày)"
              type="number"
              value={form.paidLeaveTotal}
              onChange={(e) => setForm((f) => ({ ...f, paidLeaveTotal: e.target.value }))}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { min: 0 } }}
            />
          )}
          {formError && <Alert severity="error">{formError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : undefined}
          >
            {editTarget ? 'Lưu' : 'Tạo'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
