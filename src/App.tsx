import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import type {
  ColumnKey,
  CustomerModalState,
  IntegrationServiceInfo,
  IntegrationsBundle,
  InvoiceRow,
  PancakeWebhookConfig,
  PancakeWebhookEventRow,
  ToolDef,
} from './types';

/**
 * Dev: `.env.development` → `http://localhost:4001` (CORS on API).
 * Prod: `.env.production` → Railway origin (no trailing `/`).
 * If unset, falls back to `/api` + path (Vite dev proxy → same port as `PANCAKE_API_PORT` in vite.config).
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!API_ORIGIN) return `/api${p}`;
  return `${API_ORIGIN}${p}`;
}

function extractWarehouseRows(root: unknown): Record<string, unknown>[] {
  const asRowObjects = (arr: unknown): Record<string, unknown>[] => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x): x is Record<string, unknown> =>
        x !== null && typeof x === 'object' && !Array.isArray(x)
    );
  };

  const direct = asRowObjects(root);
  if (direct.length > 0) return direct;

  if (!root || typeof root !== 'object' || Array.isArray(root)) return [];

  const o = root as Record<string, unknown>;
  for (const key of ['data', 'warehouses', 'results', 'items'] as const) {
    const inner = asRowObjects(o[key]);
    if (inner.length > 0) return inner;
    const nested = o[key];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const n = nested as Record<string, unknown>;
      for (const k2 of ['data', 'warehouses', 'results'] as const) {
        const inner2 = asRowObjects(n[k2]);
        if (inner2.length > 0) return inner2;
      }
    }
  }
  return [];
}

function warehouseTableColumns(rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const keys = new Set<string>();
  for (const r of rows.slice(0, 30)) {
    Object.keys(r).forEach((k) => keys.add(k));
  }
  const preferred = [
    'id',
    'warehouse_id',
    'name',
    'title',
    'address',
    'phone',
    'is_default',
    'status',
  ];
  const rest = [...keys].filter((k) => !preferred.includes(k)).sort();
  return [...preferred.filter((k) => keys.has(k)), ...rest].slice(0, 14);
}

function warehouseCellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Registered tools; add entries here as new UIs ship. */
const TOOLS: ToolDef[] = [
  {
    id: 'pancake-einvoice',
    label: 'Pancake · Hóa đơn điện tử',
    description:
      'Điền dữ liệu khách từ Excel / JSON và chạy automation trên POS.',
  },
  {
    id: 'pancake-webhook',
    label: 'Pancake · Webhook',
    description:
      'Nhận dữ liệu orders / khách / kho từ Pancake qua Webhook Open API.',
  },
  {
    id: 'opensource-hrm',
    label: 'HRM · Horilla',
    description:
      'Nhân sự mã nguồn mở (Horilla) — chạy bằng Docker trong monorepo MeiT Tools.',
  },
  {
    id: 'opensource-crm',
    label: 'CRM · EspoCRM',
    description:
      'CRM mã nguồn mở (EspoCRM) — chạy bằng Docker trong monorepo MeiT Tools.',
  },
];

function IntegrationServiceCard({
  info,
  focused,
}: {
  info: IntegrationServiceInfo;
  focused: boolean;
}) {
  const pillClass = info.reachable
    ? 'integration-status-pill integration-status-pill--ok'
    : 'integration-status-pill integration-status-pill--bad';

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(info.url);
    } catch {
      window.prompt('Sao chép URL:', info.url);
    }
  };

  return (
    <article
      className={
        focused
          ? 'integration-card integration-card--focus'
          : 'integration-card'
      }
    >
      <div className={pillClass}>
        {info.reachable ? 'Đang phản hồi' : 'Chưa kết nối được'}
      </div>
      <h3 className="integration-card-title">{info.product}</h3>
      <p className="integration-card-meta">Docker: {info.dockerImage}</p>
      <p className="integration-card-url">
        <code>{info.url}</code>
      </p>
      {info.error ? (
        <p className="hint hint-error integration-card-hint">
          {info.error}
          {info.httpStatus != null ? ` · HTTP ${info.httpStatus}` : ''}
        </p>
      ) : null}
      <div className="integration-actions">
        <a href={info.url} target="_blank" rel="noreferrer">
          Mở {info.product}
        </a>
        <button type="button" className="btn-secondary" onClick={() => void copyUrl()}>
          Sao chép URL
        </button>
      </div>
    </article>
  );
}

