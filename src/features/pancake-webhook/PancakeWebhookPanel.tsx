import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PancakeWebhookConfig, PancakeWebhookEventRow } from '../../types';
import { apiUrl } from '../../lib/api';
import {
  apiCellText,
  apiTableColumns,
  extractApiRows,
} from '../../lib/apiResponse';
import {
  UiButton,
  UiDataTable,
  type UiDataTableColumn,
} from '../../components/ui';

const DEFAULT_WEBHOOK_TYPES = [
  'orders',
  'customers',
  'products',
  'variations_warehouses',
];

export function PancakeWebhookPanel({
  toolDescription,
}: {
  toolDescription: string;
}) {
  const [whConfig, setWhConfig] = useState<PancakeWebhookConfig | null>(null);
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

  const whProductRows = useMemo(
    () => extractApiRows(whProductsData),
    [whProductsData]
  );
  const whProductCols = useMemo(
    () =>
      apiTableColumns(whProductRows, [
        'variation_id',
        'id',
        'sku',
        'product_sku',
        'name',
        'product_name',
        'barcode',
        'price',
        'quantity',
        'status',
        'updated_at',
      ]),
    [whProductRows]
  );
  const whProductTableColumns: UiDataTableColumn<(typeof whProductRows)[number]>[] =
    whProductCols.map((col) => ({
      key: col,
      header: col,
      render: (row) => apiCellText(row[col]),
    }));

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
      const res = await fetch(apiUrl('/pancake-webhook/products/variations'));
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: unknown;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Không tải được danh sách sản phẩm');
      }
      setWhProductsData(data.data ?? null);
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
          liệu Pancake. Cần <code>PANCAKE_API_KEY</code> và{' '}
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
            disabled={whRegisterBusy || !whConfig?.hasApiKey}
          >
            {whRegisterBusy ? 'Đang gửi…' : 'Gửi cấu hình lên Pancake'}
          </UiButton>
          {!whConfig?.hasApiKey && (
            <span className="muted small">
              Thêm PANCAKE_API_KEY để bật nút này.
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
            <UiButton
              onClick={() => void loadPancakeProductsVariations()}
              disabled={whProductsLoading || !whConfig?.hasApiKey}
            >
              {whProductsLoading ? 'Đang tải…' : 'Tải từ Pancake'}
            </UiButton>
          </div>
        </div>
        {!whConfig?.hasApiKey && (
          <p className="muted small">
            Thêm <code>PANCAKE_API_KEY</code> trên server để bật nút tải.
          </p>
        )}
        {whProductsError && (
          <p className="hint hint-error">{whProductsError}</p>
        )}
        {whProductsData !== null &&
          !whProductsError &&
          whProductRows.length > 0 && (
            <UiDataTable
              rows={whProductRows}
              columns={whProductTableColumns}
              rowKey={(row, i) =>
                String(row.variation_id ?? row.id ?? row.sku ?? `prd-${i}`)
              }
              wrapClassName="webhook-openapi-wrap"
              tableClassName="data-table--openapi"
            />
          )}
        {whProductsData !== null &&
          !whProductsError &&
          whProductRows.length === 0 && (
            <pre className="webhook-payload">
              {JSON.stringify(whProductsData, null, 2)}
            </pre>
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
  );
}
