export type UserRole = 'station_incharge' | 'maintenance_team' | 'railway_administrator';

export interface User {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  email: string;
  avatar?: string;
  station?: string;
}

export type FaultSeverity = 'critical' | 'high' | 'medium' | 'low';
export type FaultStatus = 'active' | 'under_maintenance' | 'fixed';
export type TrackStatus = 'safe' | 'warning' | 'critical';
export type MaintenanceStatus = 'pending' | 'in_progress' | 'completed';

export interface Station {
  id: string;
  name: string;
  location: string;
  totalTracks: number;
  activeFaults: number;
  status: TrackStatus;
}

export interface Track {
  id: string;
  stationId: string;
  stationName: string;
  status: TrackStatus;
  sensorHealth: number;
  lastUpdated: string;
  imageUrl: string;
  temperature: number;
  vibration: number;
  displacement: number;
}

export interface Fault {
  id: string;
  stationId: string;
  stationName: string;
  trackId: string;
  faultType: string;
  severity: FaultSeverity;
  detectionTime: string;
  status: FaultStatus;
  imageUrl: string;
  aiConfidence: number;
  sensorValues: {
    temperature: number;
    vibration: number;
    displacement: number;
    pressure: number;
  };
  remarks: string;
  description: string;
}

export interface MaintenanceTask {
  id: string;
  faultId: string;
  stationName: string;
  trackId: string;
  assignedTeam: string;
  engineer: string;
  progress: number;
  status: MaintenanceStatus;
  startTime?: string;
  completionTime?: string;
  faultType: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  time: string;
  read: boolean;
}

export interface DashboardStats {
  totalStations: number;
  totalTracks: number;
  activeFaults: number;
  criticalFaults: number;
  fixedToday: number;
  underMaintenance: number;
  systemStatus: 'operational' | 'degraded' | 'critical';
}

export type DeviceType =
  | 'esp32_sensor_node'
  | 'raspberry_pi_vision'
  | 'lora_transmitter'
  | 'lora_receiver_station'
  | 'train_unit';

export type DeviceStatus = 'online' | 'offline' | 'degraded' | 'maintenance';

export interface Device {
  id: number;
  stationId: string;
  trackId?: string;
  deviceType: DeviceType;
  name: string;
  status: DeviceStatus;
  firmwareVersion?: string;
  location?: string;
  installedAt?: string;
  lastHeartbeat?: string;
}

export type SensorType = 'ir_beam' | 'ultrasonic' | 'vibration' | 'temperature' | 'camera';

export interface SensorReading {
  id: number;
  deviceId: number;
  trackId?: string;
  sensorType: SensorType;
  value: number;
  unit?: string;
  recordedAt: string;
}

export interface AlertLog {
  id: number;
  faultId: string;
  deviceId?: number;
  destination: 'station_display' | 'train_unit';
  channel: string;
  message: string;
  severity: FaultSeverity;
  sentAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: number;
}
