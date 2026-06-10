import { useCallback, useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { UiButton } from '../../components/ui';

type TelegramConfig = {
  botConfigured: boolean;
  chatId: string | null;
  reportHour: number;
  shopKey: string;
  windowDays: number;
  topLimit: number;
};

type TelegramLog = {
  id: string;
  sentAt: string;
  kind: 'test' | 'report' | 'scheduled';
  success: boolean;
  error?: string;
  chatId: string;
  preview: string;
};

const KIND_LABEL: Record<TelegramLog['kind'], string> = {
  test: 'Test',
  report: 'Báo cáo',
  scheduled: 'Tự động',
};

export function TelegramBotPanel({ toolDescription }: { toolDescription: string }) {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [configError, setConfigError] = useState('');
  const [configLoading, setConfigLoading] = useState(false);

  const [logs, setLogs] = useState<TelegramLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [testBusy, setTestBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError('');
    try {
      const res = await fetch(apiUrl('/telegram-bot/config'));
      const data = (await res.json().catch(() => ({}))) as Partial<TelegramConfig & { error?: string }>;
      if (!res.ok) throw new Error(data.error ?? 'Không tải được cấu hình');
      setConfig(data as TelegramConfig);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Lỗi tải cấu hình.');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch(apiUrl('/telegram-bot/logs'));
      const data = (await res.json().catch(() => ({}))) as { logs?: TelegramLog[] };
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadLogs();
  }, [loadConfig, loadLogs]);

  async function handleSendTest() {
    setTestBusy(true);
    setActionMessage('');
    setActionError('');
    try {
      const res = await fetch(apiUrl('/telegram-bot/send-test'), { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gửi thất bại');
      setActionMessage('Đã gửi tin nhắn test thành công lên Telegram!');
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
      const res = await fetch(apiUrl('/telegram-bot/send-report'), { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Gửi báo cáo thất bại');
      setActionMessage('Đã gửi báo cáo biến thể bán chạy lên Telegram!');
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gửi báo cáo thất bại.');
    } finally {
      setReportBusy(false);
      void loadLogs();
    }
  }

  return (
    <>
      <p className="tool-intro muted">{toolDescription}</p>

      <section className="card" aria-labelledby="tg-config-title">
        <h2 id="tg-config-title" className="section-title">Cấu hình Bot</h2>
        <p className="muted small">
          Thiết lập các biến môi trường sau trên server để kích hoạt bot:
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>Biến môi trường</th>
              <th>Mô tả</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>TELEGRAM_BOT_TOKEN</code></td><td>Token từ @BotFather (bắt buộc)</td></tr>
            <tr><td><code>TELEGRAM_CHAT_ID</code></td><td>Chat ID / Channel ID nhận báo cáo (bắt buộc)</td></tr>
            <tr><td><code>TELEGRAM_REPORT_HOUR</code></td><td>Giờ gửi tự động theo giờ VN, mặc định <code>8</code></td></tr>
            <tr><td><code>TELEGRAM_REPORT_SHOP</code></td><td>Shop Pancake: <code>meit</code> hoặc <code>dpa</code>, mặc định <code>meit</code></td></tr>
            <tr><td><code>TELEGRAM_REPORT_DAYS</code></td><td>Số ngày phân tích, mặc định <code>7</code></td></tr>
            <tr><td><code>TELEGRAM_REPORT_LIMIT</code></td><td>Số dòng biến thể tối đa, mặc định <code>15</code></td></tr>
          </tbody>
        </table>

        {configLoading && <p className="muted">Đang tải…</p>}
        {configError && <p className="hint hint-error">{configError}</p>}
        {config && (
          <div style={{ marginTop: '1rem' }}>
            <p className="muted small">
              <strong>Trạng thái hiện tại:</strong>
            </p>
            <ul className="muted small" style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
              <li>
                Bot Token:{' '}
                {config.botConfigured ? (
                  <strong style={{ color: 'var(--color-ok, green)' }}>✓ Đã cấu hình</strong>
                ) : (
                  <strong style={{ color: 'var(--color-error, red)' }}>✗ Chưa có (TELEGRAM_BOT_TOKEN)</strong>
                )}
              </li>
              <li>
                Chat ID:{' '}
                {config.chatId ? (
                  <strong style={{ color: 'var(--color-ok, green)' }}>{config.chatId}</strong>
                ) : (
                  <strong style={{ color: 'var(--color-error, red)' }}>✗ Chưa có (TELEGRAM_CHAT_ID)</strong>
                )}
              </li>
              <li>Gửi tự động lúc <strong>{config.reportHour}:00</strong> (giờ VN) mỗi ngày</li>
              <li>Shop: <code>{config.shopKey}</code> · {config.windowDays} ngày · top {config.topLimit} biến thể</li>
            </ul>
          </div>
        )}
      </section>

      <section className="card" aria-labelledby="tg-actions-title">
        <h2 id="tg-actions-title" className="section-title">Hành động</h2>
        <p className="muted small">
          Bot sẽ tự động gửi báo cáo biến thể bán chạy mỗi ngày (lấy dữ liệu từ Pancake Webhook).
          Dùng các nút dưới để kiểm tra hoặc gửi thủ công.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <UiButton
            onClick={() => void handleSendTest()}
            disabled={testBusy || !config?.botConfigured || !config?.chatId}
          >
            {testBusy ? 'Đang gửi…' : 'Kiểm tra kết nối'}
          </UiButton>
          <UiButton
            onClick={() => void handleSendReport()}
            disabled={reportBusy || !config?.botConfigured || !config?.chatId}
          >
            {reportBusy ? 'Đang gửi…' : 'Gửi báo cáo ngay'}
          </UiButton>
        </div>
        {(!config?.botConfigured || !config?.chatId) && !configLoading && (
          <p className="hint" style={{ marginTop: '0.5rem' }}>
            Cấu hình <code>TELEGRAM_BOT_TOKEN</code> và <code>TELEGRAM_CHAT_ID</code> trên server để kích hoạt.
          </p>
        )}
        {actionMessage && <p className="hint hint-ok" style={{ marginTop: '0.75rem' }}>{actionMessage}</p>}
        {actionError && <p className="hint hint-error" style={{ marginTop: '0.75rem' }}>{actionError}</p>}
      </section>

      <section className="card" aria-labelledby="tg-logs-title">
        <div className="table-head">
          <h2 id="tg-logs-title" className="section-title">Lịch sử gửi</h2>
          <div className="table-head-actions">
            <UiButton
              variant="secondary"
              onClick={() => void loadLogs()}
              disabled={logsLoading}
            >
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
                className="webhook-event-card"
                style={{
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid var(--color-border, #e0e0e0)',
                }}
              >
                <p className="muted small" style={{ margin: 0 }}>
                  <strong>{log.sentAt.replace('T', ' ').slice(0, 19)}</strong>
                  {' · '}
                  {KIND_LABEL[log.kind]}
                  {' · '}
                  {log.success ? (
                    <span style={{ color: 'var(--color-ok, green)' }}>✓ Thành công</span>
                  ) : (
                    <span style={{ color: 'var(--color-error, red)' }}>✗ Thất bại{log.error ? `: ${log.error}` : ''}</span>
                  )}
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
