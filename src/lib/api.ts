/**
 * Dev: `.env.development` → `http://localhost:4001` (CORS on API).
 * Prod: `.env.production` → Railway origin (no trailing `/`).
 * If unset, falls back to `/api` + path (Vite dev proxy → same port as `PANCAKE_API_PORT` in vite.config).
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (!API_ORIGIN) return `/api${p}`;
  return `${API_ORIGIN}${p}`;
}
