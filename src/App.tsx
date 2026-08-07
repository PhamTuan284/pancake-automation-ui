import { useEffect, useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { TOOLS } from './config/tools';
import { INVOICE_SHOPS } from './config/invoiceShops';
import { PancakeEinvoicePanel } from './features/pancake-einvoice/PancakeEinvoicePanel';
import { PancakeWebhookPanel } from './features/pancake-webhook/PancakeWebhookPanel';
import { SalaryPanel } from './features/salary/SalaryPanel';
import { LeavePanel } from './features/leave/LeavePanel';
import { TelegramBotPanel } from './features/telegram-bot/TelegramBotPanel';
import { ZaloBotPanel } from './features/zalo-bot/ZaloBotPanel';
import { AdminPanel } from './features/admin/AdminPanel';
import { AdminStorefrontPanel } from './features/admin-storefront/AdminStorefrontPanel';
import type { TabAccessLevel } from './features/admin/TabVisibilitySettings';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiUrl } from './lib/api';

const TOOL_QUERY_PARAM = 'tool';
const ADMIN_TOOL_ID = 'admin';

type AdminSettings = {
  tabAccess: Record<string, TabAccessLevel>;
  botEnabled: { telegram: boolean; zalo: boolean };
};

const DEFAULT_SETTINGS: AdminSettings = {
  tabAccess: {},
  botEnabled: { telegram: true, zalo: true },
};

const ROLE_LEVEL: Record<string, number> = { guest: 0, user: 1, admin: 2 };

function canAccessTab(toolId: string, userRole: string, tabAccess: Record<string, TabAccessLevel>): boolean {
  if (toolId === ADMIN_TOOL_ID) return true;
  const required = tabAccess[toolId] ?? 'guest';
  return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[required] ?? 0);
}

function readToolIdFromUrl(enabledIds: Set<string>): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get(TOOL_QUERY_PARAM);
  if (!raw) return null;
  return enabledIds.has(raw) ? raw : null;
}

function urlWithToolQuery(toolId: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set(TOOL_QUERY_PARAM, toolId);
  const qs = url.searchParams.toString();
  return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`;
}

function AppInner() {
  const { user } = useAuth();
  const userRole = user?.role ?? 'guest';

  const [adminSettings, setAdminSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    fetch(apiUrl('/admin/settings'))
      .then((r) => r.json())
      .then((data: AdminSettings) => setAdminSettings(data))
      .catch(() => {});
  }, []);

  function handleSettingsChanged(updated: Partial<AdminSettings>) {
    setAdminSettings((prev) => ({ ...prev, ...updated }));
  }

  const visibleTools = useMemo(
    () => TOOLS.filter((t) => canAccessTab(t.id, userRole, adminSettings.tabAccess)),
    [userRole, adminSettings.tabAccess]
  );

  const enabledToolIds = useMemo(
    () => new Set(visibleTools.filter((t) => !t.disabled).map((t) => t.id)),
    [visibleTools]
  );

  const defaultToolId =
    visibleTools.find((t) => !t.disabled && t.id !== ADMIN_TOOL_ID)?.id ??
    visibleTools[0]?.id ??
    '';

  const [activeToolId, setActiveToolId] = useState(
    () => readToolIdFromUrl(enabledToolIds) ?? defaultToolId
  );

  const activeTool = useMemo(
    () => visibleTools.find((t) => t.id === activeToolId) ?? visibleTools[0],
    [activeToolId, visibleTools]
  );

  useEffect(() => {
    const onPopState = () => {
      setActiveToolId(readToolIdFromUrl(enabledToolIds) ?? defaultToolId);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabledToolIds, defaultToolId]);

  useEffect(() => {
    const selectedFromUrl = readToolIdFromUrl(enabledToolIds);
    if (selectedFromUrl === activeToolId || typeof window === 'undefined') return;
    window.history.pushState({}, '', urlWithToolQuery(activeToolId));
  }, [activeToolId, enabledToolIds]);

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
            {visibleTools.map((tool) => (
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
        {INVOICE_SHOPS.map((shop) =>
          activeToolId === shop.toolId ? (
            <PancakeEinvoicePanel
              key={shop.toolId}
              shopKey={shop.shopKey}
              shopLabel={shop.label}
              defaultPancakeShopId={shop.defaultPancakeShopId}
              toolDescription={activeTool?.description ?? ''}
            />
          ) : null
        )}

        {activeToolId === 'pancake-webhook' && (
          <PancakeWebhookPanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === 'salary-calc' && (
          <SalaryPanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === 'leave' && (
          <LeavePanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === 'telegram-bot' && (
          <TelegramBotPanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === 'zalo-bot' && (
          <ZaloBotPanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === 'admin-storefront' && (
          <AdminStorefrontPanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === ADMIN_TOOL_ID && (
          <AdminPanel settings={adminSettings} onSettingsChanged={handleSettingsChanged} />
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
