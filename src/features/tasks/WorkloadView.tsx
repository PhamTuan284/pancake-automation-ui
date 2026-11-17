import type { TaskWorkloadRow } from '../../types';
import { Avatar } from './Avatar';
import { useIsMobile } from './useIsMobile';

type Props = {
  rows: TaskWorkloadRow[];
  loading: boolean;
  onPick: (username: string) => void;
};

/** Asana-style workload table: who is carrying how much, and who is behind. */
export function WorkloadView({ rows, loading, onPick }: Props) {
  const isMobile = useIsMobile();
  if (loading && rows.length === 0) return <p className="muted">Đang tải…</p>;
  if (rows.length === 0) return <p className="muted small">Chưa có nhân viên nào.</p>;
  const maxOpen = Math.max(1, ...rows.map((r) => r.open));

  if (isMobile) {
    return (
      <div className="task-mobile-list">
        {rows.map((r) => (
          <button key={r.username} type="button" className="task-workload-card" onClick={() => onPick(r.username)}>
            <div className="task-workload-card-head">
              <Avatar username={r.username} name={r.fullName} size={28} />
              <div className="task-workload-card-name">
                <strong>{r.fullName}</strong>
                <span className="muted small">{r.department || '—'}</span>
              </div>
              <span className="task-workload-card-open">{r.open} việc</span>
            </div>
            <div className="task-workload-bar">
              <div
                className={`task-workload-fill ${r.overdue > 0 ? 'has-overdue' : ''}`}
                style={{ width: `${Math.round((r.open / maxOpen) * 100)}%` }}
              />
            </div>
            <div className="task-card-meta">
              <span className="task-status task-status--in_progress">Đang làm {r.inProgress}</span>
              <span className="task-status task-status--review">Chờ duyệt {r.review}</span>
              {r.overdue > 0 && <span className="task-due task-due--overdue">Quá hạn {r.overdue}</span>}
              <span className="task-status task-status--done">Xong {r.done}</span>
            </div>
          </button>
        ))}
      </div>
    );
  }


  return (
    <div className="table-scroll">
      <table className="data-table task-table">
        <thead>
          <tr>
            <th>Nhân viên</th>
            <th>Phòng ban</th>
            <th>Đang mở</th>
            <th>Đang làm</th>
            <th>Chờ duyệt</th>
            <th>Quá hạn</th>
            <th>Hoàn thành</th>
            <th style={{ minWidth: 160 }}>Tải công việc</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.username} className="task-table-row" onClick={() => onPick(r.username)}>
              <td>
                <span className="task-assignee-pill">
                  <Avatar username={r.username} name={r.fullName} size={22} />
                  {r.fullName}
                </span>
              </td>
              <td>{r.department || '—'}</td>
              <td>{r.open}</td>
              <td>{r.inProgress}</td>
              <td>{r.review}</td>
              <td>{r.overdue > 0 ? <span className="task-due task-due--overdue">{r.overdue}</span> : 0}</td>
              <td>{r.done}</td>
              <td>
                <div className="task-workload-bar">
                  <div
                    className={`task-workload-fill ${r.overdue > 0 ? 'has-overdue' : ''}`}
                    style={{ width: `${Math.round((r.open / maxOpen) * 100)}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
