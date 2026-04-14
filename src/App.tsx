import { useEffect, useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { TOOLS } from './config/tools';
import { PancakeEinvoicePanel } from './features/pancake-einvoice/PancakeEinvoicePanel';
import { PancakeWebhookPanel } from './features/pancake-webhook/PancakeWebhookPanel';
import { SalaryPanel } from './features/salary/SalaryPanel';

const TOOL_QUERY_PARAM = 'tool';
const DEFAULT_TOOL_ID =
  TOOLS.find((t) => !t.disabled)?.id ?? TOOLS[0]?.id ?? '';
const ENABLED_TOOL_IDS = new Set(
  TOOLS.filter((t) => !t.disabled).map((t) => t.id)
);

function readToolIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get(TOOL_QUERY_PARAM);
  if (!raw) return null;
  return ENABLED_TOOL_IDS.has(raw) ? raw : null;
}

function urlWithToolQuery(toolId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set(TOOL_QUERY_PARAM, toolId);
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
}

export default function App() {
  const [activeToolId, setActiveToolId] = useState(
    () => readToolIdFromUrl() ?? DEFAULT_TOOL_ID
  );

  const activeTool = useMemo(
    () => TOOLS.find((t) => t.id === activeToolId) ?? TOOLS[0],
    [activeToolId]
  );

  useEffect(() => {
    const onPopState = () => {
      setActiveToolId(readToolIdFromUrl() ?? DEFAULT_TOOL_ID);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    const selectedFromUrl = readToolIdFromUrl();
    if (selectedFromUrl === activeToolId || typeof window === 'undefined') {
      return;
    }
    window.history.pushState({}, '', urlWithToolQuery(activeToolId));
  }, [activeToolId]);

  return (
    <div className="page">
      <AppBar position="static" className="app-navbar" elevation={0}>
        <Toolbar className="app-navbar-toolbar">
          <Typography
            variant="h5"
            component="h1"
            className="app-navbar-title"
            sx={{ width: '100%', textAlign: 'center' }}
          >
            MeiT Tools
          </Typography>
        </Toolbar>
        <Box className="app-navbar-tabs-wrap">
          <Tabs
            value={activeToolId}
            onChange={(_event, nextId: string) => setActiveToolId(nextId)}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="Chọn công cụ"
            className="app-navbar-tabs"
          >
            {TOOLS.map((tool) => (
              <Tab
                key={tool.id}
                value={tool.id}
                disabled={tool.disabled}
                label={tool.disabled ? `${tool.label} (Sắp có)` : tool.label}
              />
            ))}
          </Tabs>
        </Box>
      </AppBar>

      <div className="layout">
        {activeToolId === 'pancake-einvoice' && (
          <PancakeEinvoicePanel toolDescription={activeTool.description} />
        )}

        {activeToolId === 'pancake-webhook' && (
          <PancakeWebhookPanel toolDescription={activeTool.description} />
        )}

        {activeToolId === 'salary-calc' && (
          <SalaryPanel toolDescription={activeTool.description} />
        )}
      </div>
    </div>
  );
}
