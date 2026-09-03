import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { PancakeWebhookPanel } from '../pancake-webhook/PancakeWebhookPanel';
import { ZaloBotPanel } from '../zalo-bot/ZaloBotPanel';
import { FacebookPanel } from './FacebookPanel';
import { DrivePanel } from './DrivePanel';

const SUB_TABS = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'drive', label: 'Google Drive' },
  { id: 'pancake-webhook', label: 'Pancake Webhook' },
  { id: 'zalo-bot', label: 'Zalo Bot' },
] as const;

type SubTabId = (typeof SUB_TABS)[number]['id'];

export function IntegrationsPanel() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('facebook');

  return (
    <Box>
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

      {activeSubTab === 'facebook' && <FacebookPanel />}
      {activeSubTab === 'drive' && <DrivePanel />}
      {activeSubTab === 'pancake-webhook' && (
        <PancakeWebhookPanel toolDescription="Nhận dữ liệu orders / khách / kho từ Pancake qua Webhook Open API." />
      )}
      {activeSubTab === 'zalo-bot' && (
        <ZaloBotPanel toolDescription="Gửi báo cáo doanh thu, tồn kho và cảnh báo đơn hàng bất thường vào nhóm Zalo tự động mỗi ngày." />
      )}
    </Box>
  );
}