function MeitIntegrationsPanel({ focus }: { focus: 'hrm' | 'crm' }) {
  const [bundle, setBundle] = useState<IntegrationsBundle | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr('');
    try {
      const res = await fetch(apiUrl('/integrations'));
      const data = (await res.json().catch(() => ({}))) as Partial<
        IntegrationsBundle & { error?: string }
      >;
      if (!res.ok) {
        throw new Error(data.error || 'API lỗi');
      }
      setBundle(data as IntegrationsBundle);
    } catch (e) {
      setBundle(null);
      setLoadErr(
        e instanceof Error ? e.message : 'Không tải được /integrations'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 25000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <>
      <section className="card" aria-labelledby="meit-int-run-title">
        <h2 id="meit-int-run-title" className="section-title">
          Chạy stack trong repo MeiT Tools
        </h2>
        <p className="muted small">
          <strong>Horilla</strong> (HRM) và <strong>EspoCRM</strong> (CRM) được
          đóng gói trong{' '}
          <code>{bundle?.composeFile ?? 'docker-compose.integrations.yml'}</code>
          . Từ thư mục gốc monorepo:
        </p>
        <pre className="webhook-payload integration-cli-snippet">
          npm run integrations:up
        </pre>
        <p className="muted small integration-run-note">
          Tuỳ chọn: sao chép{' '}
          <code>{bundle?.envFileExample ?? 'compose.integrations.env.example'}</code>{' '}
          → <code>compose.integrations.env</code> (đã liệt kê trong{' '}
          <code>.gitignore</code>), chỉnh mật khẩu, rồi chạy{' '}
          <code>
            docker compose -f docker-compose.integrations.yml --env-file
            compose.integrations.env up -d
          </code>
          . Cổng mặc định: HRM <code>18080</code>, CRM <code>18081</code>. Tài
          liệu EspoCRM Docker:{' '}
          <a
            href="https://docs.espocrm.com/administration/docker/installation"
            target="_blank"
            rel="noreferrer"
          >
            docs.espocrm.com
          </a>
          ; Horilla image:{' '}
          <a
            href="https://hub.docker.com/r/horilla/horilla"
            target="_blank"
            rel="noreferrer"
          >
            Docker Hub
          </a>
          .
        </p>
      </section>

      <section className="card" aria-labelledby="meit-int-status-title">
        <div className="table-head">
          <h2 id="meit-int-status-title" className="section-title">
            Trạng thái dịch vụ
          </h2>
          <div className="table-head-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? 'Đang kiểm tra…' : 'Kiểm tra lại'}
            </button>
          </div>
        </div>
        {loadErr && <p className="hint hint-error">{loadErr}</p>}
        {loading && !bundle && !loadErr && (
          <p className="muted">Đang gọi API…</p>
        )}
        {bundle && (
          <div className="integration-grid">
            <IntegrationServiceCard
              info={bundle.hrm}
              focused={focus === 'hrm'}
            />
            <IntegrationServiceCard
              info={bundle.crm}
              focused={focus === 'crm'}
            />
          </div>
        )}
        <p className="muted small integration-run-note">
          Probe chạy trên server Node (GET <code>/integrations</code>). Nếu triển
          khai public, đặt <code>MEIT_HRM_PUBLIC_URL</code> và{' '}
          <code>MEIT_CRM_PUBLIC_URL</code> trong{' '}
          <code>pancake-automation-server/.env</code>.
        </p>
      </section>
    </>
  );
}

const TABLE_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'buyerName', label: 'Tên khách hàng' },
  { key: 'operationName', label: 'Tên đơn vị' },
  { key: 'taxCode', label: 'Mã số thuế' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'idNumber', label: 'Số CCCD' },
  { key: 'address', label: 'Địa chỉ' },
  { key: 'businessLicense', label: 'Giấy phép kinh doanh' },
];

