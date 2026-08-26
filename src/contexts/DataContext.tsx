import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  alertsApi,
  dashboardApi,
  devicesApi,
  faultsApi,
  maintenanceApi,
  notificationsApi,
  sensorReadingsApi,
  stationsApi,
  tracksApi,
} from '../api';
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
} from '../types';

export interface FaultTypeDatum {
  name: string;
  value: number;
  color: string;
}

export interface TrendDatum {
  date: string;
  faults: number;
  fixed: number;
}

export interface MonthlyDatum {
  month: string;
  faults: number;
  fixed: number;
  maintenance: number;
}

export interface StationFaultDatum {
  name: string;
  faults: number;
}

interface DataContextValue {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  stats: DashboardStats;
  faultTrend: TrendDatum[];
  faultTypeData: FaultTypeDatum[];
  monthlyStats: MonthlyDatum[];
  stationFaultData: StationFaultDatum[];
  stations: Station[];
  tracks: Track[];
  faults: Fault[];
  tasks: MaintenanceTask[];
  notifications: Notification[];
  devices: Device[];
  readings: SensorReading[];
  alerts: AlertLog[];
  updateTask: (id: string, data: Partial<MaintenanceTask>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const TYPE_COLORS = ['#DC2626', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#6B7280'];

const LIVE_POLL_INTERVAL_MS = 1500;

const shortName = (full: string) => full.split(' ')[0];

const EMPTY_STATS: DashboardStats = {
  totalStations: 0,
  totalTracks: 0,
  activeFaults: 0,
  criticalFaults: 0,
  fixedToday: 0,
  underMaintenance: 0,
  systemStatus: 'operational',
};

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [faultTrend, setFaultTrend] = useState<TrendDatum[]>([]);
  const [faultTypeData, setFaultTypeData] = useState<FaultTypeDatum[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyDatum[]>([]);
  const [stationFaultData, setStationFaultData] = useState<StationFaultDatum[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [faults, setFaults] = useState<Fault[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [alerts, setAlerts] = useState<AlertLog[]>([]);
  const loadedOnce = useRef(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent || !loadedOnce.current) setLoading(true);
    setError(null);
    try {
      const [
        statsRes,
        trendRes,
        typeRes,
        monthlyRes,
        stationRes,
        stationsRes,
        tracksRes,
        faultsRes,
        tasksRes,
        notifRes,
        devicesRes,
        readingsRes,
        alertsRes,
      ] = await Promise.all([
        dashboardApi.stats(),
        dashboardApi.faultTrend(),
        dashboardApi.faultByType(),
        dashboardApi.monthlyStats(),
        dashboardApi.faultByStation(),
        stationsApi.list(),
        tracksApi.list(),
        faultsApi.list(),
        maintenanceApi.list(),
        notificationsApi.list(),
        devicesApi.list(),
        sensorReadingsApi.list({ limit: 150 }),
        alertsApi.list(),
      ]);

      setStats(statsRes);
      setFaultTrend(trendRes);
      setFaultTypeData(typeRes.map((d, i) => ({ ...d, color: TYPE_COLORS[i % TYPE_COLORS.length] })));
      setMonthlyStats(monthlyRes);
      setStationFaultData(stationRes.map(d => ({ name: shortName(d.name), faults: d.faults })));
      setStations(stationsRes);
      setTracks(tracksRes);
      setFaults(faultsRes);
      setTasks(tasksRes);
      setNotifications(notifRes);
      setDevices(devicesRes);
      setReadings(readingsRes);
      setAlerts(alertsRes);
      loadedOnce.current = true;
    } catch {
      setError('Could not reach the backend API. Make sure it is running on port 5000.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Live poll: shudhu lightweight data (tracks + readings) proti 1.5s e.
    // Baki heavy endpoints (dashboard stats, faults, ...) 15s e — nahole
    // proti poll e 13 ta request render lag toiri kore.
    const liveInterval = setInterval(async () => {
      try {
        const [tracksRes, readingsRes, alertsRes, faultsRes] = await Promise.all([
          tracksApi.list(),
          sensorReadingsApi.list({ limit: 150 }),
          alertsApi.list(),
          faultsApi.list(),
        ]);
        setTracks(tracksRes);
        setReadings(readingsRes);
        setAlerts(alertsRes);
        setFaults(faultsRes);
      } catch {
        /* silent — next poll e abar try korbe */
      }
    }, LIVE_POLL_INTERVAL_MS);

    const slowInterval = setInterval(() => {
      refresh(true);
    }, 15000);

    return () => {
      clearInterval(liveInterval);
      clearInterval(slowInterval);
    };
  }, [refresh]);

  const updateTask = async (id: string, data: Partial<MaintenanceTask>) => {
    await maintenanceApi.update(id, data);
    await refresh(true);
  };

  const markNotificationRead = async (id: string) => {
    setNotifications(prev => prev.map(n => (String(n.id) === String(id) ? { ...n, read: true } : n)));
    await notificationsApi.markRead(id).catch(() => undefined);
  };

  return (
    <DataContext.Provider
      value={{
        loading,
        error,
        refresh,
        stats,
        faultTrend,
        faultTypeData,
        monthlyStats,
        stationFaultData,
        stations,
        tracks,
        faults,
        tasks,
        notifications,
        devices,
        readings,
        alerts,
        updateTask,
        markNotificationRead,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}