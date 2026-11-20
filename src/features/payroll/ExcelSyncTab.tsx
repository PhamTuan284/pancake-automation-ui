import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { PayrollApi } from './payrollApi';
import { monthLabel, vnd, type ImportPreview } from './payrollTypes';

type Props = { api: PayrollApi; onError: (msg: string) => void; onNotice: (msg: string) => void };

export function ExcelSyncTab({ api, onError, onNotice }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [withEntries, setWithEntries] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handlePick(next: File | null) {
    setFile(next);
    setPreview(null);
    if (!next) return;
    setBusy(true);
    try {
      const data = await api.importPreview(next);
      if (data) {
        setPreview(data.preview);
        setWithEntries(data.preview.periodStatus !== 'locked');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không đọc được file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleApply() {
    if (!file || !preview) return;
    setBusy(true);
    try {
      const data = await api.importApply(file, withEntries);
      if (data) {
        const r = data.result;
        onNotice(`Đã đồng bộ ${r.employees} nhân viên${r.entries ? ` và số liệu ${r.month ? monthLabel(r.month) : ''}` : ''}.`);
        await handlePick(file);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không thể import.');
    } finally {
      setBusy(false);
    }
  }

  const mismatches = preview?.reconciliation.filter((r) => !r.ok) ?? [];
  const counts = preview
    ? (['create', 'update', 'unchanged'] as const).map((a) => [a, preview.employees.filter((e) => e.action === a).length] as const)
    : [];
  const actionLabel = { create: 'thêm mới', update: 'cập nhật', unchanged: 'không đổi' };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 1100 }}>
      <Typography variant="body2" color="text.secondary">
        Tải lên file bảng lương tháng (cùng mẫu "BẢNG LƯƠNG_MMYYYY.xlsx"). Hệ thống đọc sheet <b>Thông tin lao động</b> và các sheet
        lương từng team, khớp nhân viên theo <b>mã nhân viên</b>, tự tính lại và so với số trong file trước khi ghi.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}>
          Chọn file Excel
          <input
            type="file"
            accept=".xlsx,.xls"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = '';
              void handlePick(f);
            }}
          />
        </Button>
        {file && <Typography variant="body2">{file.name}</Typography>}
        {busy && <Typography variant="body2" color="text.secondary">Đang xử lý…</Typography>}
      </Box>

      {preview && (
        <>
          {preview.warnings.map((w) => (
            <Alert key={w} severity="warning">{w}</Alert>
          ))}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ mr: 1 }}>
              {preview.month ? monthLabel(preview.month) : 'Không rõ tháng'} · {preview.employees.length} nhân viên:
            </Typography>
            {counts.map(([a, n]) => (
              <Chip key={a} size="small" label={`${n} ${actionLabel[a]}`} color={a === 'create' ? 'primary' : a === 'update' ? 'warning' : 'default'} />
            ))}
          </Box>

          {mismatches.length === 0 ? (
            <Alert severity="success">
              Tính lại khớp file Excel cho cả {preview.reconciliation.length} người (tổng thu nhập, thuế, thực lĩnh; chênh tối đa vài đồng do làm tròn).
            </Alert>
          ) : (
            <Alert severity="error">
              {mismatches.length} người tính ra khác file Excel (tô đỏ bên dưới). Kiểm tra công thức của họ ở tab Nhân viên sau khi đồng bộ.
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={<Checkbox checked={withEntries} disabled={preview.periodStatus === 'locked' || !preview.month} onChange={(e) => setWithEntries(e.target.checked)} />}
              label={
                preview.periodStatus === 'locked'
                  ? `Kỳ ${preview.month ? monthLabel(preview.month) : ''} đã chốt — chỉ đồng bộ nhân viên & công thức`
                  : `Ghi cả số liệu ${preview.month ? monthLabel(preview.month) : ''} (giờ live, công, doanh thu…)${preview.periodStatus === 'draft' ? ' — thay số liệu đang có của kỳ này' : ''}`
              }
            />
            <Box>
              <Button
                variant="contained"
                disabled={busy}
                onClick={() =>
                  window.confirm('Ghi đè thông tin & công thức lương của các nhân viên trong file? (Liên kết tài khoản MeiT được giữ nguyên.)') &&
                  handleApply()
                }
              >
                Đồng bộ vào hệ thống
              </Button>
            </Box>
          </Box>

          <TableContainer sx={{ maxHeight: '60vh', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Mã</TableCell>
                  <TableCell>Họ và tên</TableCell>
                  <TableCell>Team</TableCell>
                  <TableCell align="right">Tổng TN (Excel)</TableCell>
                  <TableCell align="right">Tổng TN (app)</TableCell>
                  <TableCell align="right">Thuế (Excel)</TableCell>
                  <TableCell align="right">Thuế (app)</TableCell>
                  <TableCell align="right">Thực lĩnh (Excel)</TableCell>
                  <TableCell align="right">Thực lĩnh (app)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {preview.reconciliation.map((r) => (
                  <TableRow key={r.code} sx={r.ok ? undefined : { '& td': { color: 'error.main', fontWeight: 600 } }}>
                    <TableCell>{r.code}</TableCell>
                    <TableCell>{r.fullName}</TableCell>
                    <TableCell>{r.team}</TableCell>
                    <TableCell align="right">{vnd(r.excel.gross)}</TableCell>
                    <TableCell align="right">{vnd(r.app.gross)}</TableCell>
                    <TableCell align="right">{vnd(r.excel.tax)}</TableCell>
                    <TableCell align="right">{vnd(r.app.tax)}</TableCell>
                    <TableCell align="right">{vnd(r.excel.net)}</TableCell>
                    <TableCell align="right">{vnd(r.app.net)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}
