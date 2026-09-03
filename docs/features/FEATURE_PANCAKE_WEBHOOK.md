# Feature: Pancake · Webhook

**Tool ID:** `pancake-webhook`  
**Đăng ký:** `src/config/tools.ts`  
**UI:** `src/features/pancake-webhook/PancakeWebhookPanel.tsx`

## Mục đích

Hiển thị **URL nhận webhook**, hỗ trợ **đăng ký webhook** lên Pancake (Open API), xem **sự kiện đã nhận**, thử **ping** ingress, tải **sản phẩm / biến thể** qua proxy server — phục vụ luồng nhận orders / khách / kho từ Pancake.

## Hành vi UI (phải giữ nhất quán)

1. **Giới thiệu:** `toolDescription` + link tài liệu API Webhook (PUT shop); giải thích Pancake POST JSON tới URL đã đăng ký; lưu sự kiện (MongoDB nếu có `MONGODB_URI`, không thì bộ nhớ tạm).
2. **URL nhận:** load cấu hình; hiển thị từng shop (MeiT / DPA) với `shopId` và trạng thái API key; header bảo vệ POST nếu có; `fullReceiverUrl` hoặc hướng dẫn `PANCAKE_PUBLIC_WEBHOOK_BASE`.
3. **Đăng ký:** chọn shop (MeiT / DPA); form URL (HTTPS); chọn `webhook_types`; body gửi `shopKey`; API key theo shop (`PANCAKE_MEIT_API_KEY`, `PANCAKE_DPA_API_KEY`).
4. **Sự kiện:** nhóm theo loại (Đơn hàng, Khách hàng, …); có thể xóa toàn bộ sự kiện trên server (`confirm`); refresh sau ping.
5. **Sản phẩm / tồn kho:** gọi API variations; bảng động theo cột gợi ý từ dữ liệu (`apiResponse` helpers).
6. **Phân tích bán chạy:** từ webhook `orders` + tồn (`variations_warehouses` hoặc Open API) — TB bán/ngày, xếp hạng hot, ước ngày hết hàng.
7. **Ping:** POST payload mẫu loại `orders` để kiểm tra đường đi webhook.

## API client (contract)

| Thao tác | Method | Path (qua `apiUrl`) |
|----------|--------|---------------------|
| Cấu hình panel | GET | `/pancake-webhook/config` |
| Danh sách sự kiện | GET | `/pancake-webhook/events?limit=50` |
| Xóa sự kiện | DELETE | `/pancake-webhook/events` |
| Đăng ký webhook | POST | `/pancake-webhook/register` — body `{ shopKey, webhook_url, webhook_enable, webhook_types, webhook_email? }` |
| Sản phẩm / biến thể | GET | `/pancake-webhook/products/variations?shop=meit\|dpa` |
| Phân tích biến thể | GET | `/pancake-webhook/analytics/variant-sales?days=7&eventLimit=1000&shop=meit\|dpa` |
| Ping | POST | `/pancake-webhook/ping` — body `{ payload: object }` |

## Kiểu dữ liệu (`src/types.ts`)

- `PancakeWebhookConfig`: `shops[]` (`shopKey`, `label`, `shopId`, `hasApiKey`), `receiverPath`, `publicBaseUrl`, `fullReceiverUrl`, …
- `PancakeWebhookEventRow`: `id`, `receivedAt`, `kind`, `contentType`, `payload`.

## Quy tắc tuân thủ khi sửa code

- Nhãn loại webhook (`webhookKindLabel`) và thứ tự nhóm (`WEBHOOK_KIND_ORDER`) phải đồng bộ với cách server gắn `kind`.
- Không hardcode secret; chỉ hiển thị trạng thái “đã cấu hình” từ server.
- Form đăng ký: giữ validate URL + ít nhất một `webhook_types`.
- UI: `UiButton`, `UiDataTable`; tuân thủ [DESIGN_RULES.md](../DESIGN_RULES.md).
