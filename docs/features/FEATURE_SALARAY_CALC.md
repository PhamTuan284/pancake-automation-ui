# Tính năng: Tính lương (HRM)

Một feature thống nhất **Tính lương**: hiện tại giao diện là tab **HRM · Tính lương** (`salary-calc`); các mục dưới đây mô tả **đang ship** và **định hướng mở rộng** trong cùng tài liệu tuân thủ.

**Đăng ký tool:** `src/config/tools.ts` — `id: 'salary-calc'`, label `HRM · Tính lương`  
**UI hiện tại:** `src/features/salary/SalaryPanel.tsx`  
**Kiểu:** `SalaryInputDraft`, `SalaryResult` trong `src/types.ts`

---

## Phần A — Đang triển khai trong app (salary-calc)

### A.1. Mục đích

Nhập **một bộ** dữ liệu chấm công và thu nhập cho **một nhân viên**, gọi server để tính lương theo **công, OT, phụ cấp, khấu trừ, BHXH, thuế TNCN** (biểu luỹ tiến từng phần tháng), hiển thị bảng tóm tắt kết quả.

Đây là **bước đầu** của cùng feature; phần B mô tả module full screen / sidebar / mẫu bộ phận / bảng toàn nhân viên / Excel sẽ **mở rộng** luồng này, không tách thành feature sản phẩm khác.

### A.2. Hành vi UI (phải giữ nhất quán)

1. **Giới thiệu:** `toolDescription` từ `TOOLS`.
2. **Form:** tên nhân viên; số công thực tế / chuẩn; giờ OT ngày thường / cuối tuần / lễ; các trường tiền (VND) theo nhãn trong `SalaryPanel`; số người phụ thuộc; tỷ lệ BH nhân viên đóng (0–1).
3. **Mặc định:** khi mount, thử `GET /salary/defaults` — nếu OK và có `defaults` thì merge vào draft; lỗi mạng bỏ qua, giữ default cục bộ.
4. **Tính:** nút “Tính lương” → `POST /salary/calculate` với toàn bộ `SalaryInputDraft`; hiển thị lỗi hoặc section kết quả (lương theo công, OT, tổng thu nhập, BH, thuế, khấu trừ, thực lĩnh…).
5. **Định dạng:** tiền `Intl.NumberFormat('vi-VN')` + `đ`; khấu trừ hiển thị rõ (ví dụ class `salary-negative`).
6. **Ghi chú:** thuế TNCN theo biểu luỹ tiến từng phần tháng (VN).

### A.3. API client (contract)

| Thao tác | Method | Path (qua `apiUrl`) |
|----------|--------|---------------------|
| Mặc định form | GET | `/salary/defaults` — `{ defaults?: SalaryInputDraft }` |
| Tính lương | POST | `/salary/calculate` — body `SalaryInputDraft`; `{ result?: SalaryResult, error? }` |

### A.4. Quy tắc tuân thủ khi sửa code

- **Nguồn sự thật tính toán là server** — UI không tự tính thuế/BH; đổi công thức ưu tiên server + test.
- Thêm/sửa field: đồng bộ `types`, form, `MONEY_FIELD_LABELS` / `summaryRows`, API server và **cập nhật phần A** trong file này.
- Khi triển khai phần B (layout sidebar, nhiều màn con), có thể gom dưới một tool `salary-calc` hoặc đổi routing nội bộ — cập nhật `tools.ts`, `App.tsx` và bảng trong [docs/features/README.md](./features/README.md).

---

## Phần B — Định hướng mở rộng (cùng feature Tính lương)

### B.1. Thiết kế giao diện

#### B.1.1. Bố cục toàn màn hình

- Module chiếm **toàn bộ viewport** (full screen): tận dụng không gian cho bảng và form nhập liệu.
- Vùng nội dung chính (main) theo từng mục con được chọn từ menu.

#### B.1.2. Menu bên trái (sidebar)

- Cố định bên trái để chuyển giữa các luồng con của **Tính lương** (gợi ý):
  - Lương cá nhân
  - Mẫu tính lương theo bộ phận
  - Tính lương toàn nhân viên  
- *(Tùy chọn sau: icon, thu gọn sidebar trên màn hình nhỏ.)*

### B.2. Các luồng con (roadmap)

#### B.2.1. Lương cá nhân

- **Mục đích:** nhân viên xem lương của mình. **Hiện tại:** chưa có — placeholder / “Sắp ra mắt”.
- **Tương lai:** đăng nhập, chỉ xem lương theo kỳ; không sửa số liệu tính lương (trừ khi đổi nghiệp vụ).

#### B.2.2. Mẫu tính lương theo từng bộ phận

- **Đối tượng:** kế toán (hoặc role cấu hình).
- **Mẫu** gắn bộ phận; mỗi mẫu có danh sách field (lương cứng, KPI, hoa hồng, …); **mỗi field** có tùy chọn **“Không có”**.
- **UI gợi ý:** chọn bộ phận → CRUD mẫu; soạn field (tên, loại, bắt buộc, cờ “Không có”).

#### B.2.3. Tính lương cho toàn bộ nhân viên

- Bảng nhân viên theo bộ phận; nhập số theo **mẫu**; tính lương; **xuất Excel** (phạm vi xuất: theo kỳ/filter — quy định khi làm).
- Làm rõ sau: công thức tổng hợp, phân quyền xem/sửa/xuất.

### B.3. Tóm tắt luồng người dùng (khi đủ phần B)

1. Vào **Tính lương** (full screen + sidebar).
2. Kế toán: cấu hình **mẫu theo bộ phận**.
3. Kế toán: **tính lương toàn nhân viên**, kỳ, nhập số, xuất Excel.
4. Nhân viên: **Lương cá nhân** (chỉ xem).

### B.4. Phụ thuộc / tích hợp

- Master **bộ phận** / **nhân viên**; auth cho lương cá nhân; xuất Excel (client hoặc API server).

---

*Tài liệu gộp đặc tả hiện tại (`salary-calc`) và roadmap; cập nhật khi đổi hành vi hoặc mockup.*
