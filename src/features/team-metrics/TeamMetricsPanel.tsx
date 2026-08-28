import { useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { OfficeAttendancePanel } from './OfficeAttendancePanel';
import { LiveAttendancePanel } from './LiveAttendancePanel';

const SUB_TABS = [
  { id: 'office', label: 'Team Office' },
  { id: 'live', label: 'Team Live' },
] as const;

type SubTabId = (typeof SUB_TABS)[number]['id'];

export function TeamMetricsPanel() {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('office');

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

      {activeSubTab === 'office' && <OfficeAttendancePanel />}
      {activeSubTab === 'live' && <LiveAttendancePanel />}
    </Box>
  );
}
