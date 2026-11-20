/** Client mirror of pancake-automation-server/features/payroll/payroll.types.ts. */

export type ContractType = 'hdld' | 'ctv';
export type PayGroup = 'position' | 'performance' | 'bonus' | 'meal' | 'ot';

type ComponentBase = { id: string; label: string };

export type PayComponent =
  | (ComponentBase & { kind: 'qty_rate'; metric: string; rate: number; max?: number; group: PayGroup; taxExempt?: boolean })
  | (ComponentBase & { kind: 'fixed'; amount: number; group: PayGroup; taxExempt?: boolean })
  | (ComponentBase & { kind: 'percent'; metric: string; pct: number; weight?: number; threshold?: number; group: PayGroup })
  | (ComponentBase & { kind: 'kpi_base'; metric: string; baseAmount: number; includedQty: number; overRate: number; group: PayGroup })
  | (ComponentBase & { kind: 'live_hours'; rate: number; standardAmount?: number });

export type PayComponentKind = PayComponent['kind'];

export type PayrollEmployee = {
  code: string;
  fullName: string;
  team: string;
  position: string;
  contractType: ContractType;
  insuranceBase: number;
  taxCode: string;
  idNumber: string;
  dependents: number;
  username: string;
  payNote: string;
  components: PayComponent[];
  isActive: boolean;
};

export type PayrollEntry = {
  code: string;
  metrics: Record<string, number>;
  bonus: number;
  advance: number;
  carryOver: number;
  note: string;
  /** Hand-entered Thuế TNCN for this month; null/undefined = computed. */
  pitOverride?: number | null;
};

export type InsuranceRates = { bhxh: number; bhyt: number; bhtn: number; union: number };

export type PayrollSettings = {
  insurance: { employee: InsuranceRates; company: InsuranceRates };
  pit: {
    personalDeduction: number;
    dependentDeduction: number;
    brackets: { upTo: number | null; rate: number }[];
    ctvThreshold: number;
    ctvRate: number;
  };
  live: { nightMultiplier: number; sundayBonusPct: number; holidayMultiplier: number };
};

export type PayLine = {
  componentId: string;
  label: string;
  group: PayGroup;
  qty?: number;
  rate?: number;
  amount: number;
  taxExempt: boolean;
};

type InsuranceAmounts = InsuranceRates & { total: number };

export type Payslip = {
  code: string;
  fullName: string;
  team: string;
  contractType: ContractType;
  lines: PayLine[];
  groups: Record<PayGroup, number>;
  gross: number;
  taxExempt: number;
  taxableIncome: number;
  insuranceEmployee: InsuranceAmounts;
  insuranceCompany: InsuranceAmounts;
  pit: { method: 'progressive' | 'withholding'; deductions: number; assessable: number; amount: number; overridden?: boolean };
  carryOver: number;
  advance: number;
  net: number;
};

export type PayrollSummary = {
  headcount: number;
  gross: number;
  pit: number;
  insuranceEmployee: number;
  insuranceCompany: number;
  net: number;
  byTeam: { team: string; headcount: number; gross: number; net: number }[];
};

export type MetricColumn = { key: string; label: string };

export type PeriodRow = { employee: PayrollEmployee; entry: PayrollEntry; payslip: Payslip };

export type PeriodView = {
  month: string;
  status: 'draft' | 'locked';
  lockedAt?: string;
  lockedBy?: string;
  rows: PeriodRow[];
  summary: PayrollSummary;
  metricColumns: Record<string, MetricColumn[]>;
};

export type PeriodListItem = {
  month: string;
  status: 'draft' | 'locked';
  lockedAt?: string;
  headcount: number;
  gross: number;
  net: number;
};

export type PayrollMeta = {
  teams: string[];
  metricLabels: Record<string, string>;
  settings: PayrollSettings;
};

export type ImportPreview = {
  month: string | null;
  periodStatus: 'none' | 'draft' | 'locked';
  warnings: string[];
  employees: { code: string; fullName: string; team: string; isActive: boolean; action: 'create' | 'update' | 'unchanged' }[];
  reconciliation: {
    code: string;
    fullName: string;
    team: string;
    excel: { gross: number; tax: number; net: number };
    app: { gross: number; tax: number; net: number };
    ok: boolean;
  }[];
};

export const GROUP_LABELS: Record<PayGroup, string> = {
  position: 'Lương vị trí',
  performance: 'Lương hiệu quả',
  bonus: 'Thưởng',
  meal: 'Tiền ăn ca',
  ot: 'OT / làm đêm',
};

export const KIND_LABELS: Record<PayComponentKind, string> = {
  qty_rate: 'Số lượng × đơn giá',
  fixed: 'Cố định',
  percent: '% doanh thu',
  kpi_base: 'Lương KPI + vượt KPI',
  live_hours: 'Giờ livestream',
};

/**
 * Parses a typed number: "1.234.567" (vi thousands), "12,5" (vi decimal) or
 * "82211.54". Empty → 0, garbage → null.
 */
export function parseNumberText(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '');
  if (cleaned === '') return 0;
  const viGrouped = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned);
  const normalized = viGrouped ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function vnd(n: number | undefined | null): string {
  // `|| 0` turns -0 (e.g. a negated zero advance) into 0 so it never prints "-0".
  return (Math.round(n ?? 0) || 0).toLocaleString('vi-VN');
}

/** Editable display of an input: "118.118.709", "104,5"; parseNumberText reads both back. */
export function numberText(n: number): string {
  return n ? n.toLocaleString('vi-VN', { maximumFractionDigits: 4 }) : '';
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `Tháng ${Number(m)}/${y}`;
}
