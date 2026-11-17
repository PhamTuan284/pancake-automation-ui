import type { DragEvent, MouseEvent } from 'react';
import IconButton from '@mui/material/IconButton';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import type { TaskRecord, TaskUser } from '../../types';
import { PRIORITY_LABEL, STATUS_LABEL, checklistProgress, dueLabel, dueState } from './taskConfig';
import { Avatar } from './Avatar';

type Props = {
  task: TaskRecord;
  users: TaskUser[];
  draggable: boolean;
  isDragging?: boolean;
  /** Show the status pill (used in the mobile list where there are no columns). */
  showStatus?: boolean;
  onOpen: (task: TaskRecord) => void;
  onDragStart?: (e: DragEvent<HTMLDivElement>, task: TaskRecord) => void;
  onDragEnd?: () => void;
  /**
   * Opens the "move" menu. This is the touch-friendly alternative to drag and
   * drop, since HTML5 drag events never fire on phones.
   */
  onMoveMenu?: (task: TaskRecord, anchor: HTMLElement) => void;
};

export function TaskCard({
  task,
  users,
  draggable,
  isDragging = false,
  showStatus = false,
  onOpen,
  onDragStart,
  onDragEnd,
  onMoveMenu,
}: Props) {
  const progress = checklistProgress(task);
  const due = dueState(task);
  const nameOf = (username: string) => users.find((u) => u.username === username)?.fullName ?? username;

  function openMenu(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onMoveMenu?.(task, e.currentTarget);
  }

  return (
    <div
      className={`task-card task-card--${task.priority} ${isDragging ? 'is-dragging' : ''} ${draggable && onDragStart ? 'is-draggable' : ''}`}
      draggable={draggable && Boolean(onDragStart)}
      onDragStart={(e) => onDragStart?.(e, task)}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task);
        }
      }}
      data-task-id={task._id}
    >
      <div className="task-card-top">
        <div className="task-card-top-main">
          {task.labels.length > 0 && (
            <div className="task-card-labels">
              {task.labels.map((l) => (
                <span key={l} className="task-label">
                  {l}
                </span>
              ))}
            </div>
          )}
          <div className="task-card-title">{task.title}</div>
        </div>
        {draggable && onMoveMenu && (
          <IconButton
            size="small"
            className="task-card-move"
            aria-label={`Di chuyển "${task.title}"`}
            onClick={openMenu}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <SwapVertIcon fontSize="small" />
          </IconButton>
        )}
      </div>
      <div className="task-card-meta">
        {showStatus && <span className={`task-status task-status--${task.status}`}>{STATUS_LABEL[task.status]}</span>}
        <span className={`task-priority task-priority--${task.priority}`}>{PRIORITY_LABEL[task.priority]}</span>
        {task.dueDate && <span className={`task-due task-due--${due}`}>{dueLabel(task)}</span>}
        {progress.total > 0 && (
          <span className={`task-checklist-badge ${progress.done === progress.total ? 'is-complete' : ''}`}>
            ☑ {progress.done}/{progress.total}
          </span>
        )}
      </div>
      <div className="task-card-footer">
        <span className="muted small task-card-creator">{task.createdByName || task.createdBy}</span>
        <div className="task-card-assignees">
          {task.assignees.length === 0 && <span className="task-unassigned">Chưa giao</span>}
          {task.assignees.slice(0, 4).map((u) => (
            <Avatar key={u} username={u} name={nameOf(u)} />
          ))}
          {task.assignees.length > 4 && <span className="task-avatar task-avatar--more">+{task.assignees.length - 4}</span>}
        </div>
      </div>
    </div>
  );
}
