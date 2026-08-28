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
import TableSortLabel from '@mui/material/TableSortLabel';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import { authFetch } from '../../lib/authFetch';
import { useAuth, type AuthUser } from '../../context/AuthContext';
import { DEPARTMENTS } from '../../config/departments';
import { WORK_MODES, WORK_MODE_LABEL, type WorkMode } from '../../config/workModes';

const ALL_VALUE = '__all__';

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
  workMode?: WorkMode;
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
  workMode: '' | WorkMode;
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
  workMode: '',
};

/** Bulk-edit form: each field has an "apply this change?" toggle since it's shared across many people. */
type BulkFormState = {
  role: { enabled: boolean; value: 'admin' | 'user' };
  department: { enabled: boolean; value: string };
  workMode: { enabled: boolean; value: '' | WorkMode };
  isActive: { enabled: boolean; value: 'true' | 'false' };
};

const EMPTY_BULK_FORM: BulkFormState = {
  role: { enabled: false, value: 'user' },
  department: { enabled: false, value: '' },
  workMode: { enabled: false, value: '' },
  isActive: { enabled: false, value: 'true' },
};

type SortKey =
  | 'username'
  | 'fullName'
  | 'role'
  | 'department'
  | 'gender'
  | 'workMode'
  | 'hireDate'
  | 'isActive'
  | 'paidLeaveTotal'
  | 'createdAt';

const SORT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'username', label: 'Tên đăng nhập' },
  { key: 'fullName', label: 'Họ và tên' },
  { key: 'role', label: 'Vai trò' },
  { key: 'department', label: 'Phòng ban' },
  { key: 'gender', label: 'Giới tính' },
  { key: 'workMode', label: 'Hình thức làm việc' },
  { key: 'hireDate', label: 'Ngày vào làm' },
  { key: 'isActive', label: 'Trạng thái' },
  { key: 'paidLeaveTotal', label: 'Tổng phép năm' },
  { key: 'createdAt', label: 'Ngày tạo' },
];

function sortValue(user: UserRow, key: SortKey): string | number {
  switch (key) {
    case 'username':
      return user.username.toLowerCase();
    case 'fullName':
      return (user.fullName ?? '').toLowerCase();
    case 'role':
      return user.role;
    case 'department':
      return user.department ?? '';
    case 'gender':
      return user.gender ?? '';
    case 'workMode':
      return user.workMode ? WORK_MODE_LABEL[user.workMode] : '';
    case 'hireDate':
      return user.hireDate ?? '';
    case 'isActive':
      return user.isActive ? 1 : 0;
    case 'paidLeaveTotal':
      return user.paidLeaveTotal ?? 0;
    case 'createdAt':
      return user.createdAt;
  }
}

