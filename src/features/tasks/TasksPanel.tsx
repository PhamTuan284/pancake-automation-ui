import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import ViewListIcon from '@mui/icons-material/ViewList';
import GroupIcon from '@mui/icons-material/Group';
import FilterListIcon from '@mui/icons-material/FilterList';
import IconButton from '@mui/material/IconButton';
import Fab from '@mui/material/Fab';
import Badge from '@mui/material/Badge';
import type { TaskRecord, TaskStats, TaskStatus, TaskUser, TaskWorkloadRow } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { DEPARTMENTS } from '../../config/departments';
import { createTasksApi, type TaskDraft, type TaskFilters } from './tasksApi';
import { TASK_PRIORITIES, TASK_STATUSES } from './taskConfig';
import { KanbanBoard } from './KanbanBoard';
import { TaskListView } from './TaskListView';
import { WorkloadView } from './WorkloadView';
import { TaskFormDialog } from './TaskFormDialog';
import { TaskDetailDialog } from './TaskDetailDialog';
import { useIsMobile } from './useIsMobile';

type ViewMode = 'board' | 'list' | 'workload';
type Scope = TaskFilters['scope'];

const SCOPE_TABS: { id: Scope; label: string }[] = [
  { id: 'all', label: 'Tất cả' },
  { id: 'mine', label: 'Việc của tôi' },
  { id: 'created', label: 'Tôi đã giao' },
];

const EMPTY_STATS: TaskStats = {
  counts: { todo: 0, in_progress: 0, review: 0, done: 0 },
  overdue: 0,
  dueToday: 0,
  doneThisWeek: 0,
  total: 0,
};

