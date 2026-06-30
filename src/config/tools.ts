import type { ToolDef } from '../types';
import { INVOICE_SHOPS } from './invoiceShops';

/** Registered tools; add entries here as new UIs ship. */
export const TOOLS: ToolDef[] = [
  ...INVOICE_SHOPS.map((shop) => ({
    id: shop.toolId,
    label: shop.label,
    description: `Điền dữ liệu khách (${shop.shopKey === 'dpa' ? 'cửa hàng DPA' : 'cửa hàng MeiT'}) và tự động phát hành hóa đơn trên Pancake.`,
  })),
  {
    id: 'pancake-webhook',
    label: 'Pancake · Webhook',
    description:
      'Nhận dữ liệu orders / khách / kho từ Pancake qua Webhook Open API.',
  },
  {
    id: 'salary-calc',
    label: 'HRM · Tính lương',
    description:
      'Tính lương nhân viên theo công, OT, phụ cấp, khấu trừ và thuế TNCN.',
  },
  {
    id: 'telegram-bot',
    label: 'Telegram · Bot',
    description:
      'Gửi báo cáo biến thể bán chạy từ Pancake Webhook lên Telegram tự động mỗi ngày.',
  },
  {
    id: 'zalo-bot',
    label: 'Zalo · Bot',
    description:
      'Gửi báo cáo biến thể bán chạy từ Pancake Webhook vào nhóm Zalo tự động mỗi ngày.',
  },
  {
    id: 'admin-storefront',
    label: 'Admin Storefront',
    description: 'Cấu hình hero banner, category banner và giao diện storefront MeiT.',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Cài đặt hệ thống: quản lý tab, bot và người dùng.',
  },
];
