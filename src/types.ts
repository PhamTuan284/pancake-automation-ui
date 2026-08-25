/** Column keys aligned with pancake-automation-server invoice rows. */
export type ColumnKey =
  | 'buyerName'
  | 'operationName'
  | 'taxCode'
  | 'phone'
  | 'idNumber'
  | 'address'
  | 'businessLicense';

export type InvoiceRow = Record<ColumnKey, string>;

export type CustomerModalState =
  | { mode: 'add' }
  | { mode: 'edit'; index: number };

export type ToolDef = {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
};

export type PancakeWebhookShopConfig = {
  shopKey: 'meit' | 'dpa';
  label: string;
  shopId: string;
  hasApiKey: boolean;
};

/** GET /pancake-webhook/config */
export type PancakeWebhookConfig = {
  receiverPath: string;
  publicBaseUrl: string | null;
  fullReceiverUrl: string | null;
  shops: PancakeWebhookShopConfig[];
  /** MeiT shop (legacy fields). */
  shopId: string;
  hasApiKey: boolean;
  incomingSecretConfigured: boolean;
  incomingSecretHeader: string;
  docUrl: string;
  webhookTypes: string[];
};

/** GET /pancake-webhook/events */
export type PancakeWebhookEventRow = {
  id: string;
  receivedAt: string;
  kind: string;
  contentType: string;
  payload: unknown;
};

/** GET /pancake-webhook/analytics/variant-sales */
export type VariantSalesByDay = { date: string; quantity: number };

export type VariantSalesRow = {
  productCode: string;
  variantCode: string;
  soldInWindow: number;
  avgSoldPerDay: number;
  soldByDay: VariantSalesByDay[];
  currentStock: number | null;
  daysUntilSellOut: number | null;
  hotRank: number;
  lastSoldAt: string | null;
  stockUpdatedAt: string | null;
  stockSource: 'webhook' | 'catalog' | null;
};

export type VariantSalesAnalytics = {
  windowDays: number;
  from: string;
  to: string;
  orderEventsUsed: number;
  stockEventsUsed: number;
  variants: VariantSalesRow[];
  note: string;
};

/** GET /pancake-webhook/analytics/employee-productivity */
export type EmployeeProductivityRow = {
  rank: number;
  employeeId: string;
  employeeName: string;
  orderCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  cancelledCount: number;
};

export type EmployeeProductivityResult = {
  windowDays: number;
  from: string;
  to: string;
  totalOrders: number;
  rows: EmployeeProductivityRow[];
};

export type SalaryInputDraft = {
  employeeName: string;
  baseSalary: number;
  workDays: number;
  standardWorkDays: number;
  overtimeWeekdayHours: number;
  overtimeWeekendHours: number;
  overtimeHolidayHours: number;
  allowance: number;
  bonus: number;
  otherAddition: number;
  latePenalty: number;
  otherDeduction: number;
  advancePayment: number;
  insuranceRate: number;
  personalDeduction: number;
  dependentCount: number;
  dependentDeductionPerPerson: number;
};

export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveSession = 'full' | 'morning' | 'afternoon';

export type LeaveInputDraft = {
  type: string;
  startDate: string;
  endDate: string;
  session: LeaveSession;
  reason: string;
};

export type LeaveRecord = {
  _id: string;
  username: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  session: LeaveSession;
  days: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectReason?: string;
  createdAt: string;
};

export type LeaveTypeBalance = {
  type: string;
  label: string;
  quota: number;
  usedDays: number;
  remainingDays: number;
};

export type LeaveBalance = {
  username: string;
  department: string;
  types: LeaveTypeBalance[];
};

export type SalaryResult = {
  employeeName: string;
  baseSalary: number;
  proratedSalary: number;
  overtimePay: number;
  overtimePayWeekday: number;
  overtimePayWeekend: number;
  overtimePayHoliday: number;
  allowance: number;
  bonus: number;
  otherAddition: number;
  grossIncome: number;
  insuranceDeduction: number;
  taxableIncome: number;
  pitTax: number;
  latePenalty: number;
  otherDeduction: number;
  advancePayment: number;
  totalDeduction: number;
  netIncome: number;
};

