export function extractApiRows(root: unknown): Record<string, unknown>[] {
  const asRowObjects = (arr: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === 'object' && !Array.isArray(x)
    );
  };

  const direct = asRowObjects(root);
  if (direct.length > 0) return direct;

  if (!root || typeof root !== 'object' || Array.isArray(root)) return [];

  const o = root as Record<string, unknown>;
  for (const key of [
    'data',
    'results',
    'items',
    'warehouses',
    'customers',
    'variations',
    'products',
    'einvoices',
    'invoices',
    'list',
  ] as const) {
    const inner = asRowObjects(o[key]);
    if (inner.length > 0) return inner;
    const nested = o[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const n = nested as Record<string, unknown>;
      for (const k2 of [
        'data',
        'results',
        'items',
        'warehouses',
        'customers',
        'variations',
        'products',
        'einvoices',
      ] as const) {
        const inner2 = asRowObjects(n[k2]);
        if (inner2.length > 0) return inner2;
      }
    }
  }
  return [];
}

function isApiCellEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s === '{}' || s === '[]';
  }
  return false;
}

export function apiTableColumns(
  rows: Record<string, unknown>[],
  preferred: string[]
): string[] {
  if (rows.length === 0) return [];
  const keys = new Set<string>();
  for (const r of rows.slice(0, 50)) {
    Object.keys(r).forEach((k) => keys.add(k));
  }
  const nonEmpty = [...keys].filter((k) =>
    rows.some((r) => !isApiCellEmpty(r[k]))
  );
  const rest = nonEmpty.filter((k) => !preferred.includes(k)).sort();
  return [...preferred.filter((k) => nonEmpty.includes(k)), ...rest].slice(
    0,
    24
  );
}

export function apiCellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
