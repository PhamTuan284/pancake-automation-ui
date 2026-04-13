import { useCallback, useEffect, useState } from 'react';
import type { IntegrationsBundle } from '../../types';
import { apiUrl } from '../../lib/api';
import { IntegrationServiceCard } from './IntegrationServiceCard';

export function MeitIntegrationsPanel({ focus }: { focus: 'hrm' | 'crm' }) {
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
          <code>
            {bundle?.envFileExample ?? 'compose.integrations.env.example'}
          </code>{' '}
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
