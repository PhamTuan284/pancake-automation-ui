import { useMemo, useState } from 'react';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import IconButton from '@mui/material/IconButton';
import SouthIcon from '@mui/icons-material/South';
import NorthIcon from '@mui/icons-material/North';
import type { TaskRecord, TaskUser } from '../../types';
import {
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  STATUS_LABEL,
  checklistProgress,
  dueLabel,
  dueState,
  formatDate,
} from './taskConfig';
import { Avatar } from './Avatar';
import { TaskCard } from './TaskCard';
import { useIsMobile } from './useIsMobile';

type Props = {
  tasks: TaskRecord[];
  users: TaskUser[];
  onOpen: (task: TaskRecord) => void;
};

type SortKey = 'title' | 'status' | 'priority' | 'dueDate' | 'createdAt' | 'assignees';

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: 'dueDate', label: 'Hạn hoàn thành' },
  { id: 'priority', label: 'Mức ưu tiên' },
  { id: 'status', label: 'Trạng thái' },
  { id: 'createdAt', label: 'Ngày tạo' },
  { id: 'title', label: 'Tiêu đề' },
  { id: 'assignees', label: 'Người thực hiện' },
];

const STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, review: 2, done: 3 };

export function TaskListView({ tasks, users, onOpen }: Props) {
  const isMobile = useIsMobile();
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const nameOf = (username: string) => users.find((u) => u.username === username)?.fullName ?? username;

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':
          cmp = a.title.localeCompare(b.title, 'vi');
          break;
        case 'status':
          cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          break;
        case 'priority':
          cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
          break;
        case 'dueDate':
          // Tasks without a due date sink to the bottom regardless of direction.
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) return 1;
          else if (!b.dueDate) return -1;
          else cmp = a.dueDate.localeCompare(b.dueDate);
          break;
        case 'createdAt':
          cmp = a.createdAt.localeCompare(b.createdAt);
          break;
        case 'assignees':
          cmp = (a.assignees[0] ? nameOf(a.assignees[0]) : '').localeCompare(
            b.assignees[0] ? nameOf(b.assignees[0]) : '',
            'vi'
          );
          break;
      }
      return cmp * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, sortKey, sortDir, users]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const header = (key: SortKey, label: string) => (
    <th>
      <TableSortLabel active={sortKey === key} direction={sortKey === key ? sortDir : 'asc'} onClick={() => toggleSort(key)}>
        {label}
      </TableSortLabel>
    </th>
  );

  if (tasks.length === 0) return <p className="muted small">Không có công việc nào khớp bộ lọc.</p>;

  // Phones: a stacked card list instead of an 8-column table, with a sort picker.
  if (isMobile) {
    return (
      <>
        <div className="task-mobile-sort">
          <TextField
            select
            size="small"
            label="Sắp xếp theo"
            value={sortKey}
            onChange={(e) => {
              setSortKey(e.target.value as SortKey);
              setSortDir('asc');
            }}
            sx={{ flex: 1 }}
          >
            {SORT_OPTIONS.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <IconButton
            onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            aria-label={sortDir === 'asc' ? 'Đang tăng dần, bấm để giảm dần' : 'Đang giảm dần, bấm để tăng dần'}
          >
            {sortDir === 'asc' ? <SouthIcon fontSize="small" /> : <NorthIcon fontSize="small" />}
          </IconButton>
        </div>
        <div className="task-mobile-list">
          {sorted.map((t) => (
            <TaskCard key={t._id} task={t} users={users} draggable={false} showStatus onOpen={onOpen} />
          ))}
        </div>
      </>
    );
  }


  return (
    <div className="table-scroll">
      <table className="data-table task-table">
        <thead>
          <tr>
            {header('title', 'Công việc')}
            {header('assignees', 'Người thực hiện')}
            {header('status', 'Trạng thái')}
            {header('priority', 'Ưu tiên')}
            {header('dueDate', 'Hạn')}
            <th>Checklist</th>
            <th>Người giao</th>
            {header('createdAt', 'Ngày tạo')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const progress = checklistProgress(t);
            return (
              <tr key={t._id} className="task-table-row" onClick={() => onOpen(t)}>
                <td>
                  <div className="task-table-title">{t.title}</div>
                  {t.labels.length > 0 && (
                    <div className="task-card-labels">
                      {t.labels.map((l) => (
                        <span key={l} className="task-label">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <div className="task-assignee-list">
                    {t.assignees.length === 0 && <span className="task-unassigned">Chưa giao</span>}
                    {t.assignees.map((u) => (
                      <span key={u} className="task-assignee-pill">
                        <Avatar username={u} name={nameOf(u)} size={20} />
                        {nameOf(u)}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`task-status task-status--${t.status}`}>{STATUS_LABEL[t.status]}</span>
                </td>
                <td>
                  <span className={`task-priority task-priority--${t.priority}`}>{PRIORITY_LABEL[t.priority]}</span>
                </td>
                <td>
                  <span className={`task-due task-due--${dueState(t)}`}>{dueLabel(t)}</span>
                </td>
                <td>{progress.total > 0 ? `${progress.done}/${progress.total}` : '—'}</td>
                <td>{t.createdByName || t.createdBy}</td>
                <td>{formatDate(t.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
