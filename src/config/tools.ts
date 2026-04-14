import type { ToolDef } from '../types';

/** Registered tools; add entries here as new UIs ship. */
export const TOOLS: ToolDef[] = [
  {
    id: 'pancake-einvoice',
    label: 'Pancake · Hóa đơn điện tử',
    description:
      'Điền dữ liệu khách từ Excel và chạy kiểm thử WDIO trên server.',
  },
  {
    id: 'pancake-webhook',
    label: 'Pancake · Webhook',
    description:
      'Nhận dữ liệu orders / khách / kho từ Pancake qua Webhook Open API.',
  },
];
