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

/** GET /pancake-webhook/config */
export type PancakeWebhookConfig = {
  receiverPath: string;
  publicBaseUrl: string | null;
  fullReceiverUrl: string | null;
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
  contentType: string;
  payload: unknown;
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

