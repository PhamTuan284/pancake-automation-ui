import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Dev: `.env.development` → `http://localhost:4001` (CORS on API).
 * Prod: `.env.production` → Railway origin (no trailing `/`).
 * If unset, falls back to `/api` + path (Vite dev proxy → same port as `PANCAKE_API_PORT` in vite.config).
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');
function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!API_ORIGIN) return `/api${p}`;
  return `${API_ORIGIN}${p}`;
}

/** Registered tools; add entries here as new UIs ship. */
const TOOLS = [
  {
    id: 'pancake-einvoice',
    label: 'Pancake · Hóa đơn điện tử',
    description: 'Điền dữ liệu khách từ Excel / JSON và chạy automation trên POS.',
  },
  {
    id: '_more',
    label: 'Công cụ khác',
    disabled: true,
    description: 'Sẽ xuất hiện khi có thêm module.',
  },
];

const TABLE_COLUMNS = [
  { key: 'buyerName', label: 'Tên khách hàng' },
  { key: 'operationName', label: 'Tên đơn vị' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'idNumber', label: 'Số CCCD' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'businessLicense', label: 'Giấy phép kinh doanh' },
];

function displayCell(value) {
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

function rowMatchesQuery(row, queryNorm) {
  if (!queryNorm) return true;
  const haystack = TABLE_COLUMNS.map((c) =>
    String(row[c.key] ?? '')
      .toLocaleLowerCase('vi-VN')
      .trim()
  ).join(' ');
  return haystack.includes(queryNorm);
}

function emptyCustomerForm() {
  return Object.fromEntries(TABLE_COLUMNS.map((c) => [c.key, '']));
}

export default function App() {
  const [activeToolId, setActiveToolId] = useState('pancake-einvoice');
  const [status, setStatus] = useState('sẵn sàng');
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [dataSearch, setDataSearch] = useState('');
  const [customerModal, setCustomerModal] = useState(null);
  const [formDraft, setFormDraft] = useState(() => emptyCustomerForm());
  const [crudSaving, setCrudSaving] = useState(false);
  const [crudError, setCrudError] = useState('');
  const [crudMessage, setCrudMessage] = useState('');

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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Không tải được dữ liệu');
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setDataSearch('');
    } catch (err) {
      console.error(err);
      setDataError(
        err.message ||
          'Không kết nối được API. Chạy npm start trong pancake-automation-server.'
      );
      setRows([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoiceData();
  }, [loadInvoiceData]);

  const persistInvoiceRows = useCallback(
    async (nextRows) => {
      setCrudSaving(true);
      setCrudError('');
      try {
        const res = await fetch(apiUrl('/invoice-data'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: nextRows }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Lưu thất bại');
        }
        await loadInvoiceData();
        setCrudMessage('Đã cập nhật invoiceData.json.');
        setTimeout(() => setCrudMessage(''), 3200);
        setCustomerModal(null);
      } catch (err) {
        console.error(err);
        setCrudError(err.message || 'Lỗi lưu dữ liệu');
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

  const openEditCustomer = (origIndex) => {
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
      ),
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
    let nextRows;
    if (customerModal.mode === 'add') {
      nextRows = [...rows, { ...formDraft }];
    } else {
      nextRows = rows.map((r, i) =>
        i === customerModal.index ? { ...formDraft } : r
      );
    }
    await persistInvoiceRows(nextRows);
  };

  const deleteCustomerAt = (origIndex) => {
    const row = rows[origIndex];
    const label =
      String(row?.buyerName || row?.operationName || 'dòng này').trim() ||
      'dòng này';
    if (
      !window.confirm(`Xóa khách hàng “${label}” khỏi danh sách?`)
    ) {
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
      const data = await res.json().catch(() => ({}));
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
        err.message ||
          'Could not reach the server. Start the API: npm start in pancake-automation-server.'
      );
    }
  };

  const onUpload = async (e) => {
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Tải file thất bại');
      }
      setUploadStatus('Đã nhập');
      setUploadMessage(`Đã nhập ${data.count} dòng vào invoiceData.json.`);
      await loadInvoiceData();
    } catch (err) {
      console.error(err);
      setUploadStatus('Lỗi');
      setUploadMessage(err.message || 'Lỗi upload');
    }
  };

  const activeTool = TOOLS.find((t) => t.id === activeToolId) || TOOLS[0];

  return (
    <div className="page">
      <header className="app-brand" role="banner">
        <div className="app-brand-inner">
          <h1 className="app-brand-title">MeiT Tools</h1>
          <p className="app-brand-tagline">
            Bộ công cụ nội bộ — chọn tiện ích bên dưới. Các module mới sẽ được
            thêm dần.
          </p>
        </div>
      </header>

      <nav className="tool-nav" aria-label="Chọn công cụ">
        <div className="tool-nav-inner">
          <ul className="tool-nav-list">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                {tool.disabled ? (
                  <span
                    className="tool-nav-item tool-nav-item--soon"
                    title={tool.description}
                  >
                    <span className="tool-nav-label">{tool.label}</span>
                    <span className="tool-nav-soon">Sắp có</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={
                      activeToolId === tool.id
                        ? 'tool-nav-item tool-nav-item--active'
                        : 'tool-nav-item'
                    }
                    aria-current={
                      activeToolId === tool.id ? 'page' : undefined
                    }
                    onClick={() => setActiveToolId(tool.id)}
                  >
                    <span className="tool-nav-label">{tool.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="layout">
        {activeToolId === 'pancake-einvoice' && (
          <>
            <p className="tool-intro muted">
              {activeTool.description}{' '}
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
                Mở trình duyệt điều khiển, đăng nhập POS và lần lượt xử lý các
                hóa đơn <strong>Chưa phát hành</strong> khớp dữ liệu trong{' '}
                <code>invoiceData.json</code>.
              </p>
              <button
                type="button"
                className="btn"
                onClick={runAutomation}
                disabled={status === 'đang chạy'}
              >
                {status === 'đang chạy' ? 'Đang chạy…' : 'Chạy tự động'}
              </button>
              <p className="status">
                Trạng thái: <strong>{status}</strong>
              </p>
              {message && <p className="hint">{message}</p>}
            </section>

            <section className="card" aria-labelledby="pancake-excel-title">
              <h2 id="pancake-excel-title" className="section-title">
                Tải file Excel
              </h2>
              <p className="muted small">
                Dòng đầu tiên phải là tiêu đề:{' '}
                <strong>
                  Tên khách hàng, Mã số thuế, Số điện thoại, Số CCCD, Địa chỉ,
                  Giấy phép kinh doanh, Tên đơn vị
                </strong>
                . Sheet đầu tiên được dùng. Mỗi lần tải sẽ{' '}
                <strong>thay thế</strong> toàn bộ nội dung{' '}
                <code>invoiceData.json</code>.
              </p>
              <label className="file-label">
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={onUpload}
                  disabled={uploadStatus === 'Đang xử lý'}
                />
                <span className="file-btn">
                  {uploadStatus === 'Đang xử lý'
                    ? 'Đang xử lý…'
                    : 'Chọn file .xlsx / .xls'}
                </span>
              </label>
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
                  Chưa có dòng nào. Dùng <strong>Thêm khách hàng</strong>, tải
                  Excel hoặc sửa file JSON.
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
        )}
      </div>
    </div>
  );
}
