import type { ReactNode } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

export type UiDataTableColumn<TRow> = {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: TRow, rowIndex: number) => ReactNode;
};

type UiDataTableProps<TRow> = {
  rows: TRow[];
  columns: UiDataTableColumn<TRow>[];
  rowKey: (row: TRow, rowIndex: number) => string | number;
  wrapClassName?: string;
  tableClassName?: string;
};

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function UiDataTable<TRow>({
  rows,
  columns,
  rowKey,
  wrapClassName,
  tableClassName,
}: UiDataTableProps<TRow>) {
  return (
    <TableContainer className={joinClasses('table-wrap', wrapClassName)}>
      <Table className={joinClasses('data-table', tableClassName)} stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell
                key={col.key}
                component="th"
                className={col.headerClassName}
              >
                {col.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowKey(row, rowIndex)}>
              {columns.map((col) => (
                <TableCell key={col.key} className={col.cellClassName}>
                  {col.render(row, rowIndex)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
