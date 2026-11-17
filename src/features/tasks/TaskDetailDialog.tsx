import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import EditIcon from '@mui/icons-material/Edit';
import ArchiveIcon from '@mui/icons-material/ArchiveOutlined';
import UnarchiveIcon from '@mui/icons-material/UnarchiveOutlined';
import CloseIcon from '@mui/icons-material/Close';
import type { TaskRecord, TaskStatus, TaskUser } from '../../types';
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_STATUSES,
  checklistProgress,
  dueLabel,
  dueState,
  formatDate,
  formatDateTime,
} from './taskConfig';
import type { TasksApi } from './tasksApi';
import { Avatar } from './Avatar';
import { useIsMobile } from './useIsMobile';

type Props = {
  open: boolean;
  taskId: string | null;
  api: TasksApi;
  users: TaskUser[];
  currentUsername: string;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (task: TaskRecord) => void;
  /** Called after any change so the board behind the dialog can refresh. */
  onChanged: () => void;
};

const ACTIVITY_LABEL: Record<string, string> = {
  create: 'đã tạo công việc',
  update: 'đã cập nhật',
  status: 'đã chuyển trạng thái',
  comment: 'đã bình luận',
  archive: 'đã lưu trữ',
  unarchive: 'đã bỏ lưu trữ',
};

