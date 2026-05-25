import type { ReactNode } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

export type UiDataTableSort = {
  key: string;
  dir: 'asc' | 'desc';
};

export type UiDataTableColumn<TRow> = {
  key: string;
  header: ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  sortable?: boolean;
  render: (row: TRow, rowIndex: number) => ReactNode;
};

type UiDataTableProps<TRow> = {
  rows: TRow[];
  columns: UiDataTableColumn<TRow>[];
  rowKey: (row: TRow, rowIndex: number) => string | number;
  wrapClassName?: string;
  tableClassName?: string;
  sort?: UiDataTableSort;
  onSortChange?: (sort: UiDataTableSort) => void;
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
  sort,
  onSortChange,
}: UiDataTableProps<TRow>) {
  const toggleSort = (colKey: string) => {
    if (!onSortChange) return;
    if (sort?.key === colKey) {
      onSortChange({
        key: colKey,
        dir: sort.dir === 'asc' ? 'desc' : 'asc',
      });
      return;
    }
    onSortChange({ key: colKey, dir: 'asc' });
  };

  return (
    <TableContainer className={joinClasses('table-wrap', wrapClassName)}>
      <Table className={joinClasses('data-table', tableClassName)} stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((col) => {
              const isSortable = Boolean(col.sortable && onSortChange);
              const isActive = sort?.key === col.key;
              return (
                <TableCell
                  key={col.key}
                  component="th"
                  className={joinClasses(
                    col.headerClassName,
                    isSortable ? 'data-table-th-sortable' : undefined
                  )}
                  aria-sort={
                    isActive
                      ? sort!.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {isSortable ? (
                    <button
                      type="button"
                      className={joinClasses(
                        'data-table-sort-btn',
                        isActive ? 'data-table-sort-btn--active' : undefined
                      )}
                      onClick={() => toggleSort(col.key)}
                    >
                      <span>{col.header}</span>
                      <span className="data-table-sort-indicator" aria-hidden>
                        {isActive ? (sort!.dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </TableCell>
              );
            })}
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
