# Feature: Pancake · Hóa đơn điện tử

**Tool ID:** `pancake-einvoice`  
**Đăng ký:** `src/config/tools.ts`  
**UI:** `src/features/pancake-einvoice/PancakeEinvoicePanel.tsx`  
**Cột bảng / parse:** `tableConstants.ts`, `invoiceTableUtils.ts`

## Mục đích

Điền dữ liệu khách hàng (từ Excel hoặc form), quản lý danh sách trên server, và kích hoạt **tự động phát hành hóa đơn** trên Pancake thông qua job E2E (WebdriverIO) trên server.

## Hành vi UI (phải giữ nhất quán)

1. **Giới thiệu:** hiển thị `toolDescription` từ `TOOLS` và link mở e-invoices Pancake (`pos.pancake.vn/.../e-invoices`).
2. **Tự động phát hành:** nút chạy E2E; trạng thái `sẵn sàng` / `đang chạy` / `đang bận` / `lỗi`; body POST cố định `spec: './wdio/features/pancake-einvoice-automation.feature'` (một feature file = một lần chạy Cucumber).
3. **Excel:** upload `.xlsx`/`.xls`; dòng đầu là header đúng thứ tự; **sheet đầu**; mỗi lần upload **thay thế toàn bộ** dữ liệu khách trên server. Link tải mẫu: `GET` template qua `apiUrl('/invoice-excel-template')`.
4. **Dữ liệu hiện tại:** tải danh sách từ API; tìm kiếm client-side; phân trang (10/20/50/100); thêm / sửa / xóa khách qua modal; validate lưu: ít nhất **Tên khách hàng** hoặc **Tên đơn vị**; xóa có `confirm`.

## API client (contract)

| Thao tác | Method | Path (qua `apiUrl`) |
|----------|--------|---------------------|
| Tải dữ liệu | GET | `/invoice-data` |
| Lưu toàn bộ dòng | PUT | `/invoice-data` — body `{ rows: InvoiceRow[] }` |
| Upload Excel | POST | `/upload-invoice-excel` — `FormData` field `file` |
| Tải file mẫu | GET | `/invoice-excel-template` |
| Chạy E2E | POST | `/run-e2e-tests` — body `{ spec: string }`; `409` = job đang chạy |

## Kiểu dữ liệu (`src/types.ts`)

- `InvoiceRow`: các key `ColumnKey` — `buyerName`, `operationName`, `taxCode`, `phone`, `idNumber`, `address`, `businessLicense` (chuỗi, đồng bộ với server).

## Quy tắc tuân thủ khi sửa code

- Không đổi ý nghĩa upload **replace-all** mà không cập nhật tài liệu và copy UI cảnh báo cho người dùng.
- Cột bảng: giữ đồng bộ `TABLE_COLUMNS` với payload server và tiêu đề Excel.
- Truy cập: dùng `UiButton`, `UiDataTable`; màu/spacing theo [DESIGN_RULES.md](../DESIGN_RULES.md).
- Lỗi mạng: thông báo gợi ý chạy `pancake-automation-server` khi không kết nối được API.
