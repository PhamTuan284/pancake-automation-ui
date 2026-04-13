import type { IntegrationServiceInfo } from '../../types';

export function IntegrationServiceCard({
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
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void copyUrl()}
        >
          Sao chép URL
        </button>
      </div>
    </article>
  );
}
