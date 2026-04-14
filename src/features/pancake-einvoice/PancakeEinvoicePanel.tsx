import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import type { CustomerModalState, InvoiceRow } from '../../types';
import { apiUrl } from '../../lib/api';
import { TABLE_COLUMNS } from './tableConstants';
import {
  displayCell,
  emptyCustomerForm,
  parseInvoiceRows,
  rowMatchesQuery,
} from './invoiceTableUtils';

export function PancakeEinvoicePanel({
  toolDescription,
}: {
  toolDescription: string;
}) {
  const [status, setStatus] = useState('sẵn sàng');
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [dataSearch, setDataSearch] = useState('');
  const [customerModal, setCustomerModal] = useState<CustomerModalState | null>(
    null
  );
  const [formDraft, setFormDraft] = useState<InvoiceRow>(() =>
    emptyCustomerForm()
  );
  const [crudSaving, setCrudSaving] = useState(false);
  const [crudError, setCrudError] = useState('');
  const [crudMessage, setCrudMessage] = useState('');
  const [e2eStatus, setE2eStatus] = useState('sẵn sàng');
  const [e2eMessage, setE2eMessage] = useState('');

  const searchNorm = useMemo(
    () => dataSearch.trim().toLocaleLowerCase('vi-VN'),
    [dataSearch]
  );

  const filteredRows = useMemo(() => {
    const withIdx = rows.map((row, origIndex) => ({ row, origIndex }));
    if (!searchNorm) return withIdx;
    return withIdx.filter(({ row }) => rowMatchesQuery(row, searchNorm));
  }, [rows, searchNorm]);

  const loadInvoiceData = useCallback(async () => {
    setDataLoading(true);
    setDataError('');
    try {
      const res = await fetch(apiUrl('/invoice-data'));
      const data = (await res.json().catch(() => ({}))) as {
        rows?: unknown;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Không tải được dữ liệu');
      }
      setRows(parseInvoiceRows(data.rows));
      setDataSearch('');
    } catch (err) {
      console.error(err);
      setDataError(
        err instanceof Error
          ? err.message
          : 'Không kết nối được API. Chạy npm start trong pancake-automation-server.'
      );
      setRows([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoiceData();
  }, [loadInvoiceData]);

  const persistInvoiceRows = useCallback(
    async (nextRows: InvoiceRow[]) => {
      setCrudSaving(true);
      setCrudError('');
      try {
        const res = await fetch(apiUrl('/invoice-data'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: nextRows }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error || 'Lưu thất bại');
        }
        await loadInvoiceData();
        setCrudMessage('Đã cập nhật dữ liệu khách hàng.');
        setTimeout(() => setCrudMessage(''), 3200);
        setCustomerModal(null);
      } catch (err) {
        console.error(err);
        setCrudError(
          err instanceof Error ? err.message : 'Lỗi lưu dữ liệu'
        );
      } finally {
        setCrudSaving(false);
      }
    },
    [loadInvoiceData]
  );

  const openAddCustomer = () => {
    setCrudError('');
    setFormDraft(emptyCustomerForm());
    setCustomerModal({ mode: 'add' });
  };

  const openEditCustomer = (origIndex: number) => {
    setCrudError('');
    const row = rows[origIndex];
    if (!row) return;
    setFormDraft({
      ...emptyCustomerForm(),
      ...Object.fromEntries(
        TABLE_COLUMNS.map((c) => [
          c.key,
          row[c.key] == null ? '' : String(row[c.key]),
        ])
      ) as InvoiceRow,
    });
    setCustomerModal({ mode: 'edit', index: origIndex });
  };

  const closeCustomerModal = () => {
    if (crudSaving) return;
    setCustomerModal(null);
    setCrudError('');
  };

  const saveCustomerForm = async () => {
    if (!customerModal) return;
    setCrudError('');
    const bn = String(formDraft.buyerName ?? '').trim();
    const on = String(formDraft.operationName ?? '').trim();
    if (!bn && !on) {
      setCrudError('Cần ít nhất Tên khách hàng hoặc Tên đơn vị.');
      return;
    }
    let nextRows: InvoiceRow[];
    if (customerModal.mode === 'add') {
      nextRows = [...rows, { ...formDraft }];
    } else {
      nextRows = rows.map((r, i) =>
        i === customerModal.index ? { ...formDraft } : r
      );
    }
    await persistInvoiceRows(nextRows);
  };

  const deleteCustomerAt = (origIndex: number) => {
    const row = rows[origIndex];
    const label =
      String(row?.buyerName || row?.operationName || 'dòng này').trim() ||
      'dòng này';
    if (!window.confirm(`Xóa khách hàng “${label}” khỏi danh sách?`)) {
      return;
    }
    const nextRows = rows.filter((_, i) => i !== origIndex);
    void persistInvoiceRows(nextRows);
  };

  const runAutomation = async () => {
    setStatus('đang chạy');
    setMessage('');
    try {
      const res = await fetch(apiUrl('/run-einvoice-automation'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) {
        setStatus('đang bận');
        setMessage(data.error || 'Automation is already running.');
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setStatus('sẵn sàng');
      setMessage(
        'Automation run finished. Chrome window should have closed; you can run it again.'
      );
    } catch (err) {
      console.error(err);
      setStatus('lỗi');
      setMessage(
        err instanceof Error
          ? err.message
          : 'Could not reach the server. Start the API: npm start in pancake-automation-server.'
      );
    }
  };

  const runE2eTests = async () => {
    setE2eStatus('đang chạy');
    setE2eMessage('');
    try {
      const res = await fetch(apiUrl('/run-e2e-tests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 409) {
        setE2eStatus('đang bận');
        setE2eMessage(data.error || 'Job is already running.');
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || 'E2E run failed');
      }
      setE2eStatus('sẵn sàng');
      setE2eMessage(
        'Bộ kiểm thử Cucumber/WDIO đã chạy xong (xem log trên terminal server).'
      );
    } catch (err) {
      console.error(err);
      setE2eStatus('lỗi');
      setE2eMessage(
        err instanceof Error
          ? err.message
          : 'Không gọi được API. Chạy npm start trong pancake-automation-server.'
      );
    }
  };

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadStatus('Đang xử lý');
    setUploadMessage('Đang xử lý file…');
    const body = new FormData();
    body.append('file', file);

    try {
      const res = await fetch(apiUrl('/upload-invoice-excel'), {
        method: 'POST',
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        count?: number;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Tải file thất bại');
      }
      setUploadStatus('Đã nhập');
      setUploadMessage(
        `Đã nhập ${data.count ?? 0} dòng vào kho dữ liệu.`
      );
      await loadInvoiceData();
    } catch (err) {
      console.error(err);
      setUploadStatus('Lỗi');
      setUploadMessage(
        err instanceof Error ? err.message : 'Lỗi upload'
      );
    }
  };

  return (
    <>
      <p className="tool-intro muted">
        {toolDescription}{' '}
        <a
          href="https://pos.pancake.vn/shop/1942925579/e-invoices"
          target="_blank"
          rel="noreferrer"
        >
          Mở e-invoices trên Pancake
        </a>
        .
      </p>

      <section className="card" aria-labelledby="pancake-run-title">
        <h2 id="pancake-run-title" className="section-title">
          Chạy automation
        </h2>
        <p className="muted small">
          Mở trình duyệt điều khiển, đăng nhập POS và lần lượt xử lý các hóa đơn{' '}
          <strong>Chưa phát hành</strong> khớp dữ liệu khách hàng (API / DB).
        </p>
        <div className="run-automation-actions">
          <button
            type="button"
            className="btn"
            onClick={() => void runAutomation()}
            disabled={status === 'đang chạy' || e2eStatus === 'đang chạy'}
          >
            {status === 'đang chạy' ? 'Đang chạy…' : 'Chạy tự động'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void runE2eTests()}
            disabled={e2eStatus === 'đang chạy' || status === 'đang chạy'}
          >
            {e2eStatus === 'đang chạy'
              ? 'Đang chạy E2E…'
              : 'Chạy kiểm thử E2E (Cucumber)'}
          </button>
        </div>
        <p className="status">
          Trạng thái automation: <strong>{status}</strong>
        </p>
        {message && <p className="hint">{message}</p>}
        <p className="status status-e2e">
          Trạng thái E2E: <strong>{e2eStatus}</strong>
        </p>
        {e2eMessage && <p className="hint">{e2eMessage}</p>}
      </section>

      <section className="card" aria-labelledby="pancake-excel-title">
        <h2 id="pancake-excel-title" className="section-title">
          Tải file Excel
        </h2>
        <p className="muted small">
          Dòng đầu tiên phải là tiêu đề:{' '}
          <strong>
            Tên khách hàng, Mã số thuế, Số điện thoại, Số CCCD, Địa chỉ, Giấy
            phép kinh doanh, Tên đơn vị
          </strong>
          . Sheet đầu tiên được dùng. Mỗi lần tải sẽ{' '}
          <strong>thay thế</strong> toàn bộ dữ liệu khách hàng trên server.
        </p>
        <div className="excel-upload-toolbar">
          <a
            className="btn-secondary excel-template-link"
            href={apiUrl('/invoice-excel-template')}
            download="mau-khach-hang-hoa-don-dien-tu.xlsx"
          >
            Tải file mẫu Excel
          </a>
          <label className="file-label excel-file-label">
            <input
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(e) => void onUpload(e)}
              disabled={uploadStatus === 'Đang xử lý'}
            />
            <span className="file-btn">
              {uploadStatus === 'Đang xử lý'
                ? 'Đang xử lý…'
                : 'Chọn file .xlsx / .xls'}
            </span>
          </label>
        </div>
        {uploadMessage && (
          <p
            className={
              uploadStatus === 'Lỗi' ? 'hint hint-error' : 'hint hint-ok'
            }
          >
            {uploadMessage}
          </p>
        )}
      </section>

      <section
        className="card card-table"
        aria-labelledby="pancake-data-title"
      >
        <div className="table-head">
          <h2 id="pancake-data-title" className="section-title">
            Dữ liệu hiện tại
          </h2>
          {!dataLoading && !dataError && (
            <div className="table-head-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={openAddCustomer}
              >
                + Thêm khách hàng
              </button>
              <div className="table-head-badges">
                <span className="badge">{rows.length} khách</span>
                {searchNorm && rows.length > 0 && (
                  <span className="badge badge-accent">
                    Hiển thị {filteredRows.length} / {rows.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
        {crudMessage && (
          <p className="hint hint-ok crud-toast">{crudMessage}</p>
        )}
        {crudError && !customerModal && (
          <p className="hint hint-error">{crudError}</p>
        )}
        {!dataLoading && !dataError && rows.length > 0 && (
          <div className="search-row">
            <label className="search-label" htmlFor="data-search">
              Tìm kiếm
            </label>
            <div className="search-input-wrap">
              <input
                id="data-search"
                type="search"
                className="search-input"
                placeholder="Tên, MST, SĐT, CCCD, địa chỉ, GPĐKKD, đơn vị…"
                value={dataSearch}
                onChange={(e) => setDataSearch(e.target.value)}
                autoComplete="off"
              />
              {dataSearch.trim() !== '' && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setDataSearch('')}
                  aria-label="Xóa tìm kiếm"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}
        {dataLoading && <p className="muted">Đang tải…</p>}
        {dataError && <p className="hint hint-error">{dataError}</p>}
        {!dataLoading && !dataError && rows.length === 0 && (
          <p className="muted">
            Chưa có dòng nào. Dùng <strong>Thêm khách hàng</strong>, tải Excel
            hoặc sửa file JSON.
          </p>
        )}
        {!dataLoading &&
          !dataError &&
          rows.length > 0 &&
          filteredRows.length === 0 && (
            <p className="muted">
              Không có dòng nào khớp “{dataSearch.trim()}”.{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => setDataSearch('')}
              >
                Xóa bộ lọc
              </button>
            </p>
          )}
        {!dataLoading && !dataError && filteredRows.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-idx">#</th>
                  {TABLE_COLUMNS.map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th className="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ row, origIndex }, i) => (
                  <tr key={origIndex}>
                    <td className="col-idx muted-cell">{i + 1}</td>
                    {TABLE_COLUMNS.map((c) => (
                      <td key={c.key}>{displayCell(row[c.key])}</td>
                    ))}
                    <td className="col-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn-tiny"
                          onClick={() => openEditCustomer(origIndex)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className="btn-tiny btn-tiny-danger"
                          onClick={() => deleteCustomerAt(origIndex)}
                          disabled={crudSaving}
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {customerModal && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeCustomerModal}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="customer-modal-title" className="modal-title">
              {customerModal.mode === 'add'
                ? 'Thêm khách hàng'
                : 'Sửa khách hàng'}
            </h3>
            <div className="modal-form">
              {TABLE_COLUMNS.map((c) => (
                <label key={c.key} className="modal-field">
                  <span className="modal-label">{c.label}</span>
                  {c.key === 'address' ? (
                    <textarea
                      className="modal-input modal-textarea"
                      rows={3}
                      value={formDraft[c.key] ?? ''}
                      onChange={(e) =>
                        setFormDraft((d) => ({
                          ...d,
                          [c.key]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      className="modal-input"
                      value={formDraft[c.key] ?? ''}
                      onChange={(e) =>
                        setFormDraft((d) => ({
                          ...d,
                          [c.key]: e.target.value,
                        }))
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            {crudError && (
              <p className="hint hint-error modal-error">{crudError}</p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeCustomerModal}
                disabled={crudSaving}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-modal-save"
                onClick={() => void saveCustomerForm()}
                disabled={crudSaving}
              >
                {crudSaving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
