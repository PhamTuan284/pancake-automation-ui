import { apiUrl } from './api';

export const SESSION_EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';

/**
 * fetch() wrapper for authenticated endpoints: attaches the Bearer token and,
 * on a 401 (expired/invalid token), calls `logout` so the app bounces back to
 * the login screen instead of silently failing the request. Returns `null`
 * on 401 — callers should just `return` in that case.
 */
export async function authFetch(
  path: string,
  token: string,
  logout: (reason?: string) => void,
  init: RequestInit = {}
): Promise<Response | null> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    logout(SESSION_EXPIRED_MESSAGE);
    return null;
  }
  return res;
}
