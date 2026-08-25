import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { apiUrl } from '../lib/api';

export type AuthUser = {
  username: string;
  role: 'admin' | 'user';
  department: string;
  gender?: 'male' | 'female';
  token: string;
};

type AuthContextType = {
  user: AuthUser | null;
  authMessage: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  authMessage: null,
  login: async () => {},
  logout: () => {},
});

const STORAGE_KEY = 'meit-auth';

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(apiUrl('/admin/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = (await res.json()) as {
      token?: string;
      username?: string;
      role?: string;
      department?: string;
      gender?: string;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? 'Đăng nhập thất bại.');
    const authUser: AuthUser = {
      username: data.username!,
      role: data.role as AuthUser['role'],
      department: data.department ?? '',
      gender: data.gender === 'male' || data.gender === 'female' ? data.gender : undefined,
      token: data.token!,
    };
    setUser(authUser);
    setAuthMessage(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
  }, []);

  const logout = useCallback((reason?: string) => {
    setUser(null);
    setAuthMessage(reason ?? null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authMessage, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
