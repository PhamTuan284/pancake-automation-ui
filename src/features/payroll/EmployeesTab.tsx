import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import type { PayrollApi } from './payrollApi';
import { KIND_LABELS, vnd, type PayrollEmployee, type PayrollMeta } from './payrollTypes';
import { EmployeeDialog } from './EmployeeDialog';
import { authFetch } from '../../lib/authFetch';
import { useAuth } from '../../context/AuthContext';
import type { TaskUser } from '../../types';

type Props = { api: PayrollApi; meta: PayrollMeta; onError: (msg: string) => void; onNotice: (msg: string) => void };

export function EmployeesTab({ api, meta, onError, onNotice }: Props) {
  const { user, logout } = useAuth();
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [team, setTeam] = useState('');
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<PayrollEmployee | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.employees();
      if (data) setEmployees(data.employees);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không thể tải nhân viên.');
    }
  }, [api, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    authFetch('/tasks/users', user.token, logout)
      .then((res) => res?.json())
      .then((data: { users?: TaskUser[] } | undefined) => setUsers(data?.users ?? []))
      .catch(() => {});
  }, [user, logout]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (showInactive || e.isActive) &&
        (!team || e.team === team) &&
        (!needle || e.code.toLowerCase().includes(needle) || e.fullName.toLowerCase().includes(needle))
    );
  }, [employees, team, q, showInactive]);

  async function handleSave(employee: PayrollEmployee) {
    const saved = editing ? await api.updateEmployee(editing.code, employee) : await api.createEmployee(employee);
    if (!saved) return;
    setDialogOpen(false);
    onNotice(`Đã lưu ${saved.employee.code}.`);
    await load();
  }

  async function handleDelete(e: PayrollEmployee) {
    if (!window.confirm(`Xóa ${e.code} – ${e.fullName}? Nếu người này chỉ nghỉ việc, nên tắt "Đang làm việc" thay vì xóa.`)) return;
    try {
      await api.deleteEmployee(e.code);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không thể xóa.');
    }
  }

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <TextField size="small" label="Tìm mã / tên" value={q} onChange={(e) => setQ(e.target.value)} />
        <TextField select size="small" label="Team" value={team} onChange={(e) => setTeam(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {meta.teams.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <FormControlLabel control={<Switch checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />} label="Hiện người đã nghỉ" />
        <Box sx={{ flex: 1 }} />
        <Button
          startIcon={<DownloadIcon />}
          onClick={() => api.exportEmployees().catch((err) => onError(err instanceof Error ? err.message : 'Không thể xuất Excel.'))}
        >
          Xuất Excel
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          Thêm nhân viên
        </Button>
      </Box>

      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mã</TableCell>
              <TableCell>Họ và tên</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Hợp đồng</TableCell>
              <TableCell>Công thức lương</TableCell>
              <TableCell>Tài khoản</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((e) => (
              <TableRow key={e.code} hover sx={e.isActive ? undefined : { opacity: 0.55 }}>
                <TableCell>{e.code}</TableCell>
                <TableCell>
                  {e.fullName}
                  <Box component="div" sx={{ fontSize: 12, color: 'text.secondary' }}>{e.position}</Box>
                </TableCell>
                <TableCell>{e.team || '—'}</TableCell>
                <TableCell>{e.contractType === 'hdld' ? `HĐLĐ · BH ${vnd(e.insuranceBase)}` : 'CTV'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {e.components.map((c) => (
                      <Chip key={c.id} size="small" label={c.label} title={KIND_LABELS[c.kind]} />
                    ))}
                    {e.components.length === 0 && <Box component="span" sx={{ color: 'text.secondary' }}>chưa có</Box>}
                  </Box>
                </TableCell>
                <TableCell>{e.username || '—'}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  <IconButton
                    aria-label="Sửa"
                    size="small"
                    onClick={() => {
                      setEditing(e);
                      setDialogOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton aria-label="Xóa" size="small" onClick={() => handleDelete(e)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>Chưa có nhân viên — dùng tab Đồng bộ Excel để nạp từ file bảng lương.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <EmployeeDialog
        open={dialogOpen}
        employee={editing}
        teams={meta.teams}
        metricLabels={meta.metricLabels}
        users={users}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
    </Box>
  );
}