function displayCell(value: unknown): string {
  const s = value == null ? '' : String(value).trim();
  return s || '—';
}

function rowMatchesQuery(row: InvoiceRow, queryNorm: string): boolean {
  if (!queryNorm) return true;
  const haystack = TABLE_COLUMNS.map((c) =>
    String(row[c.key] ?? '')
      .toLocaleLowerCase('vi-VN')
      .trim()
  ).join(' ');
  return haystack.includes(queryNorm);
}

function emptyCustomerForm(): InvoiceRow {
  return Object.fromEntries(TABLE_COLUMNS.map((c) => [c.key, ''])) as InvoiceRow;
}

function parseInvoiceRows(raw: unknown): InvoiceRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const base = emptyCustomerForm();
    if (item && typeof item === 'object') {
      for (const c of TABLE_COLUMNS) {
        const v = (item as Record<string, unknown>)[c.key];
        base[c.key] = v == null ? '' : String(v);
      }
    }
    return base;
  });
}

export default function App() {
  const [activeToolId, setActiveToolId] = useState('pancake-einvoice');
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

  const [whConfig, setWhConfig] = useState<PancakeWebhookConfig | null>(null);
  const [whConfigError, setWhConfigError] = useState('');
  const [whEvents, setWhEvents] = useState<PancakeWebhookEventRow[]>([]);
  const [whEventsSource, setWhEventsSource] = useState('');
  const [whPanelLoading, setWhPanelLoading] = useState(false);
  const [whEventsLoading, setWhEventsLoading] = useState(false);
  const [whMessage, setWhMessage] = useState('');
  const [whError, setWhError] = useState('');
  const [whRegisterUrl, setWhRegisterUrl] = useState('');
  const [whRegisterEmail, setWhRegisterEmail] = useState('');
  const [whTypes, setWhTypes] = useState<string[]>(['orders', 'customers']);
  const [whRegisterBusy, setWhRegisterBusy] = useState(false);
  const [whWarehousesLoading, setWhWarehousesLoading] = useState(false);
  const [whWarehousesError, setWhWarehousesError] = useState('');
  const [whWarehousesData, setWhWarehousesData] = useState<unknown>(null);

  const whWarehouseRows = useMemo(
    () => extractWarehouseRows(whWarehousesData),
    [whWarehousesData]
  );
  const whWarehouseCols = useMemo(
    () => warehouseTableColumns(whWarehouseRows),
    [whWarehouseRows]
  );

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

  const loadWebhookPanel = useCallback(async () => {
    setWhPanelLoading(true);
    setWhConfigError('');
    try {
      const res = await fetch(apiUrl('/pancake-webhook/config'));
      const data = (await res.json().catch(() => ({}))) as Partial<
        PancakeWebhookConfig & { error?: string }
      >;
      if (!res.ok) {
        throw new Error(data.error || 'Không tải cấu hình webhook');
      }
      setWhConfig(data as PancakeWebhookConfig);
    } catch (err) {
      console.error(err);
      setWhConfig(null);
      setWhConfigError(
        err instanceof Error
          ? err.message
          : 'Không kết nối được API webhook.'
      );
    } finally {
      setWhPanelLoading(false);
    }
  }, []);

  const loadWebhookEvents = useCallback(async () => {
    setWhEventsLoading(true);
    setWhError('');
    try {
      const res = await fetch(apiUrl('/pancake-webhook/events?limit=50'));
      const data = (await res.json().catch(() => ({}))) as {
        events?: PancakeWebhookEventRow[];
        source?: string;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Không tải sự kiện');
      }
      setWhEvents(Array.isArray(data.events) ? data.events : []);
      setWhEventsSource(data.source || '');
    } catch (err) {
      console.error(err);
      setWhEvents([]);
      setWhError(
        err instanceof Error ? err.message : 'Không tải được sự kiện webhook.'
      );
    } finally {
      setWhEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeToolId !== 'pancake-webhook') return;
    void loadWebhookPanel();
    void loadWebhookEvents();
  }, [activeToolId, loadWebhookPanel, loadWebhookEvents]);

  useEffect(() => {
    if (!whConfig?.fullReceiverUrl || whRegisterUrl.trim()) return;
    setWhRegisterUrl(whConfig.fullReceiverUrl);
  }, [whConfig?.fullReceiverUrl, whRegisterUrl]);

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

  const activeTool = TOOLS.find((t) => t.id === activeToolId) ?? TOOLS[0];

  const toggleWhType = (t: string) => {
    setWhTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const loadPancakeWarehouses = async () => {
    setWhWarehousesLoading(true);
    setWhWarehousesError('');
    try {
      const res = await fetch(apiUrl('/pancake-webhook/warehouses'));
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: unknown;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Không tải được danh sách kho');
      }
      setWhWarehousesData(data.data ?? null);
    } catch (err) {
      console.error(err);
      setWhWarehousesData(null);
      setWhWarehousesError(
        err instanceof Error ? err.message : 'Không tải được danh sách kho.'
      );
    } finally {
      setWhWarehousesLoading(false);
    }
  };

  const registerPancakeWebhook = async () => {
    const url = whRegisterUrl.trim();
    if (!url) {
      setWhError('Cần URL webhook (HTTPS, trỏ tới POST /webhooks/pancake trên server này).');
      return;
    }
    if (!whTypes.length) {
      setWhError('Chọn ít nhất một loại dữ liệu (orders, customers, …).');
      return;
    }
    setWhRegisterBusy(true);
    setWhError('');
    setWhMessage('');
    try {
      const res = await fetch(apiUrl('/pancake-webhook/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_url: url,
          webhook_enable: true,
          webhook_types: whTypes,
          webhook_email: whRegisterEmail.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Đăng ký webhook thất bại');
      }
      setWhMessage(
        'Đã gửi cấu hình lên Pancake (PUT /shops/{shop}). Kiểm tra POS → Cấu hình → Webhook/API.'
      );
      setTimeout(() => setWhMessage(''), 6000);
    } catch (err) {
      console.error(err);
      setWhError(
        err instanceof Error ? err.message : 'Đăng ký webhook thất bại.'
      );
    } finally {
      setWhRegisterBusy(false);
    }
  };

  const clearWebhookEvents = async () => {
    if (
      !window.confirm('Xóa toàn bộ sự kiện webhook đã lưu trên server?')
    ) {
      return;
    }
    setWhError('');
    try {
      const res = await fetch(apiUrl('/pancake-webhook/events'), {
        method: 'DELETE',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Không xóa được');
      }
      await loadWebhookEvents();
      setWhMessage('Đã xóa danh sách sự kiện.');
      setTimeout(() => setWhMessage(''), 3200);
    } catch (err) {
      console.error(err);
      setWhError(
        err instanceof Error ? err.message : 'Không xóa được sự kiện.'
      );
    }
  };

  return (
    <div className="page">
      <header className="app-brand" role="banner">
        <div className="app-brand-inner">
          <h1 className="app-brand-title">MeiT Tools</h1>
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
                hóa đơn <strong>Chưa phát hành</strong> khớp dữ liệu khách hàng
                (API / DB).
              </p>
              <button
                type="button"
                className="btn"
                onClick={() => void runAutomation()}
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

        {activeToolId === 'pancake-webhook' && (
          <>
            <p className="tool-intro muted">
              {activeTool.description}{' '}
              <a
                href="https://api-docs.pancake.vn/#tag/webhook/put/shopsshop_id"
                target="_blank"
                rel="noreferrer"
              >
                Tài liệu Webhook (PUT /shops/&#123;SHOP_ID&#125;)
              </a>
              . Pancake sẽ <strong>POST JSON</strong> tới URL bạn đăng ký; server
              lưu và hiển thị các bản ghi gần đây (MongoDB nếu có{' '}
              <code>MONGODB_URI</code>, không thì bộ nhớ tạm).
            </p>

            <section className="card" aria-labelledby="wh-receiver-title">
              <h2 id="wh-receiver-title" className="section-title">
                URL nhận webhook
              </h2>
              {whPanelLoading && (
                <p className="muted">Đang tải cấu hình…</p>
              )}
              {whConfigError && (
                <p className="hint hint-error">{whConfigError}</p>
              )}
              {!whPanelLoading && whConfig && (
                <>
                  <p className="muted small">
                    Shop ID (server): <code>{whConfig.shopId}</code>
                    {whConfig.hasApiKey
                      ? ' · API key: đã cấu hình'
                      : ' · API key: chưa có — cần PANCAKE_API_KEY để đăng ký từ UI'}
                    {whConfig.incomingSecretConfigured
                      ? ` · Bảo vệ POST: header ${whConfig.incomingSecretHeader}`
                      : ''}
                  </p>
                  {whConfig.fullReceiverUrl ? (
                    <p className="muted small">
                      Dán URL này vào Pancake (hoặc dùng form bên dưới):{' '}
                      <code>{whConfig.fullReceiverUrl}</code>
                    </p>
                  ) : (
                    <p className="hint">
                      Đặt <code>PANCAKE_PUBLIC_WEBHOOK_BASE</code> trên server
                      (origin công khai, ví dụ Railway) để hiển thị đủ URL nhận{' '}
                      <code>{whConfig.receiverPath}</code>.
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="card" aria-labelledby="wh-register-title">
              <h2 id="wh-register-title" className="section-title">
                Đăng ký webhook qua Open API
              </h2>
              <p className="muted small">
                Gọi <code>PUT …/api/v1/shops/&#123;shop&#125;?api_key=…</code> như
                tài liệu Pancake. Cần{' '}
                <code>PANCAKE_API_KEY</code> và{' '}
                <code>PANCAKE_SHOP_ID</code> trong .env của server.
              </p>
              <div className="webhook-register-field">
                <span>Webhook URL (HTTPS)</span>
                <input
                  type="url"
                  className="search-input webhook-url-input"
                  placeholder="https://api.example.com/webhooks/pancake"
                  value={whRegisterUrl}
                  onChange={(e) => setWhRegisterUrl(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="webhook-register-field">
                <span>Email báo lỗi (tuỳ chọn)</span>
                <input
                  type="email"
                  className="search-input webhook-url-input"
                  placeholder="ops@example.com"
                  value={whRegisterEmail}
                  onChange={(e) => setWhRegisterEmail(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <p className="muted small webhook-types-label">
                Loại dữ liệu gửi tới URL:
              </p>
              <div className="webhook-type-grid">
                {(whConfig?.webhookTypes ?? [
                  'orders',
                  'customers',
                  'products',
                  'variations_warehouses',
                ]).map((t) => (
                  <label key={t}>
                    <input
                      type="checkbox"
                      checked={whTypes.includes(t)}
                      onChange={() => toggleWhType(t)}
                    />
                    {t}
                  </label>
                ))}
              </div>
              <div className="webhook-register-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => void registerPancakeWebhook()}
                  disabled={whRegisterBusy || !whConfig?.hasApiKey}
                >
                  {whRegisterBusy ? 'Đang gửi…' : 'Gửi cấu hình lên Pancake'}
                </button>
                {!whConfig?.hasApiKey && (
                  <span className="muted small">
                    Thêm PANCAKE_API_KEY để bật nút này.
                  </span>
                )}
              </div>
              {whMessage && <p className="hint hint-ok">{whMessage}</p>}
              {whError && <p className="hint hint-error">{whError}</p>}
            </section>

            <section className="card" aria-labelledby="wh-warehouses-title">
              <div className="table-head">
                <h2 id="wh-warehouses-title" className="section-title">
                  Danh sách kho hàng
                </h2>
                <div className="table-head-actions">
                  <a
                    className="btn-secondary"
                    href="https://api-docs.pancake.vn/#tag/kho-h%C3%A0ng/GET/shops/{SHOP_ID}/warehouses"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Tài liệu API
                  </a>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void loadPancakeWarehouses()}
                    disabled={whWarehousesLoading || !whConfig?.hasApiKey}
                  >
                    {whWarehousesLoading ? 'Đang tải…' : 'Tải từ Pancake'}
                  </button>
                </div>
              </div>
              <p className="muted small">
                Gọi{' '}
                <code>
                  GET …/shops/&#123;shop&#125;/warehouses?api_key=…
                </code>{' '}
                (Open API — kho hàng).
              </p>
              {!whConfig?.hasApiKey && (
                <p className="muted small">
                  Thêm <code>PANCAKE_API_KEY</code> trên server để bật nút tải.
                </p>
              )}
              {whWarehousesError && (
                <p className="hint hint-error">{whWarehousesError}</p>
              )}
              {whWarehousesData !== null &&
                !whWarehousesError &&
                whWarehouseRows.length > 0 && (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          {whWarehouseCols.map((col) => (
                            <th key={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {whWarehouseRows.map((row, i) => (
                          <tr
                            key={String(
                              row.id ??
                                row.warehouse_id ??
                                `wh-row-${i}`
                            )}
                          >
                            {whWarehouseCols.map((col) => (
                              <td key={col}>
                                {warehouseCellText(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              {whWarehousesData !== null &&
                !whWarehousesError &&
                whWarehouseRows.length === 0 && (
                  <pre className="webhook-payload">
                    {JSON.stringify(whWarehousesData, null, 2)}
                  </pre>
                )}
            </section>

            <section className="card" aria-labelledby="wh-events-title">
              <div className="table-head">
                <h2 id="wh-events-title" className="section-title">
                  Sự kiện đã nhận
                </h2>
                <div className="table-head-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void loadWebhookEvents()}
                    disabled={whEventsLoading}
                  >
                    {whEventsLoading ? 'Đang tải…' : 'Làm mới'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => void clearWebhookEvents()}
                  >
                    Xóa danh sách
                  </button>
                </div>
              </div>
              <p className="muted small">
                Nguồn lưu:{' '}
                <strong>{whEventsSource || '—'}</strong>
                {whEventsSource === 'memory'
                  ? ' (mất khi restart server trừ khi dùng MongoDB).'
                  : null}
              </p>
              {!whEventsLoading && whEvents.length === 0 && (
                <p className="muted">
                  Chưa có POST nào. Sau khi bật webhook trên Pancake, thử tạo
                  đơn hoặc khách — dữ liệu sẽ xuất hiện ở đây.
                </p>
              )}
              {whEvents.length > 0 && (
                <div className="webhook-events-list">
                  {whEvents.map((ev) => (
                    <details key={ev.id} className="webhook-event-card">
                      <summary>
                        {ev.receivedAt}
                        {ev.contentType ? ` · ${ev.contentType}` : ''}
                      </summary>
                      <pre className="webhook-payload">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {activeToolId === 'opensource-hrm' && (
          <>
            <p className="tool-intro muted">
              {activeTool.description} Mở Horilla sau khi container chạy; lần
              đầu cần khởi tạo DB trong container (compose đã chạy migrate).
            </p>
            <MeitIntegrationsPanel focus="hrm" />
          </>
        )}

        {activeToolId === 'opensource-crm' && (
          <>
            <p className="tool-intro muted">
              {activeTool.description} Đăng nhập admin mặc định theo biến môi
              trường compose (đổi ngay trong{' '}
              <code>compose.integrations.env</code> khi deploy thật).
            </p>
            <MeitIntegrationsPanel focus="crm" />
          </>
        )}
      </div>
    </div>
  );
}
