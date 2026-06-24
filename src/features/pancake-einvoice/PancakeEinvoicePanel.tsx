import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import { ProductStockZaloSection } from '../pancake-webhook/ProductStockZaloSection';
import TablePagination from '@mui/material/TablePagination';
import type { InvoiceShopKey } from '../../config/invoiceShops';
import { invoiceApiBase } from '../../config/invoiceShops';
import type { CustomerModalState, InvoiceRow } from '../../types';
import { apiUrl } from '../../lib/api';
import {
  UiButton,
  UiDataTable,
  type UiDataTableColumn,
} from '../../components/ui';
import { TABLE_COLUMNS } from './tableConstants';
import {
  displayCell,
  emptyCustomerForm,
  parseInvoiceRows,
  rowMatchesQuery,
} from './invoiceTableUtils';

/** Single WDIO feature file = one Cucumber run from the UI (matches server `spec` body). */
const UI_WDIO_SINGLE_SPEC =
  './wdio/features/pancake-einvoice-automation.feature';
const DATA_TABLE_DEFAULT_PAGE_SIZE = 20;
const DATA_TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function PancakeEinvoicePanel({
  shopKey,
  shopLabel,
  defaultPancakeShopId,
  toolDescription,
}: {
  shopKey: InvoiceShopKey;
  shopLabel: string;
  defaultPancakeShopId: string;
  toolDescription: string;
}) {
  const apiBase = invoiceApiBase(shopKey);
  const pancakeEinvoiceUrl = `https://pos.pancake.vn/shop/${defaultPancakeShopId}/e-invoices`;
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [dataSearch, setDataSearch] = useState('');
  const [dataPage, setDataPage] = useState(1);
  const [dataRowsPerPage, setDataRowsPerPage] = useState(
    DATA_TABLE_DEFAULT_PAGE_SIZE
  );
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
  const [saveMode, setSaveMode] = useState<'draft' | 'publish'>('draft');
  const [meitDailyConfigured, setMeitDailyConfigured] = useState(
    shopKey !== 'meit'
  );
  const [meitModeInvoiceUrl, setMeitModeInvoiceUrl] = useState(pancakeEinvoiceUrl);
  const [meitDailyInvoiceUrl, setMeitDailyInvoiceUrl] = useState('');

  const searchNorm = useMemo(
    () => dataSearch.trim().toLocaleLowerCase('vi-VN'),
    [dataSearch]
  );

  const filteredRows = useMemo(() => {
    const withIdx = rows.map((row, origIndex) => ({ row, origIndex }));
    if (!searchNorm) return withIdx;
    return withIdx.filter(({ row }) => rowMatchesQuery(row, searchNorm));
  }, [rows, searchNorm]);
  const dataTotalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / dataRowsPerPage)
  );
  const dataCurrentPage = Math.min(dataPage, dataTotalPages);
  const pageStartIndex = (dataCurrentPage - 1) * dataRowsPerPage;
  const pagedRows = useMemo(
    () => filteredRows.slice(pageStartIndex, pageStartIndex + dataRowsPerPage),
    [filteredRows, pageStartIndex, dataRowsPerPage]
  );
  const invoiceTableColumns: UiDataTableColumn<(typeof pagedRows)[number]>[] = [
    {
      key: 'idx',
      header: '#',
      headerClassName: 'col-idx',
      cellClassName: 'col-idx muted-cell',
      render: (_entry, rowIndex) => pageStartIndex + rowIndex + 1,
    },
    ...TABLE_COLUMNS.map((c) => ({
      key: String(c.key),
      header: c.label,
      render: (entry: (typeof pagedRows)[number]) => displayCell(entry.row[c.key]),
    })),
    {
      key: 'actions',
      header: 'Thao tác',
      headerClassName: 'col-actions',
      cellClassName: 'col-actions',
      render: (entry: (typeof pagedRows)[number]) => (
        <div className="row-actions">
          <UiButton
            variant="tiny"
            onClick={() => openEditCustomer(entry.origIndex)}
          >
            Sửa
          </UiButton>
          <UiButton
            variant="tiny"
            tone="danger"
            onClick={() => deleteCustomerAt(entry.origIndex)}
            disabled={crudSaving}
          >
            Xóa
          </UiButton>
        </div>
      ),
    },
  ];

  useEffect(() => {
    setDataPage(1);
  }, [searchNorm, rows.length]);

  useEffect(() => {
    if (dataPage > dataTotalPages) {
      setDataPage(dataTotalPages);
    }
  }, [dataPage, dataTotalPages]);

  const loadInvoiceData = useCallback(async () => {
    setDataLoading(true);
    setDataError('');
    try {
      const res = await fetch(apiUrl(`${apiBase}/invoice-data`));
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
  }, [apiBase]);

  useEffect(() => {
    void loadInvoiceData();
  }, [loadInvoiceData]);

  useEffect(() => {
    if (shopKey !== 'meit') return;
    void (async () => {
      try {
        const res = await fetch(apiUrl(`${apiBase}/config`));
        const data = (await res.json().catch(() => ({}))) as {
          meitAutomationTargets?: Array<{
            variant: string;
            label: string;
            invoiceUrl: string;
            configured?: boolean;
          }>;
        };
        if (!res.ok) return;
        const targets = data.meitAutomationTargets ?? [];
        const mode = targets.find((t) => t.variant === 'mode');
        const daily = targets.find((t) => t.variant === 'daily');
        if (mode?.invoiceUrl) {
          setMeitModeInvoiceUrl(mode.invoiceUrl);
        }
        if (daily?.invoiceUrl) {
          setMeitDailyInvoiceUrl(daily.invoiceUrl);
        }
        setMeitDailyConfigured(Boolean(daily?.configured));
      } catch {
        /* keep defaults */
      }
    })();
  }, [apiBase, shopKey]);

  const persistInvoiceRows = useCallback(
    async (nextRows: InvoiceRow[]) => {
      setCrudSaving(true);
      setCrudError('');
      try {
        const res = await fetch(apiUrl(`${apiBase}/invoice-data`), {
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

  const resetAutomationFlag = async () => {
    try {
      await fetch(apiUrl('/pancake-einvoice/reset-automation-flag'), {
        method: 'POST',
      });
      setE2eStatus('sẵn sàng');
      setE2eMessage('Đã reset trạng thái. Kiểm tra server để đảm bảo không còn tiến trình nào đang chạy.');
    } catch {
      setE2eMessage('Không gọi được API reset.');
    }
  };

  const runE2eTests = async (meitVariant?: 'mode' | 'daily') => {
    const runLabel =
      shopKey === 'meit'
        ? meitVariant === 'daily'
          ? 'MeiT Daily'
          : 'MeiT Mode'
        : shopLabel;
    setE2eStatus('đang chạy');
    setE2eMessage('');
    try {
      const res = await fetch(apiUrl(`${apiBase}/run-e2e-tests`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: UI_WDIO_SINGLE_SPEC,
          shop: shopKey,
          saveMode,
          ...(shopKey === 'meit' && meitVariant
            ? { meitVariant }
            : shopKey === 'meit'
              ? { meitVariant: 'mode' }
              : {}),
        }),
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
        `Đã chạy xong (${runLabel}). Xem log trên terminal server.`
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
      const res = await fetch(apiUrl(`${apiBase}/upload-invoice-excel`), {
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
        {shopKey === 'meit' ? (
          <>
            <a href={meitModeInvoiceUrl} target="_blank" rel="noreferrer">
              MeiT Mode
            </a>
            {meitDailyInvoiceUrl ? (
              <>
                {' '}
                ·{' '}
                <a href={meitDailyInvoiceUrl} target="_blank" rel="noreferrer">
                  MeiT Daily
                </a>
              </>
            ) : null}
          </>
        ) : (
          <a href={pancakeEinvoiceUrl} target="_blank" rel="noreferrer">
            Mở e-invoices {shopLabel} trên Pancake
          </a>
        )}
        .
      </p>

      <section className="card" aria-labelledby="pancake-run-title">
        <h2 id="pancake-run-title" className="section-title">
          Tự động phát hành hóa đơn ({shopLabel})
        </h2>
        <div className="save-mode-row">
          <span className="save-mode-label">Sau khi điền xong:</span>
          <label className="save-mode-option">
            <input
              type="radio"
              name={`save-mode-${shopKey}`}
              value="draft"
              checked={saveMode === 'draft'}
              onChange={() => setSaveMode('draft')}
            />
            {' '}Lưu (nháp)
          </label>
          <label className="save-mode-option">
            <input
              type="radio"
              name={`save-mode-${shopKey}`}
              value="publish"
              checked={saveMode === 'publish'}
              onChange={() => setSaveMode('publish')}
            />
            {' '}Lưu và phát hành
          </label>
        </div>
        <div className="run-automation-actions">
          {shopKey === 'meit' ? (
            <>
              <UiButton
                onClick={() => void runE2eTests('mode')}
                disabled={e2eStatus === 'đang chạy'}
              >
                {e2eStatus === 'đang chạy'
                  ? 'Đang chạy…'
                  : 'Bắt đầu · MeiT Mode'}
              </UiButton>
              <UiButton
                onClick={() => void runE2eTests('daily')}
                disabled={e2eStatus === 'đang chạy' || !meitDailyConfigured}
                title={
                  meitDailyConfigured
                    ? undefined
                    : 'Cần PANCAKE_MEIT_DAILY_SHOP_ID trên server'
                }
              >
                {e2eStatus === 'đang chạy'
                  ? 'Đang chạy…'
                  : 'Bắt đầu · MeiT Daily'}
              </UiButton>
            </>
          ) : (
            <UiButton
              onClick={() => void runE2eTests()}
              disabled={e2eStatus === 'đang chạy'}
            >
              {e2eStatus === 'đang chạy' ? 'Đang chạy…' : 'Bắt đầu'}
            </UiButton>
          )}
        </div>
        {shopKey === 'meit' && !meitDailyConfigured && (
          <p className="muted small">
            MeiT Daily: đặt <code>PANCAKE_MEIT_DAILY_SHOP_ID</code> và{' '}
            <code>PANCAKE_MEIT_DAILY_API_KEY</code> trên server để bật nút thứ
            hai.
          </p>
        )}
        <p className="status status-e2e">
          Trạng thái: <strong>{e2eStatus}</strong>
          {e2eStatus === 'đang chạy' && (
            <UiButton
              variant="secondary"
              tone="danger"
              onClick={() => void resetAutomationFlag()}
              title="Dùng khi tiến trình bị kẹt và không tự dừng được"
              style={{ marginLeft: '12px', fontSize: '12px', padding: '2px 8px' }}
            >
              Force reset
            </UiButton>
          )}
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
          <strong>thay thế</strong> toàn bộ dữ liệu khách hàng của{' '}
          <strong>{shopLabel}</strong> trên server (Mongo collection riêng).
        </p>
        <div className="excel-upload-toolbar">
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
                : 'Tải lên file .xlsx / .xls'}
            </span>
          </label>
          <a
            className="btn-secondary excel-template-link"
            href={apiUrl(`${apiBase}/invoice-excel-template`)}
            download="mau-khach-hang-hoa-don-dien-tu.xlsx"
          >
            Tải file Excel mẫu
          </a>
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
            Dữ liệu khách — {shopLabel}
          </h2>
          {!dataLoading && !dataError && (
            <div className="table-head-actions">
              <UiButton variant="secondary" onClick={openAddCustomer}>
                + Thêm khách hàng
              </UiButton>
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
          <>
            <UiDataTable
              rows={pagedRows}
              columns={invoiceTableColumns}
              rowKey={(entry) => entry.origIndex}
            />
            <TablePagination
              component="div"
              className="table-pagination"
              count={filteredRows.length}
              rowsPerPage={dataRowsPerPage}
              page={dataCurrentPage - 1}
              rowsPerPageOptions={DATA_TABLE_PAGE_SIZE_OPTIONS}
              onPageChange={(_event, newPage) => {
                setDataPage(newPage + 1);
              }}
              onRowsPerPageChange={(event) => {
                const nextSize = Number(event.target.value);
                setDataRowsPerPage(nextSize);
                setDataPage(1);
              }}
              labelRowsPerPage="Mỗi trang:"
              labelDisplayedRows={({ from, to, count }) =>
                `Hiển thị ${from}-${to} / ${count}`
              }
            />
          </>
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
              <UiButton
                variant="secondary"
                onClick={closeCustomerModal}
                disabled={crudSaving}
              >
                Hủy
              </UiButton>
              <UiButton
                className="btn-modal-save"
                onClick={() => void saveCustomerForm()}
                disabled={crudSaving}
              >
                {crudSaving ? 'Đang lưu…' : 'Lưu'}
              </UiButton>
            </div>
          </div>
        </div>
      )}
      <ProductStockZaloSection shopKey={shopKey} />
    </>
  );
}
