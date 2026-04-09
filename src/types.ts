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
