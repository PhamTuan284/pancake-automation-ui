import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { GROUP_LABELS, monthLabel, vnd, type PeriodRow } from './payrollTypes';

function qtyText(n: number | undefined, isPct: boolean): string {
  if (n === undefined) return '';
  if (isPct) return `${+(n * 100).toFixed(4)}%`;
  return n.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

export function PayslipDialog({ row, month, onClose }: { row: PeriodRow | null; month: string; onClose: () => void }) {
  if (!row) return null;
  const { employee, payslip: p, entry } = row;
  const summary: [string, number, boolean?][] = [
    ['Tổng thu nhập', p.gross, true],
    ['Thu nhập miễn thuế (OT, làm đêm, ăn ca)', p.taxExempt],
    ['Thu nhập chịu thuế', p.taxableIncome],
    ...(p.pit.method === 'progressive'
      ? ([
          ['Giảm trừ (bản thân + người phụ thuộc + BH)', p.pit.deductions],
          ['Thu nhập tính thuế', p.pit.assessable],
        ] as [string, number][])
      : []),
    [p.pit.overridden ? 'Thuế TNCN (nhập tay)' : p.pit.method === 'progressive' ? 'Thuế TNCN (lũy tiến)' : 'Thuế TNCN (khấu trừ CTV)', -p.pit.amount],
    ['BH NLĐ đóng (BHXH + BHYT + BHTN)', -p.insuranceEmployee.total],
    ['Bù trừ kỳ trước', p.carryOver],
    ['Tạm ứng', -p.advance],
    ['Thực lĩnh', p.net, true],
  ];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Phiếu lương {monthLabel(month)} · {employee.code} – {employee.fullName}
        <Typography variant="body2" color="text.secondary">
          {employee.team} · {employee.position} · {employee.contractType === 'hdld' ? `HĐLĐ, mức đóng BH ${vnd(employee.insuranceBase)}` : 'Cộng tác viên'}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Khoản</TableCell>
              <TableCell>Nhóm</TableCell>
              <TableCell align="right">Số lượng / cơ sở</TableCell>
              <TableCell align="right">Đơn giá / tỷ lệ</TableCell>
              <TableCell align="right">Thành tiền</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {p.lines.map((l, i) => {
              const isPct = l.rate !== undefined && l.rate > 0 && l.rate < 1;
              return (
                <TableRow key={`${l.componentId}-${i}`}>
                  <TableCell>
                    {l.label}
                    {l.taxExempt && (
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        (miễn thuế)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{GROUP_LABELS[l.group]}</TableCell>
                  <TableCell align="right">{isPct ? vnd(l.qty) : qtyText(l.qty, false)}</TableCell>
                  <TableCell align="right">{isPct ? qtyText(l.rate, true) : l.rate !== undefined ? vnd(l.rate) : ''}</TableCell>
                  <TableCell align="right">{vnd(l.amount)}</TableCell>
                </TableRow>
              );
            })}
            {p.lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>Chưa có khoản lương — kiểm tra công thức của nhân viên.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Table size="small" sx={{ mt: 2, maxWidth: 520, ml: 'auto' }}>
          <TableBody>
            {summary.map(([label, value, strong]) => (
              <TableRow key={label}>
                <TableCell sx={strong ? { fontWeight: 700 } : undefined}>{label}</TableCell>
                <TableCell align="right" sx={strong ? { fontWeight: 700 } : undefined}>
                  {vnd(value)}
                </TableCell>
              </TableRow>
            ))}
            {p.insuranceCompany.total > 0 && (
              <TableRow>
                <TableCell sx={{ color: 'text.secondary' }}>BH công ty đóng (ngoài lương)</TableCell>
                <TableCell align="right" sx={{ color: 'text.secondary' }}>
                  {vnd(p.insuranceCompany.total)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {entry.note && (
          <Typography variant="body2" sx={{ mt: 2 }}>
            Ghi chú: {entry.note}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>
    </Dialog>
  );
}
