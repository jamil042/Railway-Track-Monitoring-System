import api from './client';
import type {
  AlertLog,
  DashboardStats,
  Device,
  Fault,
  MaintenanceTask,
  Notification,
  SensorReading,
  Station,
  Track,
  User,
} from '../types';

const unwrap = <T>(p: Promise<{ data: T }>): Promise<T> => p.then(r => r.data);

// ---- Auth ----
export const authApi = {
  login: (role: string, username: string | null, stationId: string | null, password: string) =>
    unwrap(api.post<{ token: string; user: User }>('/auth/login', { role, username, stationId, password })),
  me: () => unwrap(api.get<{ user: User }>('/auth/me')).then(r => r.user),
  updateProfile: (data: { name?: string; email?: string }) =>
    unwrap(api.put<{ token: string; user: User }>('/auth/profile', data)),
  changePassword: (currentPassword: string, newPassword: string) =>
    unwrap(api.put<{ ok: boolean }>('/auth/password', { currentPassword, newPassword })),
};

// ---- Stations ----
export const stationsApi = {
  list: () => unwrap(api.get<Station[]>('/stations')),
  create: (data: Partial<Station>) => unwrap(api.post<Station>('/stations', data)),
  update: (id: string, data: Partial<Station>) => unwrap(api.put<Station>(`/stations/${id}`, data)),
  remove: (id: string) => unwrap(api.delete<void>(`/stations/${id}`)),
};

// ---- Tracks ----
export const tracksApi = {
  list: () => unwrap(api.get<Track[]>('/tracks')),
  create: (data: Partial<Track>) => unwrap(api.post<Track>('/tracks', data)),
  update: (id: string, data: Partial<Track>) => unwrap(api.put<Track>(`/tracks/${id}`, data)),
  remove: (id: string) => unwrap(api.delete<void>(`/tracks/${id}`)),
};

// ---- Faults ----
export const faultsApi = {
  list: (params?: { status?: string; severity?: string; stationId?: string; search?: string }) =>
    unwrap(api.get<Fault[]>('/faults', { params })),
  get: (id: string) => unwrap(api.get<Fault>(`/faults/${id}`)),
  create: (data: Partial<Fault>) => unwrap(api.post<Fault>('/faults', data)),
  update: (id: string, data: Partial<Fault>) => unwrap(api.put<Fault>(`/faults/${id}`, data)),
  remove: (id: string) => unwrap(api.delete<void>(`/faults/${id}`)),
};

// ---- Maintenance ----
export const maintenanceApi = {
  list: () => unwrap(api.get<MaintenanceTask[]>('/maintenance')),
  create: (data: Partial<MaintenanceTask>) => unwrap(api.post<MaintenanceTask>('/maintenance', data)),
  update: (id: string, data: Partial<MaintenanceTask>) => unwrap(api.put<MaintenanceTask>(`/maintenance/${id}`, data)),
  remove: (id: string) => unwrap(api.delete<void>(`/maintenance/${id}`)),
};

// ---- Notifications ----
export const notificationsApi = {
  list: () => unwrap(api.get<Notification[]>('/notifications')),
  create: (data: Partial<Notification>) => unwrap(api.post<Notification>('/notifications', data)),
  markRead: (id: string) => unwrap(api.put<Notification>(`/notifications/${id}/read`)),
  remove: (id: string) => unwrap(api.delete<void>(`/notifications/${id}`)),
};

// ---- Dashboard ----
export const dashboardApi = {
  stats: () => unwrap(api.get<DashboardStats>('/dashboard/stats')),
  faultTrend: () => unwrap(api.get<{ date: string; faults: number; fixed: number }[]>('/dashboard/fault-trend')),
  faultByType: () => unwrap(api.get<{ name: string; value: number }[]>('/dashboard/fault-by-type')),
  monthlyStats: () =>
    unwrap(api.get<{ month: string; faults: number; fixed: number; maintenance: number }[]>('/dashboard/monthly-stats')),
  faultByStation: () => unwrap(api.get<{ name: string; faults: number }[]>('/dashboard/fault-by-station')),
};

// ---- Devices / Telemetry / Alerts ----
export const devicesApi = {
  list: () => unwrap(api.get<Device[]>('/devices')),
  create: (data: Partial<Device>) => unwrap(api.post<Device>('/devices', data)),
  update: (id: number, data: Partial<Device>) => unwrap(api.put<Device>(`/devices/${id}`, data)),
  remove: (id: number) => unwrap(api.delete<void>(`/devices/${id}`)),
};

export const sensorReadingsApi = {
  list: (params?: { deviceId?: number; trackId?: string; sensorType?: string; limit?: number }) =>
    unwrap(api.get<SensorReading[]>('/sensor-readings', { params })),
  create: (data: Partial<SensorReading>) => unwrap(api.post<SensorReading>('/sensor-readings', data)),
};

export const alertsApi = {
  list: () => unwrap(api.get<AlertLog[]>('/alerts')),
  create: (data: Partial<AlertLog>) => unwrap(api.post<AlertLog>('/alerts', data)),
  acknowledge: (id: number) => unwrap(api.put<AlertLog>(`/alerts/${id}/acknowledge`)),
};