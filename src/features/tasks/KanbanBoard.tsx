import { useState, type DragEvent } from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import type { TaskRecord, TaskStatus, TaskUser } from '../../types';
import { TASK_STATUSES } from './taskConfig';
import { TaskCard } from './TaskCard';
import { useIsMobile } from './useIsMobile';

type Props = {
  tasks: TaskRecord[];
  users: TaskUser[];
  currentUsername: string;
  isAdmin: boolean;
  onOpen: (task: TaskRecord) => void;
  onCreate: (status: TaskStatus) => void;
  /** Called with the full new ordering of the destination column. */
  onMove: (taskId: string, to: TaskStatus, orderedIds: string[]) => void;
};

type DropTarget = { status: TaskStatus; index: number } | null;
type MenuState = { task: TaskRecord; anchor: HTMLElement } | null;

function canDrag(task: TaskRecord, username: string, isAdmin: boolean): boolean {
  return isAdmin || task.createdBy === username || task.assignees.includes(username);
}

/**
 * Four-column board (Trello-style). Desktop uses native HTML5 drag and drop;
 * phones show one column at a time with a tab strip, and every card has a
 * "move" menu so status changes and reordering work without dragging.
 */
export function KanbanBoard({ tasks, users, currentUsername, isAdmin, onOpen, onCreate, onMove }: Props) {
  const isMobile = useIsMobile();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [mobileColumn, setMobileColumn] = useState<TaskStatus>('todo');

  const byStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));

  // ---- drag and drop (desktop) ----

  function handleDragStart(e: DragEvent<HTMLDivElement>, task: TaskRecord) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task._id);
    setDraggingId(task._id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
  }

  /** Work out where in the column the pointer is, so the placeholder sits between the right cards. */
  function computeIndex(e: DragEvent<HTMLDivElement>): number {
    const cards = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('.task-card:not(.is-dragging)'));
    for (let i = 0; i < cards.length; i += 1) {
      const rect = cards[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, status: TaskStatus) {
    if (!draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const index = computeIndex(e);
    if (!dropTarget || dropTarget.status !== status || dropTarget.index !== index) {
      setDropTarget({ status, index });
    }
  }

  function moveTo(id: string, status: TaskStatus, index: number) {
    const dragged = tasks.find((t) => t._id === id);
    if (!dragged) return;
    const before = byStatus(status).map((t) => t._id);
    const orderedIds = before.filter((x) => x !== id);
    orderedIds.splice(Math.max(0, Math.min(index, orderedIds.length)), 0, id);
    // No-op when it ends up exactly where it already was.
    if (dragged.status === status && before.join() === orderedIds.join()) return;
    onMove(id, status, orderedIds);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, status: TaskStatus) {
    e.preventDefault();
    const id = draggingId ?? e.dataTransfer.getData('text/plain');
    const index = dropTarget?.status === status ? dropTarget.index : computeIndex(e);
    handleDragEnd();
    if (id) moveTo(id, status, index);
  }

  // ---- move menu (touch + keyboard) ----

  function menuMove(action: 'top' | 'up' | 'down' | TaskStatus) {
    if (!menu) return;
    const { task } = menu;
    setMenu(null);
    const column = byStatus(task.status).map((t) => t._id);
    const index = column.indexOf(task._id);
    if (action === 'top') moveTo(task._id, task.status, 0);
    else if (action === 'up') moveTo(task._id, task.status, index - 1);
    else if (action === 'down') moveTo(task._id, task.status, index + 1);
    else {
      moveTo(task._id, action, Number.MAX_SAFE_INTEGER);
      if (isMobile) setMobileColumn(action);
    }
  }

  const menuColumn = menu ? byStatus(menu.task.status).map((t) => t._id) : [];
  const menuIndex = menu ? menuColumn.indexOf(menu.task._id) : -1;

  const visibleColumns = isMobile ? TASK_STATUSES.filter((c) => c.id === mobileColumn) : TASK_STATUSES;

  return (
    <>
      {isMobile && (
        <div className="kanban-mobile-tabs" role="tablist" aria-label="Chọn cột">
          {TASK_STATUSES.map((col) => (
            <button
              key={col.id}
              type="button"
              role="tab"
              aria-selected={mobileColumn === col.id}
              className={`kanban-mobile-tab kanban-column--${col.id} ${mobileColumn === col.id ? 'is-active' : ''}`}
              onClick={() => setMobileColumn(col.id)}
            >
              <span className="kanban-column-dot" />
              <span className="kanban-mobile-tab-label">{col.label}</span>
              <span className="kanban-column-count">{byStatus(col.id).length}</span>
            </button>
          ))}
        </div>
      )}

      <div className={`kanban ${isMobile ? 'kanban--mobile' : ''}`}>
        {visibleColumns.map((col) => {
          const items = byStatus(col.id);
          const isOver = dropTarget?.status === col.id;
          return (
            <section
              key={col.id}
              className={`kanban-column kanban-column--${col.id} ${isOver ? 'is-over' : ''}`}
              aria-label={col.label}
            >
              <header className="kanban-column-head">
                <span className="kanban-column-dot" />
                <h3 className="kanban-column-title">{col.label}</h3>
                <span className="kanban-column-count">{items.length}</span>
                <Tooltip title={`Giao việc vào "${col.label}"`}>
                  <IconButton size="small" onClick={() => onCreate(col.id)} aria-label={`Thêm vào ${col.label}`}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </header>
              <p className="kanban-column-hint muted small">{col.hint}</p>
              <div
                className="kanban-column-body"
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
                }}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {items.map((task, index) => (
                  <div key={task._id} className="kanban-slot">
                    {isOver && dropTarget.index === index && draggingId !== task._id && (
                      <div className="kanban-placeholder" />
                    )}
                    <TaskCard
                      task={task}
                      users={users}
                      draggable={canDrag(task, currentUsername, isAdmin)}
                      isDragging={draggingId === task._id}
                      onOpen={onOpen}
                      onDragStart={isMobile ? undefined : handleDragStart}
                      onDragEnd={handleDragEnd}
                      onMoveMenu={(t, anchor) => setMenu({ task: t, anchor })}
                    />
                  </div>
                ))}
                {isOver && dropTarget.index >= items.length && <div className="kanban-placeholder" />}
                {items.length === 0 && !isOver && (
                  <div className="kanban-empty muted small">
                    {isMobile ? 'Chưa có công việc nào trong cột này' : 'Kéo thẻ vào đây'}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <Menu
        anchorEl={menu?.anchor ?? null}
        open={menu !== null}
        onClose={() => setMenu(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled dense>
          <ListItemText primary="Chuyển sang cột" />
        </MenuItem>
        {TASK_STATUSES.filter((s) => s.id !== menu?.task.status).map((s) => (
          <MenuItem key={s.id} onClick={() => menuMove(s.id)}>
            <ListItemIcon>
              <ArrowForwardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={s.label} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => menuMove('top')} disabled={menuIndex <= 0}>
          <ListItemIcon>
            <VerticalAlignTopIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Lên đầu cột" />
        </MenuItem>
        <MenuItem onClick={() => menuMove('up')} disabled={menuIndex <= 0}>
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Lên trên" />
        </MenuItem>
        <MenuItem onClick={() => menuMove('down')} disabled={menuIndex < 0 || menuIndex >= menuColumn.length - 1}>
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Xuống dưới" />
        </MenuItem>
      </Menu>
    </>
  );
}