/** Empty values always sort last, regardless of direction — "unset" isn't meaningfully "less than" a real value. */
function compareUsers(a: UserRow, b: UserRow, key: SortKey, dir: 'asc' | 'desc'): number {
  const va = sortValue(a, key);
  const vb = sortValue(b, key);
  if (va === '' && vb === '') return 0;
  if (va === '') return 1;
  if (vb === '') return -1;
  const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'vi');
  return dir === 'asc' ? cmp : -cmp;
}

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState<BulkFormState>(EMPTY_BULK_FORM);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>('username');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = users.filter((u) => {
      if (departmentFilter !== ALL_VALUE && u.department !== departmentFilter) return false;
      if (roleFilter !== ALL_VALUE && u.role !== roleFilter) return false;
      if (statusFilter !== ALL_VALUE && String(u.isActive) !== statusFilter) return false;
      if (query && !u.username.toLowerCase().includes(query) && !(u.fullName ?? '').toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => compareUsers(a, b, sortKey, sortDir));
  }, [users, search, departmentFilter, roleFilter, statusFilter, sortKey, sortDir]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/admin/users', token, logout);
      if (!res) return;
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
      workMode: user.workMode ?? '',
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
          workMode: form.workMode,
        };
        if (form.password) body.password = form.password;
        const paidLeaveTotal = Number(form.paidLeaveTotal);
        if (Number.isFinite(paidLeaveTotal) && paidLeaveTotal >= 0) {
          body.paidLeaveTotal = paidLeaveTotal;
        }
        const res = await authFetch(`/admin/users/${editTarget._id}`, token, logout, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res) return;
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Cập nhật thất bại.');
      } else {
        const res = await authFetch('/admin/users', token, logout, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res) return;
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

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    const filteredIds = filteredUsers.map((u) => u._id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(filteredIds));
  }

  function openBulkEdit() {
    setBulkForm(EMPTY_BULK_FORM);
    setBulkError(null);
    setBulkDialogOpen(true);
  }

  async function handleBulkSubmit() {
    const body: Record<string, unknown> = { ids: [...selectedIds] };
    if (bulkForm.role.enabled) body.role = bulkForm.role.value;
    if (bulkForm.department.enabled) body.department = bulkForm.department.value;
    if (bulkForm.workMode.enabled) body.workMode = bulkForm.workMode.value;
    if (bulkForm.isActive.enabled) body.isActive = bulkForm.isActive.value === 'true';

    if (Object.keys(body).length === 1) {
      setBulkError('Chọn ít nhất 1 thay đổi để áp dụng.');
      return;
    }

    setBulkSaving(true);
    setBulkError(null);
    try {
      const res = await authFetch('/admin/users/bulk', token, logout, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res) return;
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Cập nhật hàng loạt thất bại.');
      setBulkDialogOpen(false);
      setSelectedIds(new Set());
      await fetchUsers();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Lỗi không xác định.');
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleDelete(user: UserRow) {
    if (!window.confirm(`Xóa người dùng "${user.username}"?`)) return;
    try {
      const res = await authFetch(`/admin/users/${user._id}`, token, logout, { method: 'DELETE' });
      if (!res) return;
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

      {selectedIds.size > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={openBulkEdit}>Sửa hàng loạt</Button>
              <Button size="small" onClick={() => setSelectedIds(new Set())}>Bỏ chọn</Button>
            </Box>
          }
        >
          Đã chọn {selectedIds.size} người dùng.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1080 }}>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u._id))}
                  indeterminate={
                    filteredUsers.some((u) => selectedIds.has(u._id)) &&
                    !filteredUsers.every((u) => selectedIds.has(u._id))
                  }
                  onChange={toggleSelectAllFiltered}
                />
              </TableCell>
              {SORT_COLUMNS.map((col) => (
                <TableCell key={col.key}>
                  <TableSortLabel
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDir : 'asc'}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell align="right">Thao tác</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                    Không tìm thấy người dùng phù hợp.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {filteredUsers.map((u) => (
              <TableRow key={u._id} selected={selectedIds.has(u._id)}>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={selectedIds.has(u._id)} onChange={() => toggleSelected(u._id)} />
                </TableCell>
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
                <TableCell>{u.workMode ? WORK_MODE_LABEL[u.workMode] : '—'}</TableCell>
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
        </Box>
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
            label={editTarget ? 'Đặt lại mật khẩu (để trống nếu không đổi)' : 'Mật khẩu'}
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            fullWidth
            size="small"
            helperText={
              editTarget
                ? 'Vì lý do bảo mật, hệ thống không thể hiển thị mật khẩu hiện tại của người dùng — chỉ có thể đặt mật khẩu mới.'
                : undefined
            }
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
          <FormControl size="small" fullWidth>
            <InputLabel>Hình thức làm việc</InputLabel>
            <Select
              label="Hình thức làm việc"
              value={form.workMode}
              onChange={(e) => setForm((f) => ({ ...f, workMode: e.target.value as FormState['workMode'] }))}
            >
              <MenuItem value="">— Không chọn —</MenuItem>
              {WORK_MODES.map((mode) => (
                <MenuItem key={mode} value={mode}>{WORK_MODE_LABEL[mode]}</MenuItem>
              ))}
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

      <Dialog open={bulkDialogOpen} onClose={() => setBulkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Sửa hàng loạt ({selectedIds.size} người dùng)</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <Typography variant="body2" color="text.secondary">
            Chỉ tick "Áp dụng" ở mục nào bạn muốn thay đổi hàng loạt — mục không tick sẽ giữ nguyên giá trị hiện tại của từng người.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={bulkForm.role.enabled}
              onChange={(e) => setBulkForm((f) => ({ ...f, role: { ...f.role, enabled: e.target.checked } }))}
            />
            <FormControl size="small" fullWidth disabled={!bulkForm.role.enabled}>
              <InputLabel>Vai trò</InputLabel>
              <Select
                label="Vai trò"
                value={bulkForm.role.value}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, role: { ...f.role, value: e.target.value as 'admin' | 'user' } }))
                }
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={bulkForm.department.enabled}
              onChange={(e) =>
                setBulkForm((f) => ({ ...f, department: { ...f.department, enabled: e.target.checked } }))
              }
            />
            <FormControl size="small" fullWidth disabled={!bulkForm.department.enabled}>
              <InputLabel>Phòng ban</InputLabel>
              <Select
                label="Phòng ban"
                value={bulkForm.department.value}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, department: { ...f.department, value: e.target.value } }))
                }
              >
                <MenuItem value="">— Không chọn —</MenuItem>
                {DEPARTMENTS.map((dept) => (
                  <MenuItem key={dept} value={dept}>{dept}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={bulkForm.workMode.enabled}
              onChange={(e) =>
                setBulkForm((f) => ({ ...f, workMode: { ...f.workMode, enabled: e.target.checked } }))
              }
            />
            <FormControl size="small" fullWidth disabled={!bulkForm.workMode.enabled}>
              <InputLabel>Hình thức làm việc</InputLabel>
              <Select
                label="Hình thức làm việc"
                value={bulkForm.workMode.value}
                onChange={(e) =>
                  setBulkForm((f) => ({
                    ...f,
                    workMode: { ...f.workMode, value: e.target.value as BulkFormState['workMode']['value'] },
                  }))
                }
              >
                <MenuItem value="">— Không chọn —</MenuItem>
                {WORK_MODES.map((mode) => (
                  <MenuItem key={mode} value={mode}>{WORK_MODE_LABEL[mode]}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={bulkForm.isActive.enabled}
              onChange={(e) =>
                setBulkForm((f) => ({ ...f, isActive: { ...f.isActive, enabled: e.target.checked } }))
              }
            />
            <FormControl size="small" fullWidth disabled={!bulkForm.isActive.enabled}>
              <InputLabel>Trạng thái</InputLabel>
              <Select
                label="Trạng thái"
                value={bulkForm.isActive.value}
                onChange={(e) =>
                  setBulkForm((f) => ({
                    ...f,
                    isActive: { ...f.isActive, value: e.target.value as 'true' | 'false' },
                  }))
                }
              >
                <MenuItem value="true">Hoạt động</MenuItem>
                <MenuItem value="false">Bị khóa</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {bulkError && <Alert severity="error">{bulkError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)} disabled={bulkSaving}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleBulkSubmit}
            disabled={bulkSaving}
            startIcon={bulkSaving ? <CircularProgress size={16} /> : undefined}
          >
            Áp dụng
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
