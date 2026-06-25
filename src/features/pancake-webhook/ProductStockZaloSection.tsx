import { useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { extractApiRows } from '../../lib/apiResponse';
import { UiButton } from '../../components/ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Stock image generator ─────────────────────────────────────────────────────

async function generateStockImage(
  displayCode: string,
  imageUrl: string | null,
  variants: Array<{ color: string; size: string; stock: number | null }>
): Promise<string> {
  const W = 800, H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

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

  const colorMap = new Map<string, { color: string; items: Array<{ size: string; stock: number | null }> }>();
  for (const v of variants) {
    const key = v.color || '__';
    if (!colorMap.has(key)) colorMap.set(key, { color: v.color, items: [] });
    colorMap.get(key)!.items.push({ size: v.size, stock: v.stock });
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

  const corners: [number, number, boolean, boolean][] = [
    [MARGIN, 110, false, false],
    [W - MARGIN, 110, true, false],
    [MARGIN, H - MARGIN, false, true],
    [W - MARGIN, H - MARGIN, true, true],
  ];

  groups.slice(0, 4).forEach((group, i) => {
    const [ax, ay, alignRight, alignBottom] = corners[i];

    ctx.font = `bold ${STOCK_FONT}px sans-serif`;
    const maxStockW = Math.max(...group.items.map(it => ctx.measureText(`${it.stock ?? '?'} ${it.size}`).width));
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
      ctx.fillText(`${it.stock ?? '?'} ${it.size}`, textX, textY);
    }
  });

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

async function stitchIntoComposite(base64Images: string[]): Promise<string> {
  const COLS = 3;
  const GAP = 6;
  const CELL_W = 560;
  const CELL_H = 700;
  const rows = Math.ceil(base64Images.length / COLS);
  const usedCols = Math.min(base64Images.length, COLS);
  const totalW = usedCols * CELL_W + (usedCols - 1) * GAP;
  const totalH = rows * CELL_H + (rows - 1) * GAP;

  const canvas = document.createElement('canvas');
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#222';
  ctx.fillRect(0, 0, totalW, totalH);

  await Promise.all(
    base64Images.map(
      (b64, i) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const x = col * (CELL_W + GAP);
            const y = row * (CELL_H + GAP);
            ctx.drawImage(img, x, y, CELL_W, CELL_H);
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `data:image/png;base64,${b64}`;
        })
    )
  );

  return canvas.toDataURL('image/jpeg', 0.92).replace('data:image/jpeg;base64,', '');
}

// ─────────────────────────────────────────────────────────────────────────────

interface ShopOption {
  shopKey: string;
  label: string;
  hasApiKey?: boolean;
}

interface ProductStockZaloSectionProps {
  shopKey: string;
  /** When provided with >1 entries, shows an inline shop selector. */
  shops?: ShopOption[];
  onShopChange?: (key: string) => void;
}

