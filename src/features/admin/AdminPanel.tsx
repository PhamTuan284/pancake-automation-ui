import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../../context/AuthContext';
import { TabVisibilitySettings } from './TabVisibilitySettings';
import { BotSettings } from './BotSettings';
import { WorkHoursSettings } from './WorkHoursSettings';
import { UserManagement } from './UserManagement';
import { ActivityLog } from './ActivityLog';

type AdminSettings = {
  tabAccess: Record<string, string[]>;
  botEnabled: { zalo: boolean };
  officeWorkHours: { checkIn: string; checkOut: string; graceMinutes: number };
  liveMinSessionMinutes: number;
};

type Props = {
  settings: AdminSettings;
  onSettingsChanged: (updated: Partial<AdminSettings>) => void;
};

export function AdminPanel({ settings, onSettingsChanged }: Props) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  if (!user) return null;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h5">Cài đặt Admin</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip label={user.username} color={user.role === 'admin' ? 'primary' : 'default'} size="small" />
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={() => logout()}
          >
            Đăng xuất
          </Button>
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      <Tabs
        value={activeTab}
        onChange={(_e, v: number) => setActiveTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 3 }}
      >
        <Tab label="Hiển thị tab" />
        <Tab label="Bật/Tắt Bot" />
        <Tab label="Giờ làm chuẩn" />
        {user.role === 'admin' && <Tab label="Người dùng" />}
        {user.role === 'admin' && <Tab label="Nhật ký hoạt động" />}
      </Tabs>

      {activeTab === 0 && (
        <TabVisibilitySettings
          token={user.token}
          tabAccess={settings.tabAccess}
          onSaved={(updated) => onSettingsChanged({ tabAccess: updated })}
        />
      )}
      {activeTab === 1 && (
        <BotSettings
          token={user.token}
          botEnabled={settings.botEnabled}
          onSaved={(updated) => onSettingsChanged({ botEnabled: updated })}
        />
      )}
      {activeTab === 2 && (
        <WorkHoursSettings
          token={user.token}
          officeWorkHours={settings.officeWorkHours}
          liveMinSessionMinutes={settings.liveMinSessionMinutes}
          onSaved={(updated) => onSettingsChanged(updated)}
        />
      )}
      {activeTab === 3 && user.role === 'admin' && (
        <UserManagement token={user.token} currentUsername={user.username} />
      )}
      {activeTab === 4 && user.role === 'admin' && (
        <ActivityLog token={user.token} />
      )}
    </Box>
  );
}
