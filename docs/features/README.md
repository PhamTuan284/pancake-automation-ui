# Đặc tả theo tính năng (MeiT Tools UI)

Mỗi công cụ trong ứng dụng có tài liệu **phạm vi, hành vi UI, API và quy tắc tuân thủ** khi phát triển hoặc sửa code.

## Tuân thủ chung

- **Giao diện và token:** [DESIGN_RULES.md](../DESIGN_RULES.md)
- **Đăng ký công cụ (tab, URL `?tool=`):** `src/config/tools.ts` — mọi tool mới cần thêm `ToolDef` và panel tương ứng trong `src/App.tsx`.

## Danh sách feature

| Tool ID | Tài liệu |
|--------|----------|
| `pancake-einvoice-meit`, `pancake-einvoice-dpa` | [FEATURE_PANCAKE_EINVOICE.md](./FEATURE_PANCAKE_EINVOICE.md) |
| `pancake-webhook` | [FEATURE_PANCAKE_WEBHOOK.md](./FEATURE_PANCAKE_WEBHOOK.md) |
| `salary-calc` (Tính lương / HRM) | [FEATURE_TINH_LUONG.md](../FEATURE_TINH_LUONG.md) — **một file:** phần đang ship + phần roadmap |

Khi thay đổi hành vi người dùng hoặc API, **cập nhật file feature tương ứng** trong cùng PR để tài liệu và code luôn khớp.