export function TaskDetailDialog({
  open,
  taskId,
  api,
  users,
  currentUsername,
  isAdmin,
  onClose,
  onEdit,
  onChanged,
}: Props) {
  const [task, setTask] = useState<TaskRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [showActivity, setShowActivity] = useState(false);
  const isMobile = useIsMobile();

  const nameOf = (username: string) => users.find((u) => u.username === username)?.fullName ?? username;

  useEffect(() => {
    if (!open || !taskId) {
      setTask(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get(taskId)
      .then((data) => {
        if (!cancelled && data) setTask(data.task);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không thể tải công việc.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, taskId, api]);

  async function run(action: () => Promise<{ task: TaskRecord } | null>, notify = true) {
    setBusy(true);
    setError(null);
    try {
      const data = await action();
      if (data) setTask(data.task);
      if (notify) onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const canManage = Boolean(task && (isAdmin || task.createdBy === currentUsername));
  const canWork = Boolean(task && (canManage || task.assignees.includes(currentUsername)));
  const progress = task ? checklistProgress(task) : { done: 0, total: 0 };
  const due = task ? dueState(task) : 'none';

  async function handleDelete() {
    if (!task) return;
    if (!window.confirm(`Xóa công việc "${task.title}"? Thao tác này không thể hoàn tác.`)) return;
    setBusy(true);
    try {
      await api.remove(task._id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể xóa công việc.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
      className="task-dialog task-detail-dialog"
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, pr: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {task ? (
            <>
              <Typography variant="h6" component="div" sx={{ lineHeight: 1.3, wordBreak: 'break-word' }}>
                {task.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Giao bởi {task.createdByName || task.createdBy} · {formatDateTime(task.createdAt)}
              </Typography>
            </>
          ) : (
            'Chi tiết công việc'
          )}
        </Box>
        {task && canManage && (
          <>
            <Tooltip title="Sửa">
              <span>
                <IconButton size="small" onClick={() => onEdit(task)} disabled={busy}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={task.archived ? 'Bỏ lưu trữ' : 'Lưu trữ'}>
              <span>
                <IconButton
                  size="small"
                  disabled={busy}
                  onClick={() => void run(() => api.archive(task._id, !task.archived))}
                >
                  {task.archived ? <UnarchiveIcon fontSize="small" /> : <ArchiveIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Xóa">
              <span>
                <IconButton size="small" color="error" onClick={() => void handleDelete()} disabled={busy}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
        <IconButton size="small" onClick={onClose} disabled={busy} aria-label="Đóng">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}

        {task && (
          <>
            {task.archived && <Alert severity="info">Công việc này đã được lưu trữ.</Alert>}

            <div className="task-detail-meta">
              <div className="task-detail-meta-item">
                <span className="task-detail-meta-label">Trạng thái</span>
                <TextField
                  select
                  size="small"
                  value={task.status}
                  disabled={!canWork || busy}
                  onChange={(e) => void run(() => api.move(task._id, e.target.value as TaskStatus))}
                  sx={{ minWidth: 160 }}
                >
                  {TASK_STATUSES.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.label}
                    </MenuItem>
                  ))}
                </TextField>
              </div>
              <div className="task-detail-meta-item">
                <span className="task-detail-meta-label">Ưu tiên</span>
                <span className={`task-priority task-priority--${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
              </div>
              <div className="task-detail-meta-item">
                <span className="task-detail-meta-label">Hạn</span>
                <span className={`task-due task-due--${due}`}>{dueLabel(task)}</span>
              </div>
              {task.startDate && (
                <div className="task-detail-meta-item">
                  <span className="task-detail-meta-label">Bắt đầu</span>
                  <span>{formatDate(task.startDate)}</span>
                </div>
              )}
              {task.completedAt && (
                <div className="task-detail-meta-item">
                  <span className="task-detail-meta-label">Hoàn thành lúc</span>
                  <span>{formatDateTime(task.completedAt)}</span>
                </div>
              )}
              {task.department && (
                <div className="task-detail-meta-item">
                  <span className="task-detail-meta-label">Phòng ban</span>
                  <span>{task.department}</span>
                </div>
              )}
            </div>

            <div className="task-detail-meta-item">
              <span className="task-detail-meta-label">Người thực hiện</span>
              <div className="task-assignee-list">
                {task.assignees.length === 0 && <span className="muted small">Chưa giao cho ai</span>}
                {task.assignees.map((u) => (
                  <span key={u} className="task-assignee-pill">
                    <Avatar username={u} name={nameOf(u)} size={22} />
                    {nameOf(u)}
                  </span>
                ))}
              </div>
            </div>

            {task.labels.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {task.labels.map((l) => (
                  <Chip key={l} label={l} size="small" variant="outlined" />
                ))}
              </Box>
            )}

            <section>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Mô tả
              </Typography>
              {task.description ? (
                <p className="task-description">{task.description}</p>
              ) : (
                <p className="muted small">Không có mô tả.</p>
              )}
            </section>

            <Divider />

            <section>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="subtitle2">
                  Checklist {progress.total > 0 && `· ${progress.done}/${progress.total}`}
                </Typography>
              </Box>
              {progress.total > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={(progress.done / progress.total) * 100}
                  sx={{ mb: 1, borderRadius: 1 }}
                />
              )}
              <ul className="task-checklist">
                {task.checklist.map((item) => (
                  <li key={item._id} className={item.done ? 'is-done' : ''}>
                    <Checkbox
                      size="small"
                      checked={item.done}
                      disabled={!canWork || busy}
                      onChange={(e) =>
                        void run(() => api.updateChecklistItem(task._id, item._id, { done: e.target.checked }), false)
                      }
                    />
                    <span className="task-checklist-text">{item.text}</span>
                    {canWork && (
                      <IconButton
                        size="small"
                        aria-label="Xóa mục"
                        disabled={busy}
                        onClick={() => void run(() => api.updateChecklistItem(task._id, item._id, { remove: true }), false)}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
              {canWork && (
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="Thêm mục cần làm…"
                    value={checklistText}
                    disabled={busy}
                    onChange={(e) => setChecklistText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && checklistText.trim()) {
                        e.preventDefault();
                        const text = checklistText.trim();
                        setChecklistText('');
                        void run(() => api.addChecklistItem(task._id, text), false);
                      }
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    disabled={busy || !checklistText.trim()}
                    onClick={() => {
                      const text = checklistText.trim();
                      setChecklistText('');
                      void run(() => api.addChecklistItem(task._id, text), false);
                    }}
                  >
                    Thêm
                  </Button>
                </Box>
              )}
            </section>

            <Divider />

            <section>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Bình luận {task.comments && task.comments.length > 0 && `· ${task.comments.length}`}
              </Typography>
              <div className="task-comments">
                {(task.comments ?? []).length === 0 && <p className="muted small">Chưa có bình luận.</p>}
                {(task.comments ?? []).map((c) => (
                  <div key={c._id} className="task-comment">
                    <Avatar username={c.username} name={c.authorName || nameOf(c.username)} size={28} />
                    <div className="task-comment-body">
                      <div className="task-comment-head">
                        <strong>{c.authorName || nameOf(c.username)}</strong>
                        <span className="muted small">{formatDateTime(c.createdAt)}</span>
                        {(isAdmin || c.username === currentUsername) && (
                          <IconButton
                            size="small"
                            aria-label="Xóa bình luận"
                            disabled={busy}
                            onClick={() => void run(() => api.deleteComment(task._id, c._id), false)}
                          >
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        )}
                      </div>
                      <p>{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'flex-start' }}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  maxRows={5}
                  placeholder="Viết bình luận… (Ctrl+Enter để gửi)"
                  value={commentText}
                  disabled={busy}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commentText.trim()) {
                      e.preventDefault();
                      const text = commentText.trim();
                      setCommentText('');
                      void run(() => api.addComment(task._id, text), false);
                    }
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={busy || !commentText.trim()}
                  onClick={() => {
                    const text = commentText.trim();
                    setCommentText('');
                    void run(() => api.addComment(task._id, text), false);
                  }}
                >
                  Gửi
                </Button>
              </Box>
            </section>

            {task.activity && task.activity.length > 0 && (
              <>
                <Divider />
                <section>
                  <Button size="small" onClick={() => setShowActivity((v) => !v)} sx={{ px: 0 }}>
                    {showActivity ? 'Ẩn lịch sử' : `Xem lịch sử (${task.activity.length})`}
                  </Button>
                  {showActivity && (
                    <ul className="task-activity">
                      {[...task.activity].reverse().map((a, i) => (
                        <li key={`${a.at}-${i}`}>
                          <span className="muted small">{formatDateTime(a.at)}</span>{' '}
                          <strong>{nameOf(a.username)}</strong> {ACTIVITY_LABEL[a.action] ?? a.action}
                          {a.detail && <span className="muted"> — {a.detail}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions className="task-dialog-actions">
        {task && task.status !== 'done' && canWork && (
          <Button
            variant="outlined"
            color="success"
            disabled={busy}
            onClick={() => void run(() => api.move(task._id, task.status === 'review' || canManage ? 'done' : 'review'))}
          >
            {task.status === 'review' || canManage ? `Đánh dấu ${STATUS_LABEL.done}` : `Gửi ${STATUS_LABEL.review}`}
          </Button>
        )}
        <Button onClick={onClose} disabled={busy}>
          Đóng
        </Button>
      </DialogActions>
    </Dialog>
  );
}