export function TasksPanel({ toolDescription }: { toolDescription: string }) {
  const { user, logout } = useAuth();
  const token = user?.token ?? '';
  const username = user?.username ?? '';
  const isAdmin = user?.role === 'admin';
  const api = useMemo(() => createTasksApi(token, logout), [token, logout]);
  const isMobile = useIsMobile();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [view, setView] = useState<ViewMode>('board');
  const [scope, setScope] = useState<Scope>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [department, setDepartment] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [showArchived, setShowArchived] = useState(false);

  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [users, setUsers] = useState<TaskUser[]>([]);
  const [stats, setStats] = useState<TaskStats>(EMPTY_STATS);
  const [workload, setWorkload] = useState<TaskWorkloadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formTask, setFormTask] = useState<TaskRecord | null>(null);
  const [formStatus, setFormStatus] = useState<TaskStatus>('todo');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const filters: TaskFilters = useMemo(
    () => ({ scope, status, assignee, department, priority, q: debouncedSearch, archived: showArchived }),
    [scope, status, assignee, department, priority, debouncedSearch, showArchived]
  );

  const latestRequest = useRef(0);
  const loadTasks = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const [listData, statsData] = await Promise.all([api.list(filters), api.stats(scope === 'mine' ? 'mine' : 'all')]);
      if (requestId !== latestRequest.current) return;
      if (listData) setTasks(listData.tasks);
      if (statsData) setStats(statsData.stats);
      setError(null);
    } catch (err) {
      if (requestId === latestRequest.current) setError(err instanceof Error ? err.message : 'Không thể tải công việc.');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [api, filters, scope]);

  const loadWorkload = useCallback(async () => {
    try {
      const data = await api.workload();
      if (data) setWorkload(data.workload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải khối lượng công việc.');
    }
  }, [api]);

  useEffect(() => {
    api
      .users()
      .then((data) => {
        if (data) setUsers(data.users);
      })
      .catch(() => {});
  }, [api]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (view === 'workload') void loadWorkload();
  }, [view, loadWorkload]);

  const refresh = useCallback(() => {
    void loadTasks();
    if (view === 'workload') void loadWorkload();
  }, [loadTasks, loadWorkload, view]);

  function openCreate(statusForNew: TaskStatus = 'todo') {
    setFormTask(null);
    setFormStatus(statusForNew);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(task: TaskRecord) {
    setFormTask(task);
    setFormError(null);
    setFormOpen(true);
  }

  async function submitForm(draft: TaskDraft) {
    setFormSaving(true);
    setFormError(null);
    try {
      if (formTask) {
        const { checklist: _ignored, ...patch } = draft;
        void _ignored;
        const data = await api.update(formTask._id, patch);
        if (!data) return;
        setToast('Đã cập nhật công việc.');
      } else {
        const data = await api.create(draft);
        if (!data) return;
        setToast(draft.assignees.length > 0 ? 'Đã giao việc và gửi thông báo.' : 'Đã tạo công việc.');
      }
      setFormOpen(false);
      refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể lưu công việc.');
    } finally {
      setFormSaving(false);
    }
  }

  /** Optimistic drag-and-drop: update the board immediately, then persist; reload on failure. */
  async function handleMove(taskId: string, to: TaskStatus, orderedIds: string[]) {
    const orderOf = new Map(orderedIds.map((id, i) => [id, i + 1]));
    setTasks((prev) =>
      prev.map((t) => {
        if (t._id === taskId) return { ...t, status: to, order: orderOf.get(t._id) ?? t.order };
        if (orderOf.has(t._id)) return { ...t, order: orderOf.get(t._id)! };
        return t;
      })
    );
    try {
      const moved = await api.move(taskId, to);
      if (!moved) return;
      await api.reorder(to, orderedIds);
      const statsData = await api.stats(scope === 'mine' ? 'mine' : 'all');
      if (statsData) setStats(statsData.stats);
      if (moved.task.status === 'done') setToast('Đã hoàn thành công việc.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể di chuyển công việc.');
      void loadTasks();
    }
  }

  const hasFilters = Boolean(search || assignee || department || priority || status || showArchived);
  const activeFilterCount = [assignee, department, priority, status, showArchived].filter(Boolean).length;

  function clearFilters() {
    setSearch('');
    setAssignee('');
    setDepartment('');
    setPriority('');
    setStatus('');
    setShowArchived(false);
  }

  const statTiles: { label: string; value: number; tone?: 'danger' | 'warn' | 'ok' | 'info'; onClick?: () => void }[] = [
    { label: 'Tổng việc đang mở', value: stats.total - stats.counts.done, tone: 'info' },
    { label: 'Đang làm', value: stats.counts.in_progress, onClick: () => setStatus('in_progress') },
    { label: 'Chờ duyệt', value: stats.counts.review, tone: 'warn', onClick: () => setStatus('review') },
    { label: 'Quá hạn', value: stats.overdue, tone: stats.overdue > 0 ? 'danger' : undefined },
    { label: 'Hạn hôm nay', value: stats.dueToday, tone: stats.dueToday > 0 ? 'warn' : undefined },
    { label: 'Xong 7 ngày qua', value: stats.doneThisWeek, tone: 'ok' },
  ];

  return (
    <>
      <p className="tool-intro muted">{toolDescription}</p>

      <div className="task-stats">
        {statTiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className={`task-stat ${tile.tone ? `task-stat--${tile.tone}` : ''} ${tile.onClick ? 'is-clickable' : ''}`}
            onClick={tile.onClick}
            disabled={!tile.onClick}
          >
            <span className="task-stat-value">{tile.value}</span>
            <span className="task-stat-label">{tile.label}</span>
          </button>
        ))}
      </div>

      <section className="card task-panel">
        <div className="task-toolbar">
          <Tabs
            value={scope}
            onChange={(_e, next: Scope) => setScope(next)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ minHeight: 40 }}
          >
            {SCOPE_TABS.map((t) => (
              <Tab key={t.id} value={t.id} label={t.label} sx={{ minHeight: 40 }} />
            ))}
          </Tabs>
          <div className="task-toolbar-actions">
            <ToggleButtonGroup
              size="small"
              exclusive
              value={view}
              onChange={(_e, next: ViewMode | null) => {
                if (next) setView(next);
              }}
              aria-label="Chế độ xem"
            >
              <ToggleButton value="board" aria-label="Bảng Kanban">
                <ViewKanbanIcon fontSize="small" />
                <span className="task-view-label">Bảng</span>
              </ToggleButton>
              <ToggleButton value="list" aria-label="Danh sách">
                <ViewListIcon fontSize="small" />
                <span className="task-view-label">Danh sách</span>
              </ToggleButton>
              <ToggleButton value="workload" aria-label="Nhân sự">
                <GroupIcon fontSize="small" />
                <span className="task-view-label">Nhân sự</span>
              </ToggleButton>
            </ToggleButtonGroup>
            {isMobile ? (
              <>
                <IconButton onClick={refresh} disabled={loading} aria-label="Tải lại">
                  <RefreshIcon fontSize="small" />
                </IconButton>
                {view !== 'workload' && (
                  <IconButton
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-label="Bộ lọc"
                    aria-expanded={filtersOpen}
                    color={filtersOpen || activeFilterCount > 0 ? 'primary' : 'default'}
                  >
                    <Badge badgeContent={activeFilterCount} color="primary">
                      <FilterListIcon fontSize="small" />
                    </Badge>
                  </IconButton>
                )}
              </>
            ) : (
              <>
                <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={refresh} disabled={loading}>
                  Tải lại
                </Button>
                <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => openCreate('todo')}>
                  Giao việc
                </Button>
              </>
            )}
          </div>
        </div>

        {view !== 'workload' && (
          <div className="task-filters">
            <TextField
              size="small"
              placeholder="Tìm theo tiêu đề, mô tả, nhãn…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: '1 1 220px' }}
            />
            {(!isMobile || filtersOpen) && (
            <>
            <TextField
              select
              size="small"
              label="Người thực hiện"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {users.map((u) => (
                <MenuItem key={u.username} value={u.username}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Phòng ban"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {DEPARTMENTS.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              size="small"
              label="Ưu tiên"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">Tất cả</MenuItem>
              {TASK_PRIORITIES.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            {view === 'list' && (
              <TextField
                select
                size="small"
                label="Trạng thái"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus | '')}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="">Tất cả</MenuItem>
                {TASK_STATUSES.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <FormControlLabel
              control={<Switch size="small" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />}
              label="Đã lưu trữ"
              sx={{ ml: 0, mr: 0, whiteSpace: 'nowrap' }}
            />
            {hasFilters && (
              <Button size="small" onClick={clearFilters}>
                Xóa lọc
              </Button>
            )}
            </>
            )}
          </div>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {view === 'board' && (
          <KanbanBoard
            tasks={status ? tasks.filter((t) => t.status === status) : tasks}
            users={users}
            currentUsername={username}
            isAdmin={isAdmin}
            onOpen={(t) => setDetailId(t._id)}
            onCreate={openCreate}
            onMove={handleMove}
          />
        )}
        {view === 'list' && <TaskListView tasks={tasks} users={users} onOpen={(t) => setDetailId(t._id)} />}
        {view === 'workload' && (
          <WorkloadView
            rows={workload}
            loading={loading}
            onPick={(u) => {
              setAssignee(u);
              setView('board');
            }}
          />
        )}
        {loading && tasks.length === 0 && view !== 'workload' && <p className="muted">Đang tải…</p>}
      </section>

      <TaskFormDialog
        open={formOpen}
        users={users}
        task={formTask}
        defaultStatus={formStatus}
        defaultDepartment={user?.department ?? ''}
        saving={formSaving}
        error={formError}
        onClose={() => {
          if (!formSaving) setFormOpen(false);
        }}
        onSubmit={(draft) => void submitForm(draft)}
      />

      <TaskDetailDialog
        open={detailId !== null}
        taskId={detailId}
        api={api}
        users={users}
        currentUsername={username}
        isAdmin={isAdmin}
        onClose={() => setDetailId(null)}
        onEdit={(task) => {
          setDetailId(null);
          openEdit(task);
        }}
        onChanged={refresh}
      />

      {isMobile && !formOpen && detailId === null && (
        <Fab color="primary" variant="extended" className="task-fab" onClick={() => openCreate('todo')}>
          <AddIcon sx={{ mr: 0.5 }} />
          Giao việc
        </Fab>
      )}

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={isMobile ? { bottom: 88 } : undefined}
      />
    </>
  );
}
