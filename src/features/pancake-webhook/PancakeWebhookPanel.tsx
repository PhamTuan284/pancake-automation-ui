import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PancakeWebhookConfig,
  PancakeWebhookEventRow,
  PancakeWebhookShopConfig,
  VariantSalesAnalytics,
  VariantSalesRow,
  EmployeeProductivityRow,
  EmployeeProductivityResult,
} from '../../types';
import { apiUrl } from '../../lib/api';
import {
  UiButton,
  UiDataTable,
  type UiDataTableColumn,
} from '../../components/ui';
import { ProductStockZaloSection } from './ProductStockZaloSection';

const DEFAULT_WEBHOOK_TYPES = [
  'orders',
  'products',
  'variations_warehouses',
];
const WEBHOOK_KIND_ORDER = [
  'orders',
  'products',
  'variations_warehouses',
  'crm',
  'unknown',
];

function webhookKindLabel(kind: string): string {
  if (kind === 'orders') return 'Đơn hàng';
  if (kind === 'products') return 'Sản phẩm';
  if (kind === 'variations_warehouses') return 'Tồn kho';
  if (kind === 'crm') return 'CRM';
  return `Khác (${kind})`;
}

type AnalyticsSortKey =
  | 'hotRank'
  | 'productCode'
  | 'variantCode'
  | 'soldInWindow'
  | 'avgSoldPerDay'
  | 'currentStock'
  | 'daysUntilSellOut';

function normalizeAnalyticsSearch(value: string): string {
  return value.trim().toLowerCase();
}

function variantRowMatchesSearch(row: VariantSalesRow, queryNorm: string): boolean {
  if (!queryNorm) return true;
  const haystack = [row.productCode, row.variantCode]
    .join(' ')
    .toLowerCase();
  return haystack.includes(queryNorm);
}

function compareAnalyticsRows(
  a: VariantSalesRow,
  b: VariantSalesRow,
  key: AnalyticsSortKey,
  dir: 'asc' | 'desc'
): number {
  const sign = dir === 'asc' ? 1 : -1;
  if (key === 'productCode' || key === 'variantCode') {
    const av = (a[key] || '').toLowerCase();
    const bv = (b[key] || '').toLowerCase();
    return av.localeCompare(bv, 'vi') * sign;
  }
  const numKey = key as
    | 'hotRank'
    | 'soldInWindow'
    | 'avgSoldPerDay'
    | 'currentStock'
    | 'daysUntilSellOut';
  const nullLast = dir === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  const av = a[numKey];
  const bv = b[numKey];
  const an =
    av == null || !Number.isFinite(Number(av)) ? nullLast : Number(av);
  const bn =
    bv == null || !Number.isFinite(Number(bv)) ? nullLast : Number(bv);
  if (an !== bn) return (an - bn) * sign;
  return (
    (a.variantCode || '').localeCompare(b.variantCode || '', 'vi') * sign
  );
}

