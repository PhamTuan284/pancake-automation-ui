import { useMemo, useState } from 'react';
import { TOOLS } from './config/tools';
import { MeitIntegrationsPanel } from './components/integrations/MeitIntegrationsPanel';
import { PancakeEinvoicePanel } from './features/pancake-einvoice/PancakeEinvoicePanel';
import { PancakeWebhookPanel } from './features/pancake-webhook/PancakeWebhookPanel';

export default function App() {
  const [activeToolId, setActiveToolId] = useState('pancake-einvoice');

  const activeTool = useMemo(
    () => TOOLS.find((t) => t.id === activeToolId) ?? TOOLS[0],
    [activeToolId]
  );

  return (
    <div className="page">
      <header className="app-brand" role="banner">
        <div className="app-brand-inner">
          <h1 className="app-brand-title">MeiT Tools</h1>
        </div>
      </header>

      <nav className="tool-nav" aria-label="Chọn công cụ">
        <div className="tool-nav-inner">
          <ul className="tool-nav-list">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                {tool.disabled ? (
                  <span
                    className="tool-nav-item tool-nav-item--soon"
                    title={tool.description}
                  >
                    <span className="tool-nav-label">{tool.label}</span>
                    <span className="tool-nav-soon">Sắp có</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={
                      activeToolId === tool.id
                        ? 'tool-nav-item tool-nav-item--active'
                        : 'tool-nav-item'
                    }
                    aria-current={
                      activeToolId === tool.id ? 'page' : undefined
                    }
                    onClick={() => setActiveToolId(tool.id)}
                  >
                    <span className="tool-nav-label">{tool.label}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="layout">
        {activeToolId === 'pancake-einvoice' && (
          <PancakeEinvoicePanel toolDescription={activeTool.description} />
        )}

        {activeToolId === 'pancake-webhook' && (
          <PancakeWebhookPanel toolDescription={activeTool.description} />
        )}

        {activeToolId === 'opensource-hrm' && (
          <>
            <p className="tool-intro muted">
              {activeTool.description} Mở Horilla sau khi container chạy; lần
              đầu cần khởi tạo DB trong container (compose đã chạy migrate).
            </p>
            <MeitIntegrationsPanel focus="hrm" />
          </>
        )}

        {activeToolId === 'opensource-crm' && (
          <>
            <p className="tool-intro muted">
              {activeTool.description} Đăng nhập admin mặc định theo biến môi
              trường compose (đổi ngay trong{' '}
              <code>compose.integrations.env</code> khi deploy thật).
            </p>
            <MeitIntegrationsPanel focus="crm" />
          </>
        )}
      </div>
    </div>
  );
}
