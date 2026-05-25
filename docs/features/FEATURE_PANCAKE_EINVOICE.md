# Feature: Pancake · Hóa đơn điện tử (DPA & MeiT)

**Tool IDs:** `pancake-einvoice-meit`, `pancake-einvoice-dpa`  
**Đăng ký:** `src/config/tools.ts`, `src/config/invoiceShops.ts`  
**UI:** `src/features/pancake-einvoice/PancakeEinvoicePanel.tsx` (prop `shopKey`)

## Mục đích

Hai tab riêng cho **cửa hàng MeiT** và **cửa hàng DPA**: danh sách khách hàng tách MongoDB, đăng nhập Pancake và tự động hóa đơn theo shop tương ứng.

## Hành vi UI (phải giữ nhất quán)

Giống mô tả trước (Excel, CRUD, E2E), nhưng mọi API qua prefix:

`/pancake-einvoice/{shopKey}/…` với `shopKey` = `meit` | `dpa`.

## API client (contract)

| Thao tác | Method | Path (qua `apiUrl`) |
|----------|--------|---------------------|
| Cấu hình shop | GET | `/pancake-einvoice/{shopKey}/config` |
| Tải dữ liệu | GET | `/pancake-einvoice/{shopKey}/invoice-data` |
| Lưu toàn bộ dòng | PUT | `/pancake-einvoice/{shopKey}/invoice-data` |
| Upload Excel | POST | `/pancake-einvoice/{shopKey}/upload-invoice-excel` |
| Tải file mẫu | GET | `/pancake-einvoice/{shopKey}/invoice-excel-template` |
| Chạy E2E | POST | `/pancake-einvoice/{shopKey}/run-e2e-tests` — body `{ spec, shop?, meitVariant?: "mode" \| "daily" }` (MeiT tab) |

Đường dẫn cũ không có `{shopKey}` vẫn trỏ **MeiT** (`meit`).

## MongoDB

| Shop | Collection |
|------|------------|
| MeiT | `invoice_clients_meit` |
| DPA | `invoice_clients_dpa` |

## Env server (`.env`)

| Shop | Shop ID | Login |
|------|---------|--------|
| MeiT | `PANCAKE_MEIT_SHOP_ID` (hoặc `PANCAKE_SHOP_ID`) | `PANCAKE_MEIT_LOGIN_PHONE` / `PANCAKE_MEIT_LOGIN_PASSWORD` (hoặc `PANCAKE_LOGIN_*`) |
| DPA | `PANCAKE_DPA_SHOP_ID` | `PANCAKE_DPA_LOGIN_PHONE` / `PANCAKE_DPA_LOGIN_PASSWORD` |

**MeiT tab — hai cửa hàng Pancake (cùng danh sách khách Mongo):**

| Target | Shop ID | API key (Open API / webhook) |
|--------|---------|------------------------------|
| MeiT Mode | `PANCAKE_MEIT_MODE_SHOP_ID` (fallback `PANCAKE_MEIT_SHOP_ID`) | `PANCAKE_MEIT_MODE_API_KEY` (fallback `PANCAKE_MEIT_API_KEY`) |
| MeiT Daily | `PANCAKE_MEIT_DAILY_SHOP_ID` | `PANCAKE_MEIT_DAILY_API_KEY` |

Open API (tab Webhook): `PANCAKE_MEIT_API_KEY` / `PANCAKE_DPA_API_KEY` (MeiT có thể dùng `PANCAKE_API_KEY` cũ).

E2E: `PANCAKE_ACTIVE_INVOICE_SHOP=meit` + `PANCAKE_ACTIVE_MEIT_VARIANT=mode|daily`.
