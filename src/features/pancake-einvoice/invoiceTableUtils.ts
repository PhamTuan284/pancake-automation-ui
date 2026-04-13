import type { InvoiceRow } from '../../types';
import { TABLE_COLUMNS } from './tableConstants';

export function displayCell(value: unknown): string {
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

export function rowMatchesQuery(row: InvoiceRow, queryNorm: string): boolean {
  if (!queryNorm) return true;
  const haystack = TABLE_COLUMNS.map((c) =>
    String(row[c.key] ?? '')
      .toLocaleLowerCase('vi-VN')
      .trim()
  ).join(' ');
  return haystack.includes(queryNorm);
}

export function emptyCustomerForm(): InvoiceRow {
  return Object.fromEntries(
    TABLE_COLUMNS.map((c) => [c.key, ''])
  ) as InvoiceRow;
}

export function parseInvoiceRows(raw: unknown): InvoiceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const base = emptyCustomerForm();
    if (item && typeof item === 'object') {
      for (const c of TABLE_COLUMNS) {
        const v = (item as Record<string, unknown>)[c.key];
        base[c.key] = v == null ? '' : String(v);
      }
    }
    return base;
  });
}