export function PancakeWebhookPanel({
  toolDescription,
}: {
  toolDescription: string;
}) {
  const [whConfig, setWhConfig] = useState<PancakeWebhookConfig | null>(null);
  const [whSelectedShop, setWhSelectedShop] =
    useState<PancakeWebhookShopConfig['shopKey']>('meit');
  const [whConfigError, setWhConfigError] = useState('');
  const [whEvents, setWhEvents] = useState<PancakeWebhookEventRow[]>([]);
  const [whEventsSource, setWhEventsSource] = useState('');
  const [whPanelLoading, setWhPanelLoading] = useState(false);
  const [whEventsLoading, setWhEventsLoading] = useState(false);
  const [whMessage, setWhMessage] = useState('');
  const [whError, setWhError] = useState('');
  const [whRegisterUrl, setWhRegisterUrl] = useState('');
  const [whRegisterEmail, setWhRegisterEmail] = useState('oomrneoo@gmail.com');
  const [whTypes, setWhTypes] = useState<string[]>(DEFAULT_WEBHOOK_TYPES);
  const [whRegisterBusy, setWhRegisterBusy] = useState(false);
  const [whPingBusy, setWhPingBusy] = useState(false);
  const [whAnalyticsDays, setWhAnalyticsDays] = useState(7);
  const [whAnalyticsLoading, setWhAnalyticsLoading] = useState(false);
  const [whAnalyticsError, setWhAnalyticsError] = useState('');
  const [whAnalytics, setWhAnalytics] = useState<VariantSalesAnalytics | null>(
    null
  );
  const [whAnalyticsSearch, setWhAnalyticsSearch] = useState('');
  const [whAnalyticsSortKey, setWhAnalyticsSortKey] =
    useState<AnalyticsSortKey>('hotRank');
  const [whAnalyticsSortDir, setWhAnalyticsSortDir] = useState<'asc' | 'desc'>(
    'asc'
  );

  type EmpProdSortKey = keyof EmployeeProductivityRow;
  const [empProdDays, setEmpProdDays] = useState(30);
  const [empProdRole, setEmpProdRole] = useState<'seller' | 'care' | 'creator'>('seller');
  const [empProdLoading, setEmpProdLoading] = useState(false);
  const [empProdError, setEmpProdError] = useState('');
  const [empProdResult, setEmpProdResult] = useState<EmployeeProductivityResult | null>(null);
  const [empProdSortKey, setEmpProdSortKey] = useState<EmpProdSortKey>('rank');
  const [empProdSortDir, setEmpProdSortDir] = useState<'asc' | 'desc'>('asc');

  const whActiveShop = useMemo(() => {
    const shops = whConfig?.shops ?? [];
    return (
      shops.find((s) => s.shopKey === whSelectedShop) ??
      shops[0] ??
      null
    );
  }, [whConfig?.shops, whSelectedShop]);

  const formatQty = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('vi-VN');

  const loadVariantSalesAnalytics = useCallback(async () => {
    setWhAnalyticsLoading(true);
    setWhAnalyticsError('');
    try {
      const res = await fetch(
        apiUrl(
          `/pancake-webhook/analytics/variant-sales?days=${whAnalyticsDays}&eventLimit=1000&shop=${whSelectedShop}`
        )
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        analytics?: VariantSalesAnalytics;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Không tải phân tích bán hàng');
      }
      setWhAnalytics(data.analytics ?? null);
      setWhAnalyticsSearch('');
      setWhAnalyticsSortKey('hotRank');
      setWhAnalyticsSortDir('asc');
    } catch (err) {
      console.error(err);
      setWhAnalytics(null);
      setWhAnalyticsError(
        err instanceof Error
          ? err.message
          : 'Không tải được phân tích biến thể.'
      );
    } finally {
      setWhAnalyticsLoading(false);
    }
  }, [whAnalyticsDays, whSelectedShop]);

  const whAnalyticsSearchNorm = useMemo(
    () => normalizeAnalyticsSearch(whAnalyticsSearch),
    [whAnalyticsSearch]
  );

  const whAnalyticsDisplayRows = useMemo(() => {
    const rows = whAnalytics?.variants ?? [];
    const filtered = rows.filter((row) =>
      variantRowMatchesSearch(row, whAnalyticsSearchNorm)
    );
    return [...filtered].sort((a, b) =>
      compareAnalyticsRows(a, b, whAnalyticsSortKey, whAnalyticsSortDir)
    );
  }, [
    whAnalytics,
    whAnalyticsSearchNorm,
    whAnalyticsSortKey,
    whAnalyticsSortDir,
  ]);

  const whAnalyticsColumns: UiDataTableColumn<VariantSalesRow>[] = useMemo(
    () => [
      {
        key: 'hotRank',
        header: 'Hot',
        sortable: true,
        render: (row) => String(row.hotRank),
      },
      {
        key: 'productCode',
        header: 'Mã SP',
        sortable: true,
        render: (row) => row.productCode || '—',
      },
      {
        key: 'variantCode',
        header: 'Mã biến thể',
        sortable: true,
        render: (row) => row.variantCode || '—',
      },
      {
        key: 'soldInWindow',
        header: 'Đã bán (kỳ)',
        sortable: true,
        render: (row) => formatQty(row.soldInWindow),
      },
      {
        key: 'avgSoldPerDay',
        header: 'TB / ngày',
        sortable: true,
        render: (row) => formatQty(row.avgSoldPerDay),
      },
      {
        key: 'currentStock',
        header: 'Tồn',
        sortable: true,
        render: (row) => formatQty(row.currentStock),
      },
      {
        key: 'daysUntilSellOut',
        header: 'Ước hết (~ngày)',
        sortable: true,
        render: (row) => formatQty(row.daysUntilSellOut),
      },
    ],
    []
  );

  const handleAnalyticsSortChange = useCallback(
    (next: { key: string; dir: 'asc' | 'desc' }) => {
      setWhAnalyticsSortKey(next.key as AnalyticsSortKey);
      setWhAnalyticsSortDir(next.dir);
    },
    []
  );

  const loadEmployeeProductivity = useCallback(async () => {
    setEmpProdLoading(true);
    setEmpProdError('');
    try {
      const res = await fetch(
        apiUrl(
          `/pancake-webhook/analytics/employee-productivity?days=${empProdDays}&role=${empProdRole}&shop=${whSelectedShop}`
        )
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: EmployeeProductivityResult;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Không tải được năng suất nhân viên');
      }
      setEmpProdResult(data.result ?? null);
      setEmpProdSortKey('rank');
      setEmpProdSortDir('asc');
    } catch (err) {
      console.error(err);
      setEmpProdResult(null);
      setEmpProdError(
        err instanceof Error ? err.message : 'Không tải được dữ liệu.'
      );
    } finally {
      setEmpProdLoading(false);
    }
  }, [empProdDays, empProdRole, whSelectedShop]);

  const empProdDisplayRows = useMemo(() => {
    const rows = empProdResult?.rows ?? [];
    const sign = empProdSortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[empProdSortKey];
      const bv = b[empProdSortKey];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv, 'vi') * sign;
      }
      return ((Number(av) - Number(bv)) || 0) * sign;
    });
  }, [empProdResult, empProdSortKey, empProdSortDir]);

  const empProdColumns = useMemo(
    (): UiDataTableColumn<EmployeeProductivityRow>[] => [
      {
        key: 'rank',
        header: '#',
        sortable: true,
        render: (row) => String(row.rank),
      },
      {
        key: 'employeeName',
        header: 'Nhân viên',
        sortable: true,
        render: (row) => row.employeeName || row.employeeId,
      },
      {
        key: 'orderCount',
        header: 'Số đơn',
        sortable: true,
        render: (row) => row.orderCount.toLocaleString('vi-VN'),
      },
      {
        key: 'totalRevenue',
        header: 'Doanh thu',
        sortable: true,
        render: (row) => row.totalRevenue.toLocaleString('vi-VN') + ' ₫',
      },
      {
        key: 'avgOrderValue',
        header: 'TB/đơn',
        sortable: true,
        render: (row) =>
          row.avgOrderValue > 0
            ? row.avgOrderValue.toLocaleString('vi-VN') + ' ₫'
            : '—',
      },
      {
        key: 'cancelledCount',
        header: 'Đơn huỷ',
        sortable: true,
        render: (row) =>
          row.cancelledCount > 0
            ? row.cancelledCount.toLocaleString('vi-VN')
            : '—',
      },
    ],
    []
  );

  const handleEmpProdSortChange = useCallback(
    (next: { key: string; dir: 'asc' | 'desc' }) => {
      setEmpProdSortKey(next.key as EmpProdSortKey);
      setEmpProdSortDir(next.dir);
    },
    []
  );

  const whEventsGrouped = useMemo(() => {
    const map = new Map<string, PancakeWebhookEventRow[]>();
    for (const ev of whEvents) {
      const kind = (ev.kind || 'unknown').trim() || 'unknown';
      const arr = map.get(kind) ?? [];
      arr.push(ev);
      map.set(kind, arr);
    }
    const known = WEBHOOK_KIND_ORDER.filter((k) => map.has(k)).map((k) => ({
      kind: k,
      label: webhookKindLabel(k),
      events: map.get(k) ?? [],
    }));
    const others = [...map.entries()]
      .filter(([k]) => !WEBHOOK_KIND_ORDER.includes(k))
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([kind, events]) => ({
        kind,
        label: webhookKindLabel(kind),
        events,
      }));
    return [...known, ...others];
  }, [whEvents]);

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
    void loadWebhookPanel();
    void loadWebhookEvents();
  }, [loadWebhookPanel, loadWebhookEvents]);

  useEffect(() => {
    if (!whConfig?.fullReceiverUrl || whRegisterUrl.trim()) return;
    setWhRegisterUrl(whConfig.fullReceiverUrl);
  }, [whConfig?.fullReceiverUrl, whRegisterUrl]);

  const toggleWhType = (t: string) => {
    setWhTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const registerPancakeWebhook = async () => {
    const url = whRegisterUrl.trim();
    if (!url) {
      setWhError('Cần URL webhook (HTTPS, trỏ tới POST /webhooks/pancake trên server này).');
      return;
    }
    if (!whTypes.length) {
      setWhError('Chọn ít nhất một loại dữ liệu (orders, products, …).');
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
          shopKey: whSelectedShop,
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

  const pingWebhookIngress = async () => {
    setWhPingBusy(true);
    setWhError('');
    try {
      const res = await fetch(apiUrl('/pancake-webhook/ping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: {
            webhook_type: 'orders',
            id: `ui-ping-${Date.now()}`,
            customer_id: 'ui-ping-customer',
            bill_full_name: 'UI Ping',
            order_sources: ['ui_manual_ping'],
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Ping webhook thất bại');
      }
      await loadWebhookEvents();
      setWhMessage('Đã gửi ping webhook và ghi nhận sự kiện test.');
      setTimeout(() => setWhMessage(''), 3200);
    } catch (err) {
      console.error(err);
      setWhError(err instanceof Error ? err.message : 'Ping webhook thất bại.');
    } finally {
      setWhPingBusy(false);
    }
  };

  return (
    <>
      <p className="tool-intro muted">
        {toolDescription}{' '}
        <a
          href="https://api-docs.pancake.vn/#tag/webhook/put/shopsshop_id"
          target="_blank"
          rel="noreferrer"
        >
          Tài liệu Webhook (PUT /shops/&#123;SHOP_ID&#125;)
        </a>
        . Pancake sẽ <strong>POST JSON</strong> tới URL bạn đăng ký; server lưu
        và hiển thị các bản ghi gần đây (MongoDB nếu có{' '}
        <code>MONGODB_URI</code>, không thì bộ nhớ tạm).
      </p>

      <section className="card" aria-labelledby="wh-receiver-title">
        <h2 id="wh-receiver-title" className="section-title">
          URL nhận webhook
        </h2>
        {whPanelLoading && <p className="muted">Đang tải cấu hình…</p>}
        {whConfigError && (
          <p className="hint hint-error">{whConfigError}</p>
        )}
        {!whPanelLoading && whConfig && (
          <>
            <p className="muted small">
              {whConfig.shops?.map((s) => (
                <span key={s.shopKey}>
                  {s.label}: shop <code>{s.shopId}</code>
                  {s.hasApiKey ? ' · API key ✓' : ' · API key ✗'}
                  {' · '}
                </span>
              ))}
              {whConfig.incomingSecretConfigured
                ? `Bảo vệ POST: header ${whConfig.incomingSecretHeader}`
                : ''}
            </p>
            {whConfig.fullReceiverUrl ? (
              <p className="muted small">
                Dán URL này vào Pancake (hoặc dùng form bên dưới):{' '}
                <code>{whConfig.fullReceiverUrl}</code>
              </p>
            ) : (
              <p className="hint">
                Đặt <code>PANCAKE_PUBLIC_WEBHOOK_BASE</code> trên server (origin
                công khai, ví dụ Railway) để hiển thị đủ URL nhận{' '}
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
          Gọi <code>PUT …/api/v1/shops/&#123;shop&#125;?api_key=…</code> như tài
          liệu Pancake. Mỗi shop dùng API key riêng:{' '}
          <code>PANCAKE_MEIT_API_KEY</code>, <code>PANCAKE_DPA_API_KEY</code>{' '}
          (MeiT có thể dùng <code>PANCAKE_API_KEY</code> cũ).
        </p>
        <div className="webhook-register-field">
          <span>Cửa hàng</span>
          <select
            className="search-input"
            value={whSelectedShop}
            onChange={(e) =>
              setWhSelectedShop(
                e.target.value as PancakeWebhookShopConfig['shopKey']
              )
            }
          >
            {(whConfig?.shops ?? []).map((s) => (
              <option key={s.shopKey} value={s.shopKey}>
                {s.label} ({s.shopId})
                {s.hasApiKey ? '' : ' — chưa có API key'}
              </option>
            ))}
          </select>
        </div>
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
          {(whConfig?.webhookTypes ?? DEFAULT_WEBHOOK_TYPES).map((t) => (
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
          <UiButton
            onClick={() => void registerPancakeWebhook()}
            disabled={whRegisterBusy || !whActiveShop?.hasApiKey}
          >
            {whRegisterBusy ? 'Đang gửi…' : 'Gửi cấu hình lên Pancake'}
          </UiButton>
          {!whActiveShop?.hasApiKey && (
            <span className="muted small">
              Thêm API key cho shop đã chọn (
              {whSelectedShop === 'dpa'
                ? 'PANCAKE_DPA_API_KEY'
                : 'PANCAKE_MEIT_API_KEY hoặc PANCAKE_API_KEY'}
              ).
            </span>
          )}
        </div>
        {whMessage && <p className="hint hint-ok">{whMessage}</p>}
        {whError && <p className="hint hint-error">{whError}</p>}
      </section>

      <ProductStockZaloSection
        shopKey={whSelectedShop}
        shops={whConfig?.shops}
        onShopChange={(k) => setWhSelectedShop(k as PancakeWebhookShopConfig['shopKey'])}
      />

      <section className="card" aria-labelledby="wh-analytics-title">
        <div className="table-head">
          <h2 id="wh-analytics-title" className="section-title">
            Biến thể bán chạy &amp; dự báo hết hàng
          </h2>
          <div className="table-head-actions">
            <label className="muted small">
              Shop{' '}
              <select
                value={whSelectedShop}
                onChange={(e) =>
                  setWhSelectedShop(
                    e.target.value as PancakeWebhookShopConfig['shopKey']
                  )
                }
              >
                {(whConfig?.shops ?? []).map((s) => (
                  <option key={s.shopKey} value={s.shopKey}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="muted small">
              Số ngày{' '}
              <select
                value={whAnalyticsDays}
                onChange={(e) => setWhAnalyticsDays(Number(e.target.value))}
              >
                <option value={7}>7</option>
                <option value={14}>14</option>
                <option value={30}>30</option>
              </select>
            </label>
            <UiButton
              onClick={() => void loadVariantSalesAnalytics()}
              disabled={whAnalyticsLoading || !whActiveShop?.hasApiKey}
            >
              {whAnalyticsLoading ? 'Đang phân tích…' : 'Phân tích từ webhook'}
            </UiButton>
          </div>
        </div>
        <p className="muted small">
          Dựa trên webhook <code>orders</code> (mã trong{' '}
          <code>items[].variation_info</code>) và tồn từ Open API. Mã SP ={' '}
          <code>product_display_id</code>, mã biến thể = <code>display_id</code>.
        </p>
        {whAnalyticsError && (
          <p className="hint hint-error">{whAnalyticsError}</p>
        )}
        {whAnalytics && (
          <>
            <p className="muted small">
              Kỳ {whAnalytics.windowDays} ngày · đơn webhook:{' '}
              <strong>{whAnalytics.orderEventsUsed}</strong> · tồn webhook:{' '}
              <strong>{whAnalytics.stockEventsUsed}</strong>
              {whAnalytics.variants.length > 0 && (
                <>
                  {' '}
                  · <strong>{whAnalyticsDisplayRows.length}</strong> /{' '}
                  {whAnalytics.variants.length} dòng hiển thị
                </>
              )}
            </p>
            {whAnalytics.variants.length > 0 && (
              <div className="search-row webhook-analytics-filters">
                <label
                  className="search-label"
                  htmlFor="wh-analytics-search"
                >
                  Lọc mã
                </label>
                <div className="search-input-wrap">
                  <input
                    id="wh-analytics-search"
                    type="search"
                    className="search-input"
                    placeholder="Mã SP hoặc mã biến thể, ví dụ T2071, 8917XANHCOM…"
                    value={whAnalyticsSearch}
                    onChange={(e) => setWhAnalyticsSearch(e.target.value)}
                    autoComplete="off"
                  />
                  {whAnalyticsSearch.trim() !== '' && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={() => setWhAnalyticsSearch('')}
                      aria-label="Xóa bộ lọc"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
            {whAnalytics.variants.length === 0 ? (
              <p className="muted">
                Chưa có dòng bán nào trong kỳ. Kiểm tra webhook{' '}
                <code>orders</code> và payload có <code>items</code> với{' '}
                <code>variation_info.product_display_id</code> /{' '}
                <code>variation_info.display_id</code>.
              </p>
            ) : whAnalyticsDisplayRows.length === 0 ? (
              <p className="muted">
                Không có dòng nào khớp “{whAnalyticsSearch.trim()}”.{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setWhAnalyticsSearch('')}
                >
                  Xóa bộ lọc
                </button>
              </p>
            ) : (
              <UiDataTable
                rows={whAnalyticsDisplayRows}
                columns={whAnalyticsColumns}
                sort={{
                  key: whAnalyticsSortKey,
                  dir: whAnalyticsSortDir,
                }}
                onSortChange={handleAnalyticsSortChange}
                rowKey={(row) =>
                  row.variantCode || row.productCode || `row-${row.hotRank}`
                }
                wrapClassName="webhook-openapi-wrap"
                tableClassName="data-table--openapi"
              />
            )}
            <p className="muted small">{whAnalytics.note}</p>
          </>
        )}
      </section>

      <section className="card" aria-labelledby="wh-emp-prod-title">
        <div className="table-head">
          <h2 id="wh-emp-prod-title" className="section-title">
            Năng suất nhân viên
          </h2>
          <div className="table-head-actions">
            <label className="muted small">
              Shop{' '}
              <select
                value={whSelectedShop}
                onChange={(e) =>
                  setWhSelectedShop(
                    e.target.value as PancakeWebhookShopConfig['shopKey']
                  )
                }
              >
                {(whConfig?.shops ?? []).map((s) => (
                  <option key={s.shopKey} value={s.shopKey}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="muted small">
              Số ngày{' '}
              <select
                value={empProdDays}
                onChange={(e) => setEmpProdDays(Number(e.target.value))}
              >
                <option value={7}>7</option>
                <option value={14}>14</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </label>
            <label className="muted small">
              Vai trò{' '}
              <select
                value={empProdRole}
                onChange={(e) =>
                  setEmpProdRole(e.target.value as 'seller' | 'care' | 'creator')
                }
              >
                <option value="seller">Người bán</option>
                <option value="care">Chăm sóc</option>
                <option value="creator">Người tạo đơn</option>
              </select>
            </label>
            <UiButton
              onClick={() => void loadEmployeeProductivity()}
              disabled={empProdLoading || !whActiveShop?.hasApiKey}
            >
              {empProdLoading ? 'Đang tải…' : 'Tải từ Pancake'}
            </UiButton>
          </div>
        </div>
        <p className="muted small">
          Tổng hợp đơn hàng từ Pancake Open API trong kỳ, nhóm theo nhân viên
          (người bán / chăm sóc / tạo đơn). Doanh thu tính trên đơn không huỷ
          và không trả hàng.
        </p>
        {empProdError && (
          <p className="hint hint-error">{empProdError}</p>
        )}
        {empProdResult && (
          <>
            <p className="muted small">
              Kỳ {empProdResult.windowDays} ngày · tổng{' '}
              <strong>{empProdResult.totalOrders}</strong> đơn ·{' '}
              <strong>{empProdResult.rows.length}</strong> nhân viên
            </p>
            {empProdResult.rows.length === 0 ? (
              <p className="muted">
                Không có dữ liệu. Kiểm tra lại vai trò hoặc khoảng thời gian.
              </p>
            ) : (
              <UiDataTable
                rows={empProdDisplayRows}
                columns={empProdColumns}
                sort={{ key: empProdSortKey, dir: empProdSortDir }}
                onSortChange={handleEmpProdSortChange}
                rowKey={(row) => row.employeeId || String(row.rank)}
                wrapClassName="webhook-openapi-wrap"
                tableClassName="data-table--openapi"
              />
            )}
          </>
        )}
      </section>

      <section className="card" aria-labelledby="wh-events-title">
        <div className="table-head">
          <h2 id="wh-events-title" className="section-title">
            Sự kiện đã nhận
          </h2>
          <div className="table-head-actions">
            <UiButton
              variant="secondary"
              onClick={() => void loadWebhookEvents()}
              disabled={whEventsLoading}
            >
              {whEventsLoading ? 'Đang tải…' : 'Làm mới'}
            </UiButton>
            <UiButton
              variant="secondary"
              onClick={() => void clearWebhookEvents()}
            >
              Xóa danh sách
            </UiButton>
            <UiButton
              variant="secondary"
              onClick={() => void pingWebhookIngress()}
              disabled={whPingBusy}
            >
              {whPingBusy ? 'Đang ping…' : 'Ping webhook'}
            </UiButton>
          </div>
        </div>
        <p className="muted small">
          Nguồn lưu: <strong>{whEventsSource || '—'}</strong>
          {whEventsSource === 'memory'
            ? ' (mất khi restart server).'
            : null}
        </p>
        {!whEventsLoading && whEvents.length === 0 && (
          <p className="muted">
            Chưa có POST nào. Sau khi bật webhook trên Pancake, thử tạo đơn hoặc
            khách — dữ liệu sẽ xuất hiện ở đây.
          </p>
        )}
        {whEvents.length > 0 && (
          <div className="webhook-events-list">
            {whEventsGrouped.map((group) => (
              <div key={group.kind} className="webhook-kind-group">
                <p className="muted small webhook-kind-title">
                  {group.label}: <strong>{group.events.length}</strong> sự kiện
                </p>
                {group.events.map((ev) => (
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
            ))}
          </div>
        )}
      </section>
    </>
  );
}
