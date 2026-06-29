import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { UiButton } from '../../components/ui';

type ZaloUpdateChat = {
  id: string;
  title: string;
  type: string;
};

type ZaloConfig = {
  botConfigured: boolean;
  chatId: string | null;
  reportHour: number;
  shopKey: string;
  windowDays: number;
  topLimit: number;
  excludeVariants: string[];
};

type ZaloLog = {
  id: string;
  sentAt: string;
  kind: 'test' | 'report' | 'scheduled' | 'alert';
  success: boolean;
  error?: string;
  chatId: string;
  preview: string;
};

type AbnormalOrderConfig = {
  enabled: boolean;
  thresholdPct: number;
};

const KIND_LABEL: Record<ZaloLog['kind'], string> = {
  test: 'Test',
  report: 'Báo cáo',
  scheduled: 'Tự động',
  alert: 'Cảnh báo',
};

export function ZaloBotPanel({ toolDescription }: { toolDescription: string }) {
  const [config, setConfig] = useState<ZaloConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [configLoading, setConfigLoading] = useState(false);

  const [logs, setLogs] = useState<ZaloLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookBusy, setWebhookBusy] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState('');
  const [webhookSecretToken, setWebhookSecretToken] = useState('');
  const [webhookError, setWebhookError] = useState('');

  const [updatesBusy, setUpdatesBusy] = useState(false);
  const [updatesChats, setUpdatesChats] = useState<ZaloUpdateChat[] | null>(null);
  const [updatesError, setUpdatesError] = useState('');

  const [testBusy, setTestBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const [abnormalConfig, setAbnormalConfig] = useState<AbnormalOrderConfig | null>(null);
  const [editEnabled, setEditEnabled] = useState(true);
  const [editThreshold, setEditThreshold] = useState('60');
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [mockBusy, setMockBusy] = useState(false);
  const [mockMessage, setMockMessage] = useState('');
  const [mockError, setMockError] = useState('');

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/config'));
      const data = (await res.json().catch(() => ({}))) as Partial<ZaloConfig & { error?: string }>;
      if (!res.ok) throw new Error(data.error ?? 'Không tải được cấu hình');
      setConfig(data as ZaloConfig);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Lỗi tải cấu hình.');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(apiUrl('/zalo-bot/logs'));
      const data = (await res.json().catch(() => ({}))) as { logs?: ZaloLog[] };
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadAbnormalConfig = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/zalo-bot/abnormal-order-config'));
      const data = (await res.json().catch(() => ({}))) as Partial<AbnormalOrderConfig>;
      if (typeof data.enabled === 'boolean' && typeof data.thresholdPct === 'number') {
        setAbnormalConfig({ enabled: data.enabled, thresholdPct: data.thresholdPct });
        setEditEnabled(data.enabled);
        setEditThreshold(String(data.thresholdPct));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadLogs();
    void loadAbnormalConfig();
  }, [loadConfig, loadLogs, loadAbnormalConfig]);

  async function handleSetWebhook() {
    setWebhookBusy(true);
    setWebhookMessage('');
    setWebhookError('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/set-webhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; secretToken?: string };
      if (!res.ok) throw new Error(data.error ?? 'Đặt webhook thất bại');
      setWebhookSecretToken(data.secretToken ?? '');
      setWebhookMessage('Đã đặt webhook thành công! Gửi một tin vào nhóm Zalo rồi xem payload trên webhook.site để lấy chat_id.');
    } catch (err) {
      setWebhookError(err instanceof Error ? err.message : 'Lỗi khi đặt webhook.');
    } finally {
      setWebhookBusy(false);
    }
  }

  async function handleGetUpdates() {
    setUpdatesBusy(true);
    setUpdatesError('');
    setUpdatesChats(null);
    try {
      const res = await fetch(apiUrl('/zalo-bot/get-updates'), { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; chats?: ZaloUpdateChat[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Lấy updates thất bại');
      setUpdatesChats(data.chats ?? []);
    } catch (err) {
      setUpdatesError(err instanceof Error ? err.message : 'Lỗi khi lấy updates.');
    } finally {
      setUpdatesBusy(false);
    }
  }

  async function handleSendTest() {
    setTestBusy(true);
    setActionMessage('');
    setActionError('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/send-test'), { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gửi thất bại');
      setActionMessage('Đã gửi tin nhắn test thành công lên Zalo!');
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gửi test thất bại.');
    } finally {
      setTestBusy(false);
      void loadLogs();
    }
  }

  async function handleSendReport() {
    setReportBusy(true);
    setActionMessage('');
    setActionError('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/send-report'), { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gửi báo cáo thất bại');
      setActionMessage('Đã gửi báo cáo biến thể bán chạy lên Zalo!');
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gửi báo cáo thất bại.');
    } finally {
      setReportBusy(false);
      void loadLogs();
    }
  }

  async function handleSaveAbnormalConfig() {
    setSaveBusy(true);
    setSaveMessage('');
    setSaveError('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/abnormal-order-config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: editEnabled, thresholdPct: Math.min(100, Math.max(1, parseInt(editThreshold, 10) || 60)) }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<AbnormalOrderConfig & { error?: string }>;
      if (!res.ok) throw new Error((data as { error?: string }).error ?? 'Lưu thất bại');
      if (typeof data.enabled === 'boolean' && typeof data.thresholdPct === 'number') {
        setAbnormalConfig({ enabled: data.enabled, thresholdPct: data.thresholdPct });
      }
      setSaveMessage('Đã lưu cấu hình!');
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Lưu thất bại.');
    } finally {
      setSaveBusy(false);
    }
  }

  async function handleSendMockAlert() {
    setMockBusy(true);
    setMockMessage('');
    setMockError('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/send-mock-abnormal-order'), { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gửi thất bại');
      setMockMessage('Đã gửi tin nhắn cảnh báo mẫu lên Zalo!');
      setTimeout(() => setMockMessage(''), 6000);
    } catch (err) {
      setMockError(err instanceof Error ? err.message : 'Gửi thất bại.');
    } finally {
      setMockBusy(false);
      void loadLogs();
    }
  }

  const canSend = config?.botConfigured && !!config?.chatId;

  return (
    <>
      <p className="tool-intro muted">{toolDescription}</p>

      <section className="card" aria-labelledby="zalo-config-title">
        <h2 id="zalo-config-title" className="section-title">Cấu hình Bot</h2>
        <p className="muted small">
          Thiết lập các biến môi trường sau trên server:
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Biến môi trường</th>
              <th>Mô tả</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>ZALO_BOT_TOKEN</code></td><td>Token từ <a href="https://bot.zapps.me" target="_blank" rel="noreferrer">Zalo Bot Platform</a> (bắt buộc)</td></tr>
            <tr><td><code>ZALO_CHAT_ID</code></td><td>Chat ID của nhóm nhận báo cáo (bắt buộc)</td></tr>
            <tr><td><code>ZALO_REPORT_HOUR</code></td><td>Giờ gửi tự động theo giờ VN, mặc định <code>8</code></td></tr>
            <tr><td><code>ZALO_REPORT_SHOP</code></td><td>Shop Pancake: <code>meit</code> hoặc <code>dpa</code>, mặc định <code>meit</code></td></tr>
            <tr><td><code>ZALO_REPORT_DAYS</code></td><td>Số ngày phân tích, mặc định <code>7</code></td></tr>
            <tr><td><code>ZALO_REPORT_LIMIT</code></td><td>Số dòng biến thể tối đa, mặc định <code>15</code></td></tr>
            <tr><td><code>ZALO_EXCLUDE_VARIANTS</code></td><td>Mã biến thể loại trừ, phân cách bằng dấu phẩy (vd: <code>H,MTL01</code>)</td></tr>
          </tbody>
        </table>

        {configLoading && <p className="muted">Đang tải…</p>}
        {configError && <p className="hint hint-error">{configError}</p>}
        {config && (
          <div style={{ marginTop: '1rem' }}>
            <p className="muted small"><strong>Trạng thái hiện tại:</strong></p>
            <ul className="muted small" style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
              <li>
                Bot Token:{' '}
                {config.botConfigured
                  ? <strong style={{ color: 'var(--color-ok, green)' }}>✓ Đã cấu hình</strong>
                  : <strong style={{ color: 'var(--color-error, red)' }}>✗ Chưa có (ZALO_BOT_TOKEN)</strong>}
              </li>
              <li>
                Chat ID:{' '}
                {config.chatId
                  ? <strong style={{ color: 'var(--color-ok, green)' }}>{config.chatId}</strong>
                  : <strong style={{ color: 'var(--color-error, red)' }}>✗ Chưa có (ZALO_CHAT_ID)</strong>}
              </li>
              <li>Gửi tự động lúc <strong>{config.reportHour}:00</strong> (giờ VN) mỗi ngày</li>
              <li>Shop: <code>{config.shopKey}</code> · {config.windowDays} ngày · top {config.topLimit} biến thể</li>
              {config.excludeVariants.length > 0 && (
                <li>Loại trừ: <code>{config.excludeVariants.join(', ')}</code></li>
              )}
            </ul>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="zalo-updates-title">
        <h2 id="zalo-updates-title" className="section-title">Tìm Chat ID nhóm</h2>

        <p className="muted small"><strong>Cách 1 — Webhook tạm (khuyến nghị)</strong></p>
        <ol className="muted small" style={{ paddingLeft: '1.25rem', marginTop: '0.25rem' }}>
          <li>Vào <a href="https://webhook.site" target="_blank" rel="noreferrer">webhook.site</a> → copy URL duy nhất của bạn</li>
          <li>Dán URL vào ô dưới và bấm <strong>Đặt Webhook</strong></li>
          <li>Gửi bất kỳ tin nhắn nào vào nhóm Zalo</li>
          <li>Xem payload trên webhook.site → lấy giá trị <code>chat.id</code></li>
        </ol>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="url"
            className="search-input webhook-url-input"
            placeholder="https://webhook.site/xxxx-xxxx-xxxx"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            autoComplete="off"
            style={{ flex: 1, minWidth: '260px' }}
          />
          <UiButton
            onClick={() => void handleSetWebhook()}
            disabled={webhookBusy || !config?.botConfigured || !webhookUrl.trim()}
          >
            {webhookBusy ? 'Đang đặt…' : 'Đặt Webhook'}
          </UiButton>
        </div>
        {webhookMessage && (
          <div style={{ marginTop: '0.5rem' }}>
            <p className="hint hint-ok">{webhookMessage}</p>
            {webhookSecretToken && (
              <p className="muted small" style={{ marginTop: '0.25rem' }}>
                Secret token đã dùng: <code>{webhookSecretToken}</code>
              </p>
            )}
          </div>
        )}
        {webhookError && <p className="hint hint-error" style={{ marginTop: '0.5rem' }}>{webhookError}</p>}

        <p className="muted small" style={{ marginTop: '1.25rem' }}><strong>Cách 2 — getUpdates (thử nếu Cách 1 không được)</strong></p>
        <div style={{ marginTop: '0.25rem' }}>
          <UiButton
            variant="secondary"
            onClick={() => void handleGetUpdates()}
            disabled={updatesBusy || !config?.botConfigured}
          >
            {updatesBusy ? 'Đang lấy…' : 'Lấy danh sách nhóm (getUpdates)'}
          </UiButton>
        </div>
        {updatesError && <p className="hint hint-error" style={{ marginTop: '0.5rem' }}>{updatesError}</p>}
        {updatesChats !== null && (
          updatesChats.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.5rem' }}>
              Không tìm thấy nhóm nào. Gửi tin vào nhóm rồi thử lại.
            </p>
          ) : (
            <table className="data-table" style={{ marginTop: '0.75rem' }}>
              <thead>
                <tr><th>Chat ID</th><th>Tên nhóm</th><th>Loại</th></tr>
              </thead>
              <tbody>
                {updatesChats.map((chat) => (
                  <tr key={chat.id}>
                    <td><code>{chat.id}</code></td>
                    <td>{chat.title || '—'}</td>
                    <td>{chat.type || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </section>

      <section className="card" aria-labelledby="zalo-actions-title">
        <h2 id="zalo-actions-title" className="section-title">Hành động</h2>
        <p className="muted small">
          Bot tự động gửi báo cáo biến thể bán chạy vào nhóm Zalo mỗi ngày.
          Dùng các nút dưới để kiểm tra kết nối hoặc gửi thủ công.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <UiButton onClick={() => void handleSendTest()} disabled={testBusy || !canSend}>
            {testBusy ? 'Đang gửi…' : 'Kiểm tra kết nối'}
          </UiButton>
          <UiButton onClick={() => void handleSendReport()} disabled={reportBusy || !canSend}>
            {reportBusy ? 'Đang gửi…' : 'Gửi báo cáo ngay'}
          </UiButton>
        </div>
        {!canSend && !configLoading && (
          <p className="hint" style={{ marginTop: '0.5rem' }}>
            Cấu hình <code>ZALO_BOT_TOKEN</code> và <code>ZALO_CHAT_ID</code> trên server để kích hoạt.
          </p>
        )}
        {actionMessage && <p className="hint hint-ok" style={{ marginTop: '0.75rem' }}>{actionMessage}</p>}
        {actionError && <p className="hint hint-error" style={{ marginTop: '0.75rem' }}>{actionError}</p>}
      </section>

      <section className="card" aria-labelledby="zalo-abnormal-title">
        <h2 id="zalo-abnormal-title" className="section-title">Cảnh báo đơn hàng bất thường</h2>
        <p className="muted small">
          Tự động gửi cảnh báo lên nhóm Zalo khi{' '}
          <strong>giá sau chiết khấu / giá gốc</strong> thấp hơn ngưỡng cấu hình.
          Công thức:{' '}
          <code>Giá gốc − (Giảm SP − Sàn trợ giá) − Phí sàn = Giá sau chiết khấu</code>.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem', maxWidth: '360px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={editEnabled}
              onChange={(e) => setEditEnabled(e.target.checked)}
            />
            <span className="muted small">Bật cảnh báo tự động</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="muted small" style={{ whiteSpace: 'nowrap' }}>Ngưỡng cảnh báo &lt;</span>
            <input
              type="number"
              min={1}
              max={100}
              value={editThreshold}
              onChange={(e) => setEditThreshold(e.target.value)}
              onBlur={() => {
                const n = parseInt(editThreshold, 10);
                setEditThreshold(String(isNaN(n) ? 60 : Math.min(100, Math.max(1, n))));
              }}
              style={{
                width: '72px',
                padding: '0 6px',
                height: '32px',
                border: '1px solid var(--color-border, #444)',
                borderRadius: '4px',
                background: 'var(--bg-page, #1e1e1e)',
                color: 'var(--text-primary, #fff)',
                fontSize: '14px',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <span className="muted small">% giá gốc</span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem', alignItems: 'center' }}>
          <UiButton onClick={() => void handleSaveAbnormalConfig()} disabled={saveBusy} style={{ width: 'auto' }}>
            {saveBusy ? 'Đang lưu…' : 'Lưu cấu hình'}
          </UiButton>
          <UiButton
            variant="secondary"
            onClick={() => void handleSendMockAlert()}
            disabled={mockBusy || !canSend}
          >
            {mockBusy ? 'Đang gửi…' : '⚠️ Gửi cảnh báo mẫu'}
          </UiButton>
        </div>
        <p className="muted small" style={{ marginTop: '0.5rem' }}>
          Đơn mẫu: giá gốc 850.000đ → sau chiết khấu 366.995đ (43.2%) — dùng để xem trước định dạng tin nhắn.
        </p>
        {saveMessage && <p className="hint hint-ok" style={{ marginTop: '0.5rem' }}>{saveMessage}</p>}
        {saveError && <p className="hint hint-error" style={{ marginTop: '0.5rem' }}>{saveError}</p>}
        {mockMessage && <p className="hint hint-ok" style={{ marginTop: '0.5rem' }}>{mockMessage}</p>}
        {mockError && <p className="hint hint-error" style={{ marginTop: '0.5rem' }}>{mockError}</p>}
      </section>

      <section className="card" aria-labelledby="zalo-logs-title">
        <div className="table-head">
          <h2 id="zalo-logs-title" className="section-title">Lịch sử gửi</h2>
          <div className="table-head-actions">
            <UiButton variant="secondary" onClick={() => void loadLogs()} disabled={logsLoading}>
              {logsLoading ? 'Đang tải…' : 'Làm mới'}
            </UiButton>
          </div>
        </div>
        {logs.length === 0 ? (
          <p className="muted">Chưa có lần gửi nào.</p>
        ) : (
          <div className="webhook-events-list">
            {logs.map((log) => (
              <div
                key={log.id}
                style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border, #e0e0e0)' }}
              >
                <p className="muted small" style={{ margin: 0 }}>
                  <strong>{log.sentAt.replace('T', ' ').slice(0, 19)}</strong>
                  {' · '}{KIND_LABEL[log.kind]}
                  {' · '}
                  {log.success
                    ? <span style={{ color: 'var(--color-ok, green)' }}>✓ Thành công</span>
                    : <span style={{ color: 'var(--color-error, red)' }}>✗ Thất bại{log.error ? `: ${log.error}` : ''}</span>}
                  {log.preview && (
                    <span style={{ display: 'block', marginTop: '0.2rem', opacity: 0.7 }}>
                      {log.preview}…
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
