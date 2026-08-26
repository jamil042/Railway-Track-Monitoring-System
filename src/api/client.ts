import axios from 'axios';

const AUTH_KEY = 'rfd_auth';

// sessionStorage: browser tab bondho/reopen korlei abar LOGIN lagbe —
// start_system.sh chalu korar por URL e dhuklei shudhu login page dekhabe.
export function getStoredAuth(): { token: string; user: unknown } | null {
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeAuth(auth: { token: string; user: unknown }): void {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth(): void {
  sessionStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(AUTH_KEY); // purano localStorage session o invalid
}

const API_URL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const auth = getStoredAuth();
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

export default api;