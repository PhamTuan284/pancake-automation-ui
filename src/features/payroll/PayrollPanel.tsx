import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '../../context/AuthContext';
import { createPayrollApi } from './payrollApi';
import type { PayrollMeta } from './payrollTypes';
import { PeriodTab } from './PeriodTab';
import { EmployeesTab } from './EmployeesTab';
import { ExcelSyncTab } from './ExcelSyncTab';
import { SettingsTab } from './SettingsTab';

const SUB_TABS = [
  { id: 'period', label: 'Bảng lương' },
  { id: 'employees', label: 'Nhân viên & công thức' },
  { id: 'excel', label: 'Đồng bộ Excel' },
  { id: 'settings', label: 'Cài đặt' },
] as const;

type SubTabId = (typeof SUB_TABS)[number]['id'];

export function PayrollPanel({ toolDescription }: { toolDescription: string }) {
  const { user, logout } = useAuth();
  const api = useMemo(() => createPayrollApi(user?.token ?? '', logout), [user?.token, logout]);
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('period');
  const [meta, setMeta] = useState<PayrollMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Bumped after an Excel import so the period tab reloads fresh data.
  const [periodKey, setPeriodKey] = useState(0);

  const onError = useCallback((msg: string) => setError(msg), []);
  const onNotice = useCallback((msg: string) => setNotice(msg), []);

  useEffect(() => {
    api
      .meta()
      .then((data) => data && setMeta(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Không thể tải cấu hình lương.'));
  }, [api]);

  // Mirrors the server's requirePayrollAccess: admins and the Accountant department.
  if (user?.role !== 'admin' && user?.department !== 'Accountant') {
    return <Alert severity="warning">Chỉ admin hoặc kế toán được xem bảng lương.</Alert>;
  }

  return (
    <Box>
      <p className="tool-intro muted">{toolDescription}</p>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs
          value={activeSubTab}
          onChange={(_e, next: SubTabId) => setActiveSubTab(next)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          {SUB_TABS.map((tab) => (
            <Tab key={tab.id} value={tab.id} label={tab.label} />
          ))}
        </Tabs>
      </Box>

      {!meta && !error && <CircularProgress sx={{ m: 2 }} size={28} />}

      {meta && activeSubTab === 'period' && <PeriodTab key={periodKey} api={api} onError={onError} />}
      {meta && activeSubTab === 'employees' && <EmployeesTab api={api} meta={meta} onError={onError} onNotice={onNotice} />}
      {meta && activeSubTab === 'excel' && (
        <ExcelSyncTab
          api={api}
          onError={onError}
          onNotice={(msg) => {
            onNotice(msg);
            setPeriodKey((k) => k + 1);
          }}
        />
      )}
      {meta && activeSubTab === 'settings' && (
        <SettingsTab
          api={api}
          settings={meta.settings}
          onSaved={(settings) => setMeta((m) => (m ? { ...m, settings } : m))}
          onError={onError}
          onNotice={onNotice}
        />
      )}

      <Snackbar open={Boolean(error)} autoHideDuration={8000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)} variant="filled">
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice(null)}>
        <Alert severity="success" onClose={() => setNotice(null)} variant="filled">
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
