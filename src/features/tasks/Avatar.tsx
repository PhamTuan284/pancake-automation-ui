import Tooltip from '@mui/material/Tooltip';
import { avatarColor, initials } from './taskConfig';

type Props = { username: string; name: string; size?: number };

/** Coloured initials bubble, Trello/Asana-style, used for assignees and comment authors. */
export function Avatar({ username, name, size = 24 }: Props) {
  return (
    <Tooltip title={name}>
      <span
        className="task-avatar"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: avatarColor(username) }}
        aria-label={name}
      >
        {initials(name)}
      </span>
    </Tooltip>
  );
}
