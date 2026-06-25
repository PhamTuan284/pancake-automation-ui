import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { extractApiRows } from '../../lib/apiResponse';
import { UiButton } from '../../components/ui';

// ── Helpers (shared subset from ProductStockZaloSection) ──────────────────────

function nestedProduct(row: Record<string, unknown>): Record<string, unknown> | null {
  const p = row.product;
  return p && typeof p === 'object' && !Array.isArray(p)
    ? (p as Record<string, unknown>)
    : null;
}

function getProductCode(row: Record<string, unknown>): string {
  const prod = nestedProduct(row);
  return String(row.product_display_id ?? prod?.display_id ?? row.product_sku ?? '').trim();
}

function getProductName(row: Record<string, unknown>): string {
  const prod = nestedProduct(row);
  return String(row.product_name ?? prod?.name ?? row.name ?? '').trim() || '—';
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

function getProductStock(row: Record<string, unknown>): number | null {
  for (const field of ['quantity', 'remain_quantity', 'stock_quantity']) {
    const v = row[field];
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DailyStockConfig {
  productCodes: string[];
  shopKey: string;
  enabled: boolean;
  sendTime: string;
  lastSentDate: string;
}

interface ProductGroup {
  productCode: string;
  productName: string;
  imageUrl: string | null;
  totalStock: number;
}

interface Props {
  shopKey: string;
}

const PRODUCTS_PER_MESSAGE = 9;

export function DailyStockScheduleSection({ shopKey }: Props) {
  // Product list state
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [rawData, setRawData] = useState<unknown>(null);

  // Config state
  const [config, setConfig] = useState<DailyStockConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendTime, setSendTime] = useState('16:30');
  const [enabled, setEnabled] = useState(true);

  // Action state
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [sendMsg, setSendMsg] = useState('');

  // Search
  const [search, setSearch] = useState('');

  // ── Load config ────────────────────────────────────────────────────────────
  useEffect(() => {
    setConfigLoading(true);
    fetch(apiUrl('/zalo-bot/daily-stock-config'))
      .then((r) => r.json() as Promise<{ ok?: boolean } & DailyStockConfig>)
      .then((data) => {
        if (data.ok) {
          setConfig(data);
          setSelected(new Set(data.productCodes));
          setSendTime(data.sendTime ?? '16:30');
          setEnabled(data.enabled ?? true);
        }
      })
      .catch(() => { /* ignore — start with defaults */ })
      .finally(() => setConfigLoading(false));
  }, []);

  // ── Load products ──────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetch(apiUrl(`/pancake-webhook/products/variations?shop=${shopKey}`));
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; data?: unknown; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Không tải được sản phẩm');
      setRawData(json.data ?? null);
      setSearch('');
    } catch (err) {
      setRawData(null);
      setLoadError(err instanceof Error ? err.message : 'Không tải được danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [shopKey]);

  // ── Derive product groups ──────────────────────────────────────────────────
  const productRows = useMemo(() => extractApiRows(rawData), [rawData]);

  const productsGrouped = useMemo((): ProductGroup[] => {
    const groups = new Map<string, ProductGroup>();
    for (const row of productRows) {
      const code = getProductCode(row);
      const name = getProductName(row);
      const key = code || name;
      if (!groups.has(key)) {
        groups.set(key, {
          productCode: code,
          productName: name,
          imageUrl: getProductImageUrl(row),
          totalStock: 0,
        });
      }
      const stock = getProductStock(row);
      groups.get(key)!.totalStock += stock ?? 0;
    }
    return [...groups.values()];
  }, [productRows]);

  const productsFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productsGrouped;
    return productsGrouped.filter((g) =>
      `${g.productCode} ${g.productName}`.toLowerCase().includes(q)
    );
  }, [productsGrouped, search]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaveMsg('');
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/daily-stock-config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCodes: [...selected],
          shopKey,
          enabled,
          sendTime,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & DailyStockConfig;
      if (!data.ok) throw new Error(data.error ?? 'Lưu thất bại');
      setConfig(data);
      setSaveMsg('Đã lưu lịch gửi!');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(`Lỗi: ${err instanceof Error ? err.message : 'Không lưu được'}`);
    } finally {
      setSaving(false);
    }
  };

  const sendNow = async () => {
    setSending(true);
    setSendMsg('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/send-daily-stock'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'Gửi thất bại');
      setSendMsg('Đã gửi Zalo thành công!');
      setTimeout(() => setSendMsg(''), 5000);
    } catch (err) {
      setSendMsg(`Lỗi: ${err instanceof Error ? err.message : 'Không gửi được'}`);
    } finally {
      setSending(false);
    }
  };

  const configChanged =
    config === null ||
    JSON.stringify([...selected].sort()) !== JSON.stringify([...(config.productCodes ?? [])].sort()) ||
    sendTime !== (config.sendTime ?? '16:30') ||
    enabled !== (config.enabled ?? true);

  return (
    <section className="card" aria-labelledby="daily-stock-title">
      <div className="table-head">
        <h2 id="daily-stock-title" className="section-title">
          Lịch gửi tồn kho Zalo
        </h2>
        <div className="table-head-actions">
          <UiButton onClick={() => void loadProducts()} disabled={loading}>
            {loading ? 'Đang tải…' : 'Tải sản phẩm'}
          </UiButton>
        </div>
      </div>

      {/* Schedule settings */}
      <div className="daily-stock-settings">
        <label className="daily-stock-setting-row">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setSaveMsg(''); }}
          />
          <span>Bật gửi tự động hàng ngày</span>
        </label>

        <label className="daily-stock-setting-row">
          <span>Giờ gửi (giờ VN):</span>
          <input
            type="time"
            value={sendTime}
            onChange={(e) => { setSendTime(e.target.value); setSaveMsg(''); }}
            className="daily-stock-time-input"
          />
        </label>

        <div className="daily-stock-info">
          {configLoading ? (
            <span className="muted small">Đang tải cấu hình…</span>
          ) : (
            <>
              <span className="muted small">
                {selected.size} sản phẩm được chọn
                {selected.size > PRODUCTS_PER_MESSAGE && (
                  <> · sẽ gửi {Math.ceil(selected.size / PRODUCTS_PER_MESSAGE)} tin nhắn ({PRODUCTS_PER_MESSAGE} sản phẩm/tin)</>
                )}
              </span>
              {config?.lastSentDate && (
                <span className="muted small"> · Đã gửi lần cuối: {config.lastSentDate}</span>
              )}
            </>
          )}
        </div>

        <div className="daily-stock-actions">
          <UiButton
            variant="primary"
            onClick={() => void saveConfig()}
            disabled={saving || !configChanged}
          >
            {saving ? 'Đang lưu…' : 'Lưu lịch gửi'}
          </UiButton>
          <UiButton
            onClick={() => void sendNow()}
            disabled={sending || (config?.productCodes?.length ?? 0) === 0}
            title={
              (config?.productCodes?.length ?? 0) === 0
                ? 'Chưa có sản phẩm nào được lưu vào lịch'
                : 'Gửi báo cáo tồn kho ngay bây giờ'
            }
          >
            {sending ? 'Đang gửi…' : 'Gửi ngay'}
          </UiButton>
          {saveMsg && (
            <span className={`daily-stock-msg ${saveMsg.startsWith('Lỗi') ? 'hint-error' : 'hint-ok'}`}>
              {saveMsg}
            </span>
          )}
          {sendMsg && (
            <span className={`daily-stock-msg ${sendMsg.startsWith('Lỗi') ? 'hint-error' : 'hint-ok'}`}>
              {sendMsg}
            </span>
          )}
        </div>
      </div>

      {/* Product list */}
      {loadError && <p className="hint hint-error">{loadError}</p>}

      {rawData !== null && !loadError && (
        <>
          {productsGrouped.length > 0 && (
            <div className="search-row" style={{ marginTop: '12px' }}>
              <input
                type="search"
                className="search-input"
                placeholder="Lọc theo tên, mã sản phẩm…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                style={{ maxWidth: '320px' }}
              />
            </div>
          )}

          {productsFiltered.length === 0 && (
            <p className="muted small" style={{ marginTop: '8px' }}>
              {search ? `Không tìm thấy sản phẩm khớp "${search}".` : 'Không có sản phẩm.'}
            </p>
          )}

          <div className="daily-stock-product-list">
            {productsFiltered.map((g) => {
              const key = g.productCode || g.productName;
              const isSelected = selected.has(key);
              return (
                <label
                  key={key}
                  className={`daily-stock-product-item${isSelected ? ' daily-stock-product-item--selected' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(key)}
                    className="daily-stock-checkbox"
                  />
                  {g.imageUrl ? (
                    <img
                      src={g.imageUrl}
                      alt=""
                      className="daily-stock-product-thumb"
                      loading="lazy"
                    />
                  ) : (
                    <span className="daily-stock-product-thumb daily-stock-product-thumb--placeholder">
                      {(g.productName !== '—' ? g.productName[0] : (g.productCode[0] ?? '?')).toUpperCase()}
                    </span>
                  )}
                  <span className="daily-stock-product-info">
                    <span className="daily-stock-product-code">{g.productCode || '—'}</span>
                    <span className="daily-stock-product-name">{g.productName}</span>
                    <span className="daily-stock-product-stock muted small">
                      Tồn: {g.totalStock}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </>
      )}

      {rawData === null && !loadError && !loading && (
        <p className="muted small" style={{ marginTop: '8px' }}>
          Nhấn "Tải sản phẩm" để chọn sản phẩm cho lịch gửi tự động.
          {config?.productCodes && config.productCodes.length > 0 && (
            <> Đã lưu {config.productCodes.length} sản phẩm: {config.productCodes.join(', ')}</>
          )}
        </p>
      )}
    </section>
  );
}