export function ProductStockZaloSection({
  shopKey,
  shops,
  onShopChange,
}: ProductStockZaloSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [debug, setDebug] = useState(false);
  const [zaloSending, setZaloSending] = useState<string | null>(null);
  const [zaloResults, setZaloResults] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [zaloSelected, setZaloSelected] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const activeShop = shops?.find((s) => s.shopKey === shopKey);
  const hasApiKey = activeShop?.hasApiKey ?? true;
  const showSelector = (shops?.length ?? 0) > 1 && !!onShopChange;

  const productRows = useMemo(() => extractApiRows(data), [data]);

  const productsFiltered = useMemo(() => {
    const inStock = productRows.filter((row) => {
      const stock = getProductStock(row);
      return stock === null || stock > 0;
    });
    if (!search.trim()) return inStock;
    const q = search.trim().toLowerCase();
    return inStock.filter((row) => {
      const prod = nestedProduct(row);
      const haystack = [
        row.product_name, prod?.name, row.name, row.display_id, row.sku, row.product_sku, row.barcode,
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [productRows, search]);

  const productsGrouped = useMemo(() => {
    const groups = new Map<string, { productCode: string; rows: typeof productsFiltered }>();
    for (const row of productsFiltered) {
      const productCode = getProductCode(row);
      const key = productCode || String(row.variation_id ?? row.id ?? row.display_id ?? Math.random());
      if (!groups.has(key)) groups.set(key, { productCode, rows: [] });
      groups.get(key)!.rows.push(row);
    }
    return [...groups.values()];
  }, [productsFiltered]);

  const loadProducts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        apiUrl(`/pancake-webhook/products/variations?shop=${shopKey}`)
      );
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: unknown;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || 'Không tải được danh sách sản phẩm');
      }
      setData(json.data ?? null);
      setSearch('');
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  const buildVariants = (group: { productCode: string; rows: Array<Record<string, unknown>> }) =>
    group.rows.map((row) => {
      const fields = Array.isArray(row.fields)
        ? (row.fields as Array<Record<string, unknown>>)
        : [];
      const colorField = fields.find(
        (f) => typeof f.name === 'string' && /màu/i.test(f.name)
      );
      const sizeField = fields.find(
        (f) => typeof f.name === 'string' && /size|kích/i.test(f.name)
      );
      const color = typeof colorField?.value === 'string' ? colorField.value : '';
      const size = typeof sizeField?.value === 'string'
        ? sizeField.value
        : getVariantLabel(row, group.productCode);
      return { color, size, stock: getProductStock(row) };
    });

  const sendProductStockToZalo = async (groupKey: string) => {
    setZaloSending(groupKey);
    try {
      const group = productsGrouped.find(
        (g) => (g.productCode || getProductName(g.rows[0])) === groupKey
      );
      if (!group) throw new Error('Không tìm thấy nhóm sản phẩm.');
      const firstRow = group.rows[0];
      const displayCode = group.productCode || getProductName(firstRow);
      const imageBase64 = await generateStockImage(
        displayCode,
        getProductImageUrl(firstRow),
        buildVariants(group)
      );
      const res = await fetch(apiUrl('/zalo-bot/send-product-stock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const resData = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      setZaloResults((prev) => ({ ...prev, [groupKey]: { ok: !!resData.ok, error: resData.error } }));
      if (resData.ok) {
        setTimeout(() => {
          setZaloResults((prev) => { const next = { ...prev }; delete next[groupKey]; return next; });
        }, 4000);
      }
    } catch (err) {
      setZaloResults((prev) => ({
        ...prev,
        [groupKey]: { ok: false, error: err instanceof Error ? err.message : 'Lỗi gửi' },
      }));
    } finally {
      setZaloSending(null);
    }
  };

  const toggleZaloSelect = (key: string) => {
    setZaloSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sendSelectedToZalo = async () => {
    const keys = [...zaloSelected];
    if (keys.length === 0 || bulkSending) return;
    setBulkSending(true);
    try {
      // Generate individual stock images
      const images: string[] = [];
      for (let i = 0; i < keys.length; i++) {
        setBulkProgress({ done: i, total: keys.length });
        const group = productsGrouped.find(
          (g) => (g.productCode || getProductName(g.rows[0])) === keys[i]
        );
        if (!group) continue;
        const firstRow = group.rows[0];
        const b64 = await generateStockImage(
          group.productCode || getProductName(firstRow),
          getProductImageUrl(firstRow),
          buildVariants(group)
        );
        images.push(b64);
      }

      setBulkProgress({ done: keys.length, total: keys.length });

      // Stitch into one composite image, or send directly if only one
      const imageBase64 = images.length === 1
        ? images[0]
        : await stitchIntoComposite(images);

      const res = await fetch(apiUrl('/zalo-bot/send-product-stock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const resData = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };

      if (resData.ok) {
        const successMap: Record<string, { ok: boolean }> = {};
        for (const k of keys) successMap[k] = { ok: true };
        setZaloResults((prev) => ({ ...prev, ...successMap }));
        setTimeout(() => {
          setZaloResults((prev) => {
            const next = { ...prev };
            for (const k of keys) delete next[k];
            return next;
          });
        }, 4000);
        setZaloSelected(new Set());
      } else {
        setZaloResults((prev) => ({
          ...prev,
          [keys[0]]: { ok: false, error: resData.error ?? 'Lỗi gửi' },
        }));
      }
    } catch (err) {
      setZaloResults((prev) => ({
        ...prev,
        [keys[0] ?? '__bulk']: { ok: false, error: err instanceof Error ? err.message : 'Lỗi gửi' },
      }));
    } finally {
      setBulkProgress(null);
      setBulkSending(false);
    }
  };

  return (
    <section className="card" aria-labelledby="ps-products-title">
      <div className="table-head">
        <h2 id="ps-products-title" className="section-title">
          Danh sách sản phẩm
        </h2>
        <div className="table-head-actions">
          {showSelector && (
            <label className="muted small">
              Shop{' '}
              <select
                value={shopKey}
                onChange={(e) => onShopChange!(e.target.value)}
              >
                {shops!.map((s) => (
                  <option key={s.shopKey} value={s.shopKey}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <UiButton
            onClick={() => void loadProducts()}
            disabled={loading || !hasApiKey}
          >
            {loading ? 'Đang tải…' : 'Tải từ Pancake'}
          </UiButton>
        </div>
      </div>
      {!hasApiKey && (
        <p className="muted small">Thêm API key cho shop đã chọn trên server.</p>
      )}
      {error && <p className="hint hint-error">{error}</p>}
      {data !== null && !error && productRows.length > 0 && (
        <>
          <div className="search-row">
            <label className="search-label" htmlFor="ps-products-search">
              Lọc sản phẩm
            </label>
            <div className="search-input-wrap">
              <input
                id="ps-products-search"
                type="search"
                className="search-input"
                placeholder="Tên sản phẩm, mã SKU, mã biến thể, barcode…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
              {search.trim() !== '' && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Xóa bộ lọc"
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <p className="muted small">
            <strong>{productsGrouped.length}</strong> sản phẩm ·{' '}
            <strong>{productsFiltered.length}</strong> biến thể còn hàng
            {productsFiltered.length < productRows.length && (
              <> (tổng {productRows.length} biến thể)</>
            )}
            {' · '}
            <button
              type="button"
              className="link-btn"
              onClick={() => setDebug((v) => !v)}
            >
              {debug ? 'Ẩn dữ liệu mẫu' : 'Xem dữ liệu mẫu'}
            </button>
            {' · '}
            <button
              type="button"
              className="link-btn"
              disabled={bulkSending || zaloSending !== null}
              onClick={() => {
                const allKeys = productsGrouped.map(
                  (g) => g.productCode || getProductName(g.rows[0])
                );
                setZaloSelected(new Set(allKeys));
              }}
            >
              Chọn tất cả
            </button>
          </p>
          {debug && productRows.length > 0 && (
            <details open className="raw-data-debug">
              <summary>Biến thể đầu tiên — raw JSON từ Pancake</summary>
              <pre className="raw-data-pre">{JSON.stringify(productRows[0], null, 2)}</pre>
            </details>
          )}
          {zaloSelected.size > 0 && (
            <div className="zalo-bulk-toolbar">
              <span className="zalo-bulk-count">
                {zaloSelected.size} sản phẩm được chọn
              </span>
              <button
                type="button"
                className="link-btn"
                disabled={bulkSending}
                onClick={() => setZaloSelected(new Set())}
              >
                Bỏ chọn tất cả
              </button>
              <UiButton
                variant="primary"
                disabled={bulkSending || zaloSending !== null}
                onClick={() => void sendSelectedToZalo()}
              >
                {bulkSending
                  ? bulkProgress && bulkProgress.done < bulkProgress.total
                    ? `Đang tạo ảnh ${bulkProgress.done + 1}/${bulkProgress.total}…`
                    : 'Đang gửi…'
                  : `Gửi ${zaloSelected.size} ảnh lên Zalo`}
              </UiButton>
            </div>
          )}
          {productsFiltered.length === 0 ? (
            <p className="muted">
              Không tìm thấy biến thể nào khớp "{search.trim()}".{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => setSearch('')}
              >
                Xóa bộ lọc
              </button>
            </p>
          ) : (
            <div className="product-group-list">
              {productsGrouped.map(({ productCode, rows }) => {
                const firstRow = rows[0];
                const imgUrl = getProductImageUrl(firstRow);
                const productName = getProductName(firstRow);
                const price = getProductPrice(firstRow);
                const placeholderLetter = (
                  productName !== '—' ? productName[0] : (productCode[0] ?? '?')
                ).toUpperCase();
                const groupKey = productCode || productName;
                return (
                  <div
                    key={groupKey}
                    className={`product-group${zaloSelected.has(groupKey) ? ' product-group--selected' : ''}`}
                  >
                    <label className="product-group-checkbox" title="Chọn để gửi Zalo">
                      <input
                        type="checkbox"
                        checked={zaloSelected.has(groupKey)}
                        onChange={() => toggleZaloSelect(groupKey)}
                        disabled={bulkSending || zaloSending !== null}
                      />
                    </label>
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
                            disabled={zaloSending !== null || bulkSending}
                            onClick={() => void sendProductStockToZalo(groupKey)}
                          >
                            {zaloSending === groupKey ? 'Đang gửi…' : 'Gửi Zalo'}
                          </UiButton>
                          {zaloResults[groupKey] && (
                            zaloResults[groupKey].ok
                              ? <span className="zalo-send-ok">✓ Đã gửi</span>
                              : <span className="zalo-send-error">{zaloResults[groupKey].error ?? 'Lỗi'}</span>
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
      {data !== null && !error && productRows.length === 0 && (
        <pre className="webhook-payload">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}
