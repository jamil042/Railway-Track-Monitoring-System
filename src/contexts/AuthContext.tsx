import { createContext, useContext, useState, type ReactNode } from 'react';
import type { User } from '../types';
import { authApi } from '../api';
import { clearAuth, getStoredAuth, storeAuth } from '../api/client';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (getStoredAuth()?.user as User | undefined) ?? null);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const { token, user } = await authApi.login(username, password);
      storeAuth({ token, user });
      setUser(user);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}