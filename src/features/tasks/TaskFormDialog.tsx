import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import type { TaskRecord, TaskStatus, TaskUser } from '../../types';
import { DEPARTMENTS } from '../../config/departments';
import { TASK_PRIORITIES, TASK_STATUSES, toDateInput } from './taskConfig';
import type { TaskDraft } from './tasksApi';
import { useIsMobile } from './useIsMobile';

type Props = {
  open: boolean;
  users: TaskUser[];
  /** When set, the dialog edits this task instead of creating a new one. */
  task?: TaskRecord | null;
  /** Pre-select a column when creating from a Kanban "+" button. */
  defaultStatus?: TaskStatus;
  defaultDepartment?: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: TaskDraft) => void;
};

function emptyDraft(status: TaskStatus, department: string): TaskDraft {
  return {
    title: '',
    description: '',
    status,
    priority: 'medium',
    assignees: [],
    department,
    labels: [],
    startDate: '',
    dueDate: '',
    checklist: [],
  };
}

function draftFromTask(task: TaskRecord): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignees: task.assignees,
    department: task.department,
    labels: task.labels,
    startDate: toDateInput(task.startDate),
    dueDate: toDateInput(task.dueDate),
  };
}

export function TaskFormDialog({
  open,
  users,
  task,
  defaultStatus = 'todo',
  defaultDepartment = '',
  saving,
  error,
  onClose,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft(defaultStatus, defaultDepartment));
  const [checklistText, setChecklistText] = useState('');
  const isEdit = Boolean(task);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    setDraft(task ? draftFromTask(task) : emptyDraft(defaultStatus, defaultDepartment));
    setChecklistText('');
  }, [open, task, defaultStatus, defaultDepartment]);

  const set = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const selectedUsers = users.filter((u) => draft.assignees.includes(u.username));
  const canSubmit = draft.title.trim().length > 0 && !saving;

  function submit() {
    if (!canSubmit) return;
    const checklist = isEdit
      ? undefined
      : checklistText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
    onSubmit({ ...draft, title: draft.title.trim(), checklist });
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      className="task-dialog"
    >
      <DialogTitle>{isEdit ? 'Sửa công việc' : 'Giao việc mới'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          label="Tiêu đề công việc"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          autoFocus
          fullWidth
          size="small"
          slotProps={{ htmlInput: { maxLength: 200 } }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
          }}
        />
        <Autocomplete
          multiple
          options={users}
          value={selectedUsers}
          groupBy={(u) => u.department || 'Khác'}
          getOptionLabel={(u) => u.fullName}
          isOptionEqualToValue={(a, b) => a.username === b.username}
          onChange={(_e, value) => set('assignees', value.map((u) => u.username))}
          renderValue={(value, getItemProps) =>
            value.map((u, index) => (
              <Chip {...getItemProps({ index })} key={u.username} label={u.fullName} size="small" />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} label="Người thực hiện" size="small" placeholder="Chọn nhân viên…" />
          )}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField
            select
            label="Mức ưu tiên"
            value={draft.priority}
            onChange={(e) => set('priority', e.target.value)}
            size="small"
          >
            {TASK_PRIORITIES.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Trạng thái"
            value={draft.status}
            onChange={(e) => set('status', e.target.value as TaskStatus)}
            size="small"
          >
            {TASK_STATUSES.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Ngày bắt đầu"
            type="date"
            value={draft.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Hạn hoàn thành"
            type="date"
            value={draft.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            size="small"
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: draft.startDate || undefined } }}
          />
          <TextField
            select
            label="Phòng ban"
            value={draft.department}
            onChange={(e) => set('department', e.target.value)}
            size="small"
          >
            <MenuItem value="">— Không chọn —</MenuItem>
            {DEPARTMENTS.map((d) => (
              <MenuItem key={d} value={d}>
                {d}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            multiple
            freeSolo
            options={[]}
            value={draft.labels}
            onChange={(_e, value) => set('labels', value.map((v) => String(v).trim()).filter(Boolean).slice(0, 10))}
            renderValue={(value, getItemProps) =>
              value.map((label, index) => (
                <Chip {...getItemProps({ index })} key={label} label={label} size="small" variant="outlined" />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} label="Nhãn" size="small" placeholder="Enter để thêm" />
            )}
          />
        </Box>
        <TextField
          label="Mô tả / yêu cầu chi tiết"
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          multiline
          minRows={3}
          maxRows={10}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { maxLength: 5000 } }}
        />
        {!isEdit && (
          <TextField
            label="Checklist (mỗi dòng một mục)"
            value={checklistText}
            onChange={(e) => setChecklistText(e.target.value)}
            multiline
            minRows={2}
            maxRows={8}
            fullWidth
            size="small"
            placeholder={'Chụp ảnh sản phẩm\nViết mô tả\nĐăng lên Pancake'}
          />
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions className="task-dialog-actions">
        <Button onClick={onClose} disabled={saving}>
          Hủy
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={!canSubmit}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {isEdit ? 'Lưu thay đổi' : 'Giao việc'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
