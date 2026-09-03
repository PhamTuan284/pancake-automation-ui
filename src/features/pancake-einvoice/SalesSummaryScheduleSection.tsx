import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';
import { UiButton } from '../../components/ui';

interface SalesSummaryConfig {
  shopKey: string;
  enabled: boolean;
  sendTime: string;
  lastSentDate: string;
}

export function SalesSummaryScheduleSection() {
  const [config, setConfig] = useState<SalesSummaryConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [sendTime, setSendTime] = useState('09:00');
  const [enabled, setEnabled] = useState(true);

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [sendMsg, setSendMsg] = useState('');

  useEffect(() => {
    setConfigLoading(true);
    fetch(apiUrl('/zalo-bot/sales-summary-config'))
      .then((r) => r.json() as Promise<{ ok?: boolean } & SalesSummaryConfig>)
      .then((data) => {
        if (data.ok) {
          setConfig(data);
          setSendTime(data.sendTime ?? '09:00');
          setEnabled(data.enabled ?? true);
        }
      })
      .catch(() => { /* ignore — start with defaults */ })
      .finally(() => setConfigLoading(false));
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(apiUrl('/zalo-bot/sales-summary-config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, sendTime }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string } & SalesSummaryConfig;
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
      const res = await fetch(apiUrl('/zalo-bot/send-sales-summary'), {
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
    sendTime !== (config.sendTime ?? '09:00') ||
    enabled !== (config.enabled ?? true);

  return (
    <section className="card" aria-labelledby="sales-summary-title">
      <div className="table-head">
        <h2 id="sales-summary-title" className="section-title">
          Tổng hợp bán hàng 5 ngày
        </h2>
      </div>
      <p className="muted small">
        Tự động tổng hợp số lượng &amp; giá bán từng mẫu (theo màu/size) phát sinh trong 5 ngày gần nhất,
        gửi bằng hình ảnh kèm chữ vào nhóm Zalo chính — 5 ngày gửi 1 lần.
      </p>

      <div className="daily-stock-settings">
        <label className="daily-stock-setting-row">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setSaveMsg(''); }}
          />
          <span>Bật gửi tự động mỗi 5 ngày</span>
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
            config?.lastSentDate && (
              <span className="muted small">Đã gửi lần cuối: {config.lastSentDate}</span>
            )
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
          <UiButton onClick={() => void sendNow()} disabled={sending} title="Gửi báo cáo tổng hợp bán hàng ngay bây giờ">
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
    </section>
  );
}
