import type { ToolDef } from '../types';

/** Registered tools; add entries here as new UIs ship. */
export const TOOLS: ToolDef[] = [
  {
    id: 'pancake-einvoice',
    label: 'Pancake · Hóa đơn điện tử',
    description:
      'Điền dữ liệu khách từ Excel / JSON và chạy automation trên POS.',
  },
  {
    id: 'pancake-webhook',
    label: 'Pancake · Webhook',
    description:
      'Nhận dữ liệu orders / khách / kho từ Pancake qua Webhook Open API.',
  },
  {
    id: 'opensource-hrm',
    label: 'HRM · Horilla',
    description:
      'Nhân sự mã nguồn mở (Horilla) — chạy bằng Docker trong monorepo MeiT Tools.',
  },
  {
    id: 'opensource-crm',
    label: 'CRM · EspoCRM',
    description:
      'CRM mã nguồn mở (EspoCRM) — chạy bằng Docker trong monorepo MeiT Tools.',
  },
];
