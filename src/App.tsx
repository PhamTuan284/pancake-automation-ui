import { useEffect, useMemo, useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { TOOLS } from './config/tools';
import { INVOICE_SHOPS } from './config/invoiceShops';
import { PancakeEinvoicePanel } from './features/pancake-einvoice/PancakeEinvoicePanel';
import { LeavePanel } from './features/leave/LeavePanel';
import { AdminPanel } from './features/admin/AdminPanel';
import { AdminStorefrontPanel } from './features/admin-storefront/AdminStorefrontPanel';
import { IntegrationsPanel } from './features/integrations/IntegrationsPanel';
import { TeamMetricsPanel } from './features/team-metrics/TeamMetricsPanel';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordDialog } from './components/ChangePasswordDialog';
import { AuthProvider, useAuth } from './context/AuthContext';
import { apiUrl } from './lib/api';

const TOOL_QUERY_PARAM = 'tool';
const ADMIN_TOOL_ID = 'admin';

type AdminSettings = {
  tabAccess: Record<string, string[]>;
  botEnabled: { zalo: boolean };
  officeWorkHours: { checkIn: string; checkOut: string; graceMinutes: number };
  liveMinSessionMinutes: number;
};

const DEFAULT_SETTINGS: AdminSettings = {
  tabAccess: {},
  botEnabled: { zalo: true },
  officeWorkHours: { checkIn: '08:30', checkOut: '17:30', graceMinutes: 15 },
  liveMinSessionMinutes: 90,
};

/**
 * Every tool requires login. The `admin` tab is admin-role only; every other
 * tab is admin-configurable per department (via TabVisibilitySettings) —
 * `'*'` in the allow-list means any logged-in user, an empty/missing list
 * means admin-only. `role: 'admin'` users always bypass this check.
 */
function canAccessTab(
  toolId: string,
  role: 'admin' | 'user',
  department: string,
  tabAccess: Record<string, string[]>
): boolean {
  if (toolId === ADMIN_TOOL_ID) return role === 'admin';
  if (role === 'admin') return true;
  const allowed = tabAccess[toolId] ?? [];
  return allowed.includes('*') || allowed.includes(department);
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
  const { user, logout } = useAuth();
  const userRole = user?.role ?? 'user';
  const userDepartment = user?.department ?? '';
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

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
    () => (user ? TOOLS.filter((t) => canAccessTab(t.id, userRole, userDepartment, adminSettings.tabAccess)) : []),
    [user, userRole, userDepartment, adminSettings.tabAccess]
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

  // Resync when the current tab becomes invalid — e.g. right after login
  // (activeToolId was initialized while logged out, so defaultToolId was
  // still ''), after logout, or when permissions change.
  useEffect(() => {
    if (activeToolId && enabledToolIds.has(activeToolId)) return;
    setActiveToolId(readToolIdFromUrl(enabledToolIds) ?? defaultToolId);
  }, [activeToolId, enabledToolIds, defaultToolId]);

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

  if (!user) {
    return (
      <div className="page">
        <LoginScreen />
      </div>
    );
  }

  return (
    <div className="page">
      <AppBar position="static" className="app-navbar" elevation={0}>
        <Toolbar
          className="app-navbar-toolbar"
          sx={{ flexWrap: 'wrap', rowGap: 1, py: 1 }}
        >
          <Typography
            variant="h5"
            component="h1"
            className="app-navbar-title"
            sx={{ flex: 1, textAlign: 'center', minWidth: 0 }}
          >
            MeiT Tools
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              gap: 1,
              flex: { xs: '1 1 100%', sm: '0 0 auto' },
            }}
          >
            <Chip
              label={user.fullName || user.username}
              size="small"
              color={user.role === 'admin' ? 'primary' : 'default'}
              sx={{ maxWidth: { xs: 140, sm: 220 }, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
            />
            <Button size="small" variant="outlined" color="inherit" onClick={() => setPasswordDialogOpen(true)}>
              Đổi mật khẩu
            </Button>
            <Button size="small" variant="outlined" color="inherit" onClick={() => logout()}>
              Đăng xuất
            </Button>
          </Box>
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

        {activeToolId === 'leave' && (
          <LeavePanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === 'admin-storefront' && (
          <AdminStorefrontPanel toolDescription={activeTool?.description ?? ''} />
        )}

        {activeToolId === 'integrations' && <IntegrationsPanel />}

        {activeToolId === 'team-metrics' && <TeamMetricsPanel />}

        {activeToolId === ADMIN_TOOL_ID && (
          <AdminPanel settings={adminSettings} onSettingsChanged={handleSettingsChanged} />
        )}
      </div>

      <ChangePasswordDialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} />
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
