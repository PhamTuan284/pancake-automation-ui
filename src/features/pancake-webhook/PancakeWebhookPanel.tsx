import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PancakeWebhookConfig,
  PancakeWebhookEventRow,
  PancakeWebhookShopConfig,
  VariantSalesAnalytics,
  VariantSalesRow,
} from '../../types';
import { apiUrl } from '../../lib/api';
import { extractApiRows } from '../../lib/apiResponse';
import {
  UiButton,
  UiDataTable,
  type UiDataTableColumn,
} from '../../components/ui';

function nestedProduct(row: Record<string, unknown>): Record<string, unknown> | null {
  const p = row.product;
  return p && typeof p === 'object' && !Array.isArray(p)
    ? (p as Record<string, unknown>)
    : null;
}

function extractUrlFromImages(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const first = images[0];
  if (typeof first === 'string' && first.trim()) return first.trim();
  if (first && typeof first === 'object') {
    const img = first as Record<string, unknown>;
    const url = img.thumbnail_url ?? img.url ?? img.src;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return null;
}

function getProductImageUrl(row: Record<string, unknown>): string | null {
  const direct = extractUrlFromImages(row.images);
  if (direct) return direct;
  const prod = nestedProduct(row);
  if (prod) {
    const fromProd = extractUrlFromImages(prod.images);
    if (fromProd) return fromProd;
    for (const field of ['thumbnail_url', 'image_url', 'photo_url', 'image']) {
      const v = prod[field];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  for (const field of ['thumbnail_url', 'image_url', 'photo_url']) {
    const v = row[field];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function getProductName(row: Record<string, unknown>): string {
  const prod = nestedProduct(row);
  return (
    String(row.product_name ?? prod?.name ?? row.name ?? '').trim() || '—'
  );
}

function getVariantName(row: Record<string, unknown>): string {
  return String(row.name ?? row.variant_name ?? '').trim();
}

function getProductCode(row: Record<string, unknown>): string {
  const prod = nestedProduct(row);
  return String(
    row.product_display_id ?? prod?.display_id ?? row.product_sku ?? ''
  ).trim();
}

function getVariantLabel(row: Record<string, unknown>, productCode: string): string {
  const name = getVariantName(row);
  if (name) return name;
  const displayId = String(row.display_id ?? '').trim();
  if (productCode && displayId.toUpperCase().startsWith(productCode.toUpperCase())) {
    const suffix = displayId.slice(productCode.length);
    if (suffix) return suffix;
  }
  return displayId || '—';
}

function stockClass(stock: number | null): string {
  if (stock === null) return 'product-stock--unknown';
  if (stock === 0) return 'product-stock--empty';
  if (stock <= 5) return 'product-stock--low';
  return 'product-stock--ok';
}

function formatVndPrice(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return '—';
  return n.toLocaleString('vi-VN') + ' ₫';
}

function getProductPrice(row: Record<string, unknown>): string {
  if (row.price !== undefined && row.price !== null) return formatVndPrice(row.price);
  const prod = nestedProduct(row);
  if (prod?.price !== undefined && prod?.price !== null) return formatVndPrice(prod.price);
  return '—';
}

function getProductStock(row: Record<string, unknown>): number | null {
  for (const field of ['quantity', 'remain_quantity', 'stock_quantity']) {
    const v = row[field];
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

function productStatusInfo(row: Record<string, unknown>): { label: string; cls: string } {
  const s = String(row.status ?? '').toLowerCase().trim();
  if (s === 'active' || s === '1') return { label: 'Đang bán', cls: 'product-status--active' };
  if (s === 'inactive' || s === '0') return { label: 'Ngừng bán', cls: 'product-status--inactive' };
  if (!s || s === 'null') return { label: '', cls: '' };
  return { label: s, cls: 'product-status--unknown' };
}

const DEFAULT_WEBHOOK_TYPES = [
  'orders',
  'customers',
  'products',
  'variations_warehouses',
];
const WEBHOOK_KIND_ORDER = [
  'orders',
  'customers',
  'products',
  'variations_warehouses',
  'crm',
  'unknown',
];

function webhookKindLabel(kind: string): string {
  if (kind === 'orders') return 'Đơn hàng';
  if (kind === 'customers') return 'Khách hàng';
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

// ── Stock image generator ────────────────────────────────────────────────────

const SIZE_RE = /^(XS|S|M|L|XL|2XL|3XL|XXL|XXXL|\d{1,3})$/i;

function splitColorSize(label: string): { color: string; size: string } {
  const dashIdx = label.lastIndexOf(' - ');
  if (dashIdx !== -1) {
    const s = label.slice(dashIdx + 3).trim();
    if (SIZE_RE.test(s)) return { color: label.slice(0, dashIdx).trim(), size: s.toUpperCase() };
  }
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2 && SIZE_RE.test(parts[parts.length - 1])) {
    return { color: parts.slice(0, -1).join(' '), size: parts[parts.length - 1].toUpperCase() };
  }
  return { color: '', size: label };
}

async function generateStockImage(
  displayCode: string,
  imageUrl: string | null,
  variants: Array<{ label: string; stock: number | null }>
): Promise<string> {
  const W = 800, H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background: product image or gradient fallback
  let imgLoaded = false;
  if (imageUrl) {
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('cors'));
        setTimeout(() => rej(new Error('timeout')), 8000);
        i.src = imageUrl;
      });
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dx = (W - img.naturalWidth * scale) / 2;
      const dy = (H - img.naturalHeight * scale) / 2;
      ctx.drawImage(img, dx, dy, img.naturalWidth * scale, img.naturalHeight * scale);
      imgLoaded = true;
    } catch { /* CORS blocked — use gradient */ }
  }
  if (!imgLoaded) {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#fce4ec');
    grad.addColorStop(1, '#e8eaf6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Group variants by color
  const colorMap = new Map<string, { color: string; items: Array<{ size: string; stock: number | null }> }>();
  for (const v of variants) {
    const { color, size } = splitColorSize(v.label);
    const key = color || '__';
    if (!colorMap.has(key)) colorMap.set(key, { color, items: [] });
    colorMap.get(key)!.items.push({ size, stock: v.stock });
  }
  const groups = [...colorMap.values()];

  const RED = '#C8001A';
  const WHITE = '#FFFFFF';
  const PAD = 20, RADIUS = 18;
  const COLOR_FONT = 34, STOCK_FONT = 44, LINE_H = 54;
  const MARGIN = 28;

  function roundRect(x: number, y: number, w: number, h: number) {
    ctx.beginPath();
    ctx.moveTo(x + RADIUS, y);
    ctx.lineTo(x + w - RADIUS, y);
    ctx.arcTo(x + w, y, x + w, y + RADIUS, RADIUS);
    ctx.lineTo(x + w, y + h - RADIUS);
    ctx.arcTo(x + w, y + h, x + w - RADIUS, y + h, RADIUS);
    ctx.lineTo(x + RADIUS, y + h);
    ctx.arcTo(x, y + h, x, y + h - RADIUS, RADIUS);
    ctx.lineTo(x, y + RADIUS);
    ctx.arcTo(x, y, x + RADIUS, y, RADIUS);
    ctx.closePath();
  }

  // [anchorX, anchorY, alignRight, alignBottom]
  const corners: [number, number, boolean, boolean][] = [
    [MARGIN, 110, false, false],
    [W - MARGIN, 110, true, false],
    [MARGIN, H - MARGIN, false, true],
    [W - MARGIN, H - MARGIN, true, true],
  ];

  groups.slice(0, 4).forEach((group, i) => {
    const [ax, ay, alignRight, alignBottom] = corners[i];

    ctx.font = `bold ${STOCK_FONT}px sans-serif`;
    const maxStockW = Math.max(...group.items.map(it => ctx.measureText(`${it.stock ?? '?'}${it.size}`).width));
    ctx.font = `bold ${COLOR_FONT}px sans-serif`;
    const colorW = group.color ? ctx.measureText(group.color).width : 0;
    const boxW = Math.max(maxStockW, colorW) + PAD * 2;
    const boxH = PAD + (group.color ? COLOR_FONT + 10 : 0) + group.items.length * LINE_H + PAD;
    const boxX = alignRight ? ax - boxW : ax;
    const boxY = alignBottom ? ay - boxH : ay;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = RED;
    roundRect(boxX, boxY, boxW, boxH);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = WHITE;
    ctx.textAlign = alignRight ? 'right' : 'left';
    const textX = alignRight ? boxX + boxW - PAD : boxX + PAD;
    let textY = boxY + PAD;

    if (group.color) {
      ctx.font = `bold ${COLOR_FONT}px sans-serif`;
      textY += COLOR_FONT;
      ctx.fillText(group.color, textX, textY);
      textY += 10;
    }
    ctx.font = `bold ${STOCK_FONT}px sans-serif`;
    for (const it of group.items) {
      textY += LINE_H;
      ctx.fillText(`${it.stock ?? '?'}${it.size}`, textX, textY);
    }
  });

  // Product code label — top-left
  const CODE_FONT = 50;
  ctx.font = `bold ${CODE_FONT}px sans-serif`;
  const codeLabelW = ctx.measureText(displayCode).width + 32;
  const codeLabelH = CODE_FONT + 24;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = RED;
  roundRect(16, 16, codeLabelW, codeLabelH);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = WHITE;
  ctx.textAlign = 'left';
  ctx.font = `bold ${CODE_FONT}px sans-serif`;
  ctx.fillText(displayCode, 32, 16 + CODE_FONT + 6);

  // MeiT branding — top-right
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'right';
  ctx.font = 'italic bold 42px Georgia, "Times New Roman", serif';
  ctx.fillText('MeiT', W - 20, 66);
  ctx.restore();

  return canvas.toDataURL('image/png').replace('data:image/png;base64,', '');
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [whProductsLoading, setWhProductsLoading] = useState(false);
  const [whProductsError, setWhProductsError] = useState('');
  const [whProductsData, setWhProductsData] = useState<unknown>(null);
  const [whProductsSearch, setWhProductsSearch] = useState('');
  const [whPingBusy, setWhPingBusy] = useState(false);
  const [whZaloSending, setWhZaloSending] = useState<string | null>(null);
  const [whZaloResults, setWhZaloResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
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

  const whActiveShop = useMemo(() => {
    const shops = whConfig?.shops ?? [];
    return (
      shops.find((s) => s.shopKey === whSelectedShop) ??
      shops[0] ??
      null
    );
  }, [whConfig?.shops, whSelectedShop]);

  const whProductRows = useMemo(
    () => extractApiRows(whProductsData),
    [whProductsData]
  );
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

  const whProductsFiltered = useMemo(() => {
    const inStock = whProductRows.filter((row) => {
      const stock = getProductStock(row);
      return stock === null || stock > 0;
    });
    if (!whProductsSearch.trim()) return inStock;
    const q = whProductsSearch.trim().toLowerCase();
    return inStock.filter((row) => {
      const prod = nestedProduct(row);
      const haystack = [
        row.product_name, prod?.name, row.name, row.display_id, row.sku, row.product_sku, row.barcode,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [whProductRows, whProductsSearch]);

  const whProductsGrouped = useMemo(() => {
    const groups = new Map<string, { productCode: string; rows: typeof whProductsFiltered }>();
    for (const row of whProductsFiltered) {
      const productCode = getProductCode(row);
      const key = productCode || String(row.variation_id ?? row.id ?? row.display_id ?? Math.random());
      if (!groups.has(key)) groups.set(key, { productCode, rows: [] });
      groups.get(key)!.rows.push(row);
    }
    return [...groups.values()];
  }, [whProductsFiltered]);

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

  const loadPancakeProductsVariations = async () => {
    setWhProductsLoading(true);
    setWhProductsError('');
    try {
      const res = await fetch(
        apiUrl(
          `/pancake-webhook/products/variations?shop=${whSelectedShop}`
        )
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: unknown;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Không tải được danh sách sản phẩm');
      }
      setWhProductsData(data.data ?? null);
      setWhProductsSearch('');
    } catch (err) {
      console.error(err);
      setWhProductsData(null);
      setWhProductsError(
        err instanceof Error ? err.message : 'Không tải được danh sách sản phẩm.'
      );
    } finally {
      setWhProductsLoading(false);
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

  const sendProductStockToZalo = async (groupKey: string) => {
    setWhZaloSending(groupKey);
    try {
      const group = whProductsGrouped.find(
        (g) => (g.productCode || getProductName(g.rows[0])) === groupKey
      );
      if (!group) throw new Error('Không tìm thấy nhóm sản phẩm.');

      const firstRow = group.rows[0];
      const imgUrl = getProductImageUrl(firstRow);
      const displayCode = group.productCode || getProductName(firstRow);
      const variants = group.rows.map((row) => ({
        label: getVariantLabel(row, group.productCode),
        stock: getProductStock(row),
      }));

      const imageBase64 = await generateStockImage(displayCode, imgUrl, variants);

      const res = await fetch(apiUrl('/zalo-bot/send-product-stock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setWhZaloResults((prev) => ({ ...prev, [groupKey]: { ok: !!data.ok, error: data.error } }));
      if (data.ok) {
        setTimeout(() => {
          setWhZaloResults((prev) => { const next = { ...prev }; delete next[groupKey]; return next; });
        }, 4000);
      }
    } catch (err) {
      setWhZaloResults((prev) => ({
        ...prev,
        [groupKey]: { ok: false, error: err instanceof Error ? err.message : 'Lỗi gửi' },
      }));
    } finally {
      setWhZaloSending(null);
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

      <section className="card" aria-labelledby="wh-products-title">
        <div className="table-head">
          <h2 id="wh-products-title" className="section-title">
            Danh sách sản phẩm
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
            <UiButton
              onClick={() => void loadPancakeProductsVariations()}
              disabled={whProductsLoading || !whActiveShop?.hasApiKey}
            >
              {whProductsLoading ? 'Đang tải…' : 'Tải từ Pancake'}
            </UiButton>
          </div>
        </div>
        {!whActiveShop?.hasApiKey && (
          <p className="muted small">
            Thêm API key cho shop đã chọn trên server.
          </p>
        )}
        {whProductsError && (
          <p className="hint hint-error">{whProductsError}</p>
        )}
        {whProductsData !== null && !whProductsError && whProductRows.length > 0 && (
          <>
            <div className="search-row">
              <label className="search-label" htmlFor="wh-products-search">
                Lọc sản phẩm
              </label>
              <div className="search-input-wrap">
                <input
                  id="wh-products-search"
                  type="search"
                  className="search-input"
                  placeholder="Tên sản phẩm, mã SKU, mã biến thể, barcode…"
                  value={whProductsSearch}
                  onChange={(e) => setWhProductsSearch(e.target.value)}
                  autoComplete="off"
                />
                {whProductsSearch.trim() !== '' && (
                  <button
                    type="button"
                    className="search-clear"
                    onClick={() => setWhProductsSearch('')}
                    aria-label="Xóa bộ lọc"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
            <p className="muted small">
              <strong>{whProductsGrouped.length}</strong> sản phẩm ·{' '}
              <strong>{whProductsFiltered.length}</strong> biến thể còn hàng
              {whProductsFiltered.length < whProductRows.length && (
                <> (tổng {whProductRows.length} biến thể)</>
              )}
            </p>
            {whProductsFiltered.length === 0 ? (
              <p className="muted">
                Không tìm thấy biến thể nào khớp "{whProductsSearch.trim()}".{' '}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => setWhProductsSearch('')}
                >
                  Xóa bộ lọc
                </button>
              </p>
            ) : (
              <div className="product-group-list">
                {whProductsGrouped.map(({ productCode, rows }) => {
                  const firstRow = rows[0];
                  const imgUrl = getProductImageUrl(firstRow);
                  const productName = getProductName(firstRow);
                  const price = getProductPrice(firstRow);
                  const placeholderLetter = (
                    productName !== '—' ? productName[0] : (productCode[0] ?? '?')
                  ).toUpperCase();
                  const groupKey = productCode || productName;
                  return (
                    <div key={groupKey} className="product-group">
                      <div className="product-group-header">
                        <div className="product-group-thumb">
                          <div className="product-card-img-placeholder" aria-hidden>
                            {placeholderLetter}
                          </div>
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              alt={productName}
                              className="product-card-img"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="product-group-info">
                          <p className="product-group-name">{productName}</p>
                          <div className="product-group-meta">
                            {productCode && (
                              <code className="product-code">{productCode}</code>
                            )}
                            {price !== '—' && (
                              <span className="product-card-price">{price}</span>
                            )}
                            <span className="product-group-count">
                              {rows.length} biến thể
                            </span>
                          </div>
                          <div className="product-group-zalo">
                            <UiButton
                              variant="secondary"
                              disabled={whZaloSending !== null}
                              onClick={() =>
                                void sendProductStockToZalo(groupKey)
                              }
                            >
                              {whZaloSending === groupKey ? 'Đang gửi…' : 'Gửi Zalo'}
                            </UiButton>
                            {whZaloResults[groupKey] && (
                              whZaloResults[groupKey].ok
                                ? <span className="zalo-send-ok">✓ Đã gửi</span>
                                : <span className="zalo-send-error">{whZaloResults[groupKey].error ?? 'Lỗi'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="product-group-variants">
                        {rows.map((row, vi) => {
                          const displayId = String(row.display_id ?? '');
                          const variantLabel = getVariantLabel(row, productCode);
                          const stock = getProductStock(row);
                          const status = productStatusInfo(row);
                          const cls = stockClass(stock);
                          return (
                            <div
                              key={displayId || vi}
                              className="product-variant-row"
                            >
                              <span className="product-variant-label">
                                {variantLabel}
                              </span>
                              {displayId && (
                                <code className="product-code product-code--secondary">
                                  {displayId}
                                </code>
                              )}
                              <span className={`product-variant-stock ${cls}`}>
                                Tồn:{' '}
                                {stock === null
                                  ? '—'
                                  : stock.toLocaleString('vi-VN')}
                              </span>
                              {status.label && (
                                <span className={`product-status ${status.cls}`}>
                                  {status.label}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {whProductsData !== null && !whProductsError && whProductRows.length === 0 && (
          <pre className="webhook-payload">
            {JSON.stringify(whProductsData, null, 2)}
          </pre>
        )}
      </section>

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
