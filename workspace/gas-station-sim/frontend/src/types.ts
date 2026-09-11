/** 与后端 models.py 对应的类型定义 */

export interface FuelType {
  id: string;
  name: string;
  color: string;
  service_min: number;
  service_mode: number;
  service_max: number;
}

export interface Period {
  start: number;
  end: number;
  arrivals: Record<string, number>; // fuel_id -> 辆/小时
}

export interface Pump {
  id: string;
  name: string;
  fuels: string[];
  initial_open: boolean;
}

export interface Policy {
  open_queue_threshold: number;
  open_wait_threshold: number;
  close_idle_minutes: number;
  check_interval: number;
  staff_pump_coverage: number;
  wait_target: number;
}

export interface SimConfig {
  name: string;
  open_time: string;
  horizon_minutes: number;
  seed: number;
  staff_count: number;
  fuels: FuelType[];
  periods: Period[];
  pumps: Pump[];
  policy: Policy;
}

export interface SimEvent {
  t: number;
  kind: string;
  level: string;
  message: string;
}

export interface PumpResult {
  id: string;
  name: string;
  fuels: string[];
  reserve: boolean;
  served: number;
  utilization: number;
  open_minutes: number;
  open_intervals: number[][];
}

export interface WaitStats {
  count: number;
  avg: number;
  p50: number;
  p95: number;
  max: number;
  unserved?: number;
}

export interface StaffBucket {
  start: number;
  end: number;
  required: number;
  scheduled: number;
}

export interface Series {
  times: number[];
  waiting_by_fuel: Record<string, number[]>;
  total_waiting: number[];
  active_services: number[];
  staff_capacity: number[];
  open_pumps: number[];
}

export interface SimResult {
  config_name: string;
  open_time: string;
  horizon_minutes: number;
  kpis: Record<string, number>;
  series: Series;
  pumps: PumpResult[];
  wait_by_fuel: Record<string, WaitStats>;
  events: SimEvent[];
  staff_buckets: StaffBucket[];
  recommendations: string[];
  wait_histogram: { lo: number; hi: number; count: number }[];
}

export interface Preset {
  id: string;
  config: SimConfig;
}

/** 把仿真分钟换算成钟点 HH:MM */
export function fmtClock(openTime: string, t: number): string {
  const [h, m] = openTime.split(":").map(Number);
  const total = h * 60 + m + Math.round(t);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
