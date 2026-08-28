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
    id: 'leave',
    label: 'TMS · Nghỉ phép',
    description: 'Ghi nhận và theo dõi lịch sử nghỉ phép có lương của nhân viên nội bộ.',
  },
  {
    id: 'admin-storefront',
    label: 'Admin Storefront',
    description: 'Cấu hình hero banner, category banner và giao diện storefront MeiT.',
  },
  {
    id: 'integrations',
    label: 'Kết nối bên thứ 3',
    description: 'Facebook, Google Drive, Pancake Webhook, Zalo Bot.',
  },
  {
    id: 'admin',
    label: 'Admin',
    description: 'Cài đặt hệ thống: quản lý tab, bot và người dùng.',
  },
];
