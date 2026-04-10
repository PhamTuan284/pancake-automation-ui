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

/** GET /integrations — one bundled HRM + CRM stack (Horilla + EspoCRM via Docker). */
export type IntegrationServiceInfo = {
  product: string;
  dockerImage: string;
  url: string;
  reachable: boolean;
  httpStatus?: number;
  error?: string;
};

export type IntegrationsBundle = {
  composeFile: string;
  envFileExample: string;
  npmScript: string;
  hrm: IntegrationServiceInfo;
  crm: IntegrationServiceInfo;
};
