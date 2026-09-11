"""离散事件模拟引擎。

事件类型：
  ARRIVAL      车辆到站（按各时段泊松过程预生成）
  SERVICE_END  某把油枪完成服务
  POLICY       策略巡检：动态增开/关闭备用油枪、记录长等待与人力不足
  SAMPLE       每分钟采样一次系统状态，生成时间序列

核心机制：
  - 每种油品一个 FIFO 等待池（即"油品车道"），车辆到站后进入对应车道；
  - 空闲且开着的油枪从兼容车道中拉取等待最久的车辆（全局近似 FCFS，公平且可解释）；
  - 员工是共享资源：并发服务数 <= 员工数 × 每人可照看枪数，人手不足时油枪只能空转；
  - 备用油枪（initial_open=False）由策略按排队压力动态增开，空闲超时自动关闭，
    每次开闭都写入事件日志并附原因，保证结果可解释。
"""
from __future__ import annotations

import heapq
import random
from collections import defaultdict, deque
from dataclasses import dataclass, field

from .models import SimConfig, SimEvent, SimResult

ARRIVAL, SERVICE_END, POLICY, SAMPLE = 0, 1, 2, 3
BUCKET_MIN = 15  # 人力排班粒度


@dataclass
class Vehicle:
    vid: int
    fuel: str
    arrival: float
    start: float | None = None
    end: float | None = None
    pump: str = ""
    long_wait_logged: bool = False


@dataclass
class PumpState:
    pid: str
    name: str
    fuels: list[str]
    is_open: bool
    is_reserve: bool
    current: Vehicle | None = None
    busy_time: float = 0.0
    open_time: float = 0.0
    served: int = 0
    idle_since: float | None = None      # 备用枪连续空闲起点
    last_change: float = 0.0             # 上次开/关时刻，用于累计 open_time
    open_intervals: list[list[float]] = field(default_factory=list)


class Engine:
    def __init__(self, cfg: SimConfig):
        self.cfg = cfg
        self.rng = random.Random(cfg.seed)
        self.horizon = float(cfg.horizon_minutes)
        self.capacity_per_staff = max(1, cfg.policy.staff_pump_coverage)

        self.events_q: list[tuple] = []
        self._seq = 0
        self.pools: dict[str, deque[Vehicle]] = {f.id: deque() for f in cfg.fuels}
        self.pumps: dict[str, PumpState] = {
            p.id: PumpState(p.id, p.name, list(p.fuels), p.initial_open, not p.initial_open)
            for p in cfg.pumps
        }
        self.active_services = 0
        self.vehicles: list[Vehicle] = []
        self.log: list[SimEvent] = []
        self.unserved: dict[str, int] = defaultdict(int)
        self._last_short_log = -1e9

        # 时间序列
        self.series: dict = {
            "times": [],
            "waiting_by_fuel": defaultdict(list),
            "total_waiting": [],
            "active_services": [],
            "staff_capacity": [],
            "open_pumps": [],
        }

    # ---------- 事件调度 ----------
    def _push(self, t: float, kind: int, payload=None):
        self._seq += 1
        heapq.heappush(self.events_q, (t, self._seq, kind, payload))

    def _emit(self, t: float, kind: str, message: str, level: str = "info"):
        self.log.append(SimEvent(t=round(t, 2), kind=kind, level=level, message=message))

    # ---------- 到达生成 ----------
    def _schedule_arrivals(self):
        vid = 0
        for period in self.cfg.periods:
            for fuel_id, rate in period.arrivals.items():
                if rate <= 0 or fuel_id not in self.pools:
                    continue
                t = period.start
                lam = rate / 60.0  # 辆/分钟
                while True:
                    t += self.rng.expovariate(lam)
                    if t >= period.end:
                        break
                    vid += 1
                    self._push(t, ARRIVAL, Vehicle(vid=vid, fuel=fuel_id, arrival=t))

    # ---------- 服务分派 ----------
    def _try_assign(self, now: float):
        """员工有空闲且存在"空闲开着的枪 + 兼容等待车辆"时，按等待最久优先派车。"""
        capacity = self.cfg.staff_count * self.capacity_per_staff
        while self.active_services < capacity:
            best: tuple[Vehicle, PumpState] | None = None
            for p in self.pumps.values():
                if not p.is_open or p.current is not None:
                    continue
                for f in p.fuels:
                    if self.pools[f] and (best is None or self.pools[f][0].arrival < best[0].arrival):
                        best = (self.pools[f][0], p)
            if best is None:
                return
            veh, pump = best
            self.pools[veh.fuel].popleft()
            fuel_cfg = next(f for f in self.cfg.fuels if f.id == veh.fuel)
            dur = self.rng.triangular(fuel_cfg.service_min, fuel_cfg.service_max, fuel_cfg.service_mode)
            veh.start, veh.pump = now, pump.pid
            pump.current = veh
            pump.idle_since = None
            self.active_services += 1
            self._push(now + dur, SERVICE_END, pump.pid)

    # ---------- 策略巡检 ----------
    def _policy_check(self, now: float):
        cfg = self.cfg
        capacity = cfg.staff_count * self.capacity_per_staff

        # 各油品车道压力
        pressure: dict[str, tuple[int, float]] = {}
        for f_id, pool in self.pools.items():
            oldest_wait = (now - pool[0].arrival) if pool else 0.0
            pressure[f_id] = (len(pool), oldest_wait)

        # 1) 增开备用枪；人力不足时合并成一条事件，全局节流避免刷屏
        blocked: list[tuple[PumpState, str]] = []
        for p in self.pumps.values():
            if p.is_open or not p.is_reserve:
                continue
            trigger = None
            for f in p.fuels:
                n, oldest = pressure[f]
                if n >= cfg.policy.open_queue_threshold:
                    trigger = f"{self._fuel_name(f)}车道排队 {n} 辆 ≥ 阈值 {cfg.policy.open_queue_threshold}"
                    break
                if oldest >= cfg.policy.open_wait_threshold:
                    trigger = f"{self._fuel_name(f)}车道最久等待 {oldest:.1f} 分钟 ≥ 阈值 {cfg.policy.open_wait_threshold}"
                    break
            if trigger is None:
                continue
            if self.active_services < capacity:
                self._open_pump(p, now, f"增开：{trigger}")
                self._try_assign(now)
            else:
                blocked.append((p, trigger))
        if blocked and now - self._last_short_log >= 10:
            self._last_short_log = now
            names = "、".join(f"「{p.name}」" for p, _ in blocked)
            self._emit(now, "staff_short",
                       f"想增开 {names}（{blocked[0][1]}），但 {cfg.staff_count} 名员工均在岗服务，"
                       f"人力不足无法增开", "alert")

        # 2) 关闭空闲备用枪
        for p in self.pumps.values():
            if not p.is_open or not p.is_reserve:
                continue
            compatible_waiting = any(self.pools[f] for f in p.fuels)
            if p.current is None and not compatible_waiting:
                if p.idle_since is None:
                    p.idle_since = now
                elif now - p.idle_since >= cfg.policy.close_idle_minutes:
                    self._close_pump(p, now, f"连续空闲 {now - p.idle_since:.0f} 分钟，释放人力")
            else:
                p.idle_since = None

        # 3) 长等待预警
        for f_id, pool in self.pools.items():
            if pool:
                v = pool[0]
                wait = now - v.arrival
                if wait >= cfg.policy.wait_target and not v.long_wait_logged:
                    v.long_wait_logged = True
                    self._emit(now, "long_wait",
                               f"{self._fuel_name(f_id)}车道有车辆已等待 {wait:.1f} 分钟，"
                               f"超过 {cfg.policy.wait_target:.0f} 分钟考核线", "warn")

        if now + cfg.policy.check_interval <= self.horizon:
            self._push(now + cfg.policy.check_interval, POLICY)

    def _open_pump(self, p: PumpState, now: float, reason: str):
        p.is_open, p.last_change = True, now
        p.idle_since = None
        self._emit(now, "pump_open", f"「{p.name}」开启 —— {reason}")

    def _close_pump(self, p: PumpState, now: float, reason: str):
        p.is_open = False
        p.open_time += now - p.last_change
        p.open_intervals.append([round(p.last_change, 2), round(now, 2)])
        p.last_change = now
        self._emit(now, "pump_close", f"「{p.name}」关闭 —— {reason}")

    def _fuel_name(self, fid: str) -> str:
        return next((f.name for f in self.cfg.fuels if f.id == fid), fid)

    # ---------- 采样 ----------
    def _sample(self, now: float):
        s = self.series
        s["times"].append(round(now, 2))
        total = 0
        for f_id, pool in self.pools.items():
            s["waiting_by_fuel"][f_id].append(len(pool))
            total += len(pool)
        s["total_waiting"].append(total)
        s["active_services"].append(self.active_services)
        s["staff_capacity"].append(self.cfg.staff_count * self.capacity_per_staff)
        s["open_pumps"].append(sum(1 for p in self.pumps.values() if p.is_open))
        if now + 1 <= self.horizon:
            self._push(now + 1, SAMPLE)

    # ---------- 主循环 ----------
    def run(self) -> SimResult:
        self._validate()
        self._schedule_arrivals()
        self._push(0.0, POLICY)
        self._push(0.0, SAMPLE)
        for p in self.cfg.periods:
            self._emit(p.start, "period", f"进入时段 {int(p.start)}–{int(p.end)} 分钟")

        drain_until = self.horizon + 180  # 结束后继续消化存量队列
        while self.events_q:
            t, _, kind, payload = heapq.heappop(self.events_q)
            if t > drain_until:
                break
            if kind == ARRIVAL:
                self.pools[payload.fuel].append(payload)
                self.vehicles.append(payload)
                self._try_assign(t)
            elif kind == SERVICE_END:
                pump = self.pumps[payload]
                veh = pump.current
                if veh is None:
                    continue
                veh.end = t
                pump.busy_time += t - veh.start
                pump.served += 1
                pump.current = None
                self.active_services -= 1
                self._try_assign(t)
            elif kind == POLICY:
                self._policy_check(t)
            elif kind == SAMPLE:
                self._sample(t)

        end_t = min(drain_until, max([self.horizon] + [v.end or 0 for v in self.vehicles]))
        for p in self.pumps.values():
            if p.is_open:
                p.open_time += end_t - p.last_change
                p.open_intervals.append([round(p.last_change, 2), round(end_t, 2)])
        for f_id, pool in self.pools.items():
            self.unserved[f_id] = len(pool)
        # 截断时仍在加油中的车辆也视为未完成
        for v in self.vehicles:
            if v.start is not None and v.end is None:
                self.unserved[v.fuel] += 1

        return self._build_result(end_t)

    # ---------- 结果汇总 ----------
    def _build_result(self, end_t: float) -> SimResult:
        cfg = self.cfg
        served = [v for v in self.vehicles if v.end is not None]
        waits = [(v.start - v.arrival) for v in served]

        wait_by_fuel = {}
        for f in cfg.fuels:
            ws = sorted(v.start - v.arrival for v in served if v.fuel == f.id)
            wait_by_fuel[f.id] = self._stats(ws)
            wait_by_fuel[f.id]["unserved"] = self.unserved.get(f.id, 0)

        # 人力需求：15 分钟桶内最大并发服务数 -> 所需员工
        n_buckets = int(self.horizon // BUCKET_MIN) + 1
        bucket_need = [0] * n_buckets
        times, act = self.series["times"], self.series["active_services"]
        for t, a in zip(times, act):
            b = min(int(t // BUCKET_MIN), n_buckets - 1)
            bucket_need[b] = max(bucket_need[b], a)
        staff_buckets = [
            {
                "start": b * BUCKET_MIN,
                "end": min((b + 1) * BUCKET_MIN, self.horizon),
                "required": -(-bucket_need[b] // self.capacity_per_staff),  # ceil
                "scheduled": cfg.staff_count,
            }
            for b in range(n_buckets)
            if b * BUCKET_MIN < self.horizon
        ]

        pumps_out = []
        for p in self.pumps.values():
            pumps_out.append({
                "id": p.pid, "name": p.name, "fuels": p.fuels, "reserve": p.is_reserve,
                "served": p.served,
                "utilization": round(p.busy_time / max(p.open_time, 1e-9), 3),
                "open_minutes": round(p.open_time, 1),
                "open_intervals": p.open_intervals,
            })

        max_q = max(self.series["total_waiting"] or [0])
        max_q_t = self.series["times"][self.series["total_waiting"].index(max_q)] if max_q else 0
        kpis = {
            "arrived": len(self.vehicles),
            "served": len(served),
            "unserved": sum(self.unserved.values()),
            "avg_wait": round(sum(waits) / len(waits), 2) if waits else 0,
            "p95_wait": self._percentile(waits, 0.95),
            "max_wait": round(max(waits), 1) if waits else 0,
            "max_queue": max_q,
            "max_queue_time": round(max_q_t, 1),
            "sla_pct": round(100 * sum(1 for w in waits if w <= cfg.policy.wait_target) / len(waits), 1) if waits else 100,
            "staff_util": round(sum(act) / max(1, len(act)) / max(1, cfg.staff_count * self.capacity_per_staff), 3),
        }

        return SimResult(
            config_name=cfg.name,
            open_time=cfg.open_time,
            horizon_minutes=cfg.horizon_minutes,
            kpis=kpis,
            series={**self.series, "waiting_by_fuel": dict(self.series["waiting_by_fuel"])},
            pumps=pumps_out,
            wait_by_fuel=wait_by_fuel,
            events=sorted(self.log, key=lambda e: e.t),
            staff_buckets=staff_buckets,
            recommendations=self._recommend(staff_buckets, wait_by_fuel, pumps_out, kpis),
            wait_histogram=self._histogram(waits),
        )

    def _recommend(self, buckets, wait_by_fuel, pumps_out, kpis) -> list[str]:
        cfg = self.cfg
        recs: list[str] = []

        # 1) 人力缺口窗口
        gaps = [b for b in buckets if b["required"] > b["scheduled"]]
        if gaps:
            windows = self._merge_windows([ (g["start"], g["end"]) for g in gaps ])
            peak_need = max(g["required"] for g in gaps)
            for s, e in windows:
                recs.append(f"人力缺口：{int(s)}–{int(e)} 分钟窗口需要 {peak_need} 名员工"
                            f"（现有 {cfg.staff_count} 名），建议安排机动班顶岗")
        elif kpis["staff_util"] < 0.4:
            recs.append(f"员工利用率仅 {kpis['staff_util']*100:.0f}%，低峰时段可考虑减少 1 名在岗或安排交叉培训")

        # 2) 各油品等待超标
        for f in cfg.fuels:
            st = wait_by_fuel[f.id]
            if st["count"] >= 5 and st["p95"] > cfg.policy.wait_target:
                recs.append(f"{f.name} 等待 P95 = {st['p95']:.1f} 分钟，超过 {cfg.policy.wait_target:.0f} 分钟目标："
                            f"建议增加兼容该油品的油枪，或将增开阈值从 {cfg.policy.open_queue_threshold} 辆下调")

        # 3) 备用枪使用评估
        for p in pumps_out:
            if p["reserve"] and p["open_minutes"] < 1:
                recs.append(f"备用枪「{p['name']}」全程未触发增开，当前阈值下冗余；"
                            f"若高峰仍拥堵请先排查人力而非设备")
            elif p["reserve"] and p["utilization"] > 0.85:
                recs.append(f"备用枪「{p['name']}」开启后利用率 {p['utilization']*100:.0f}%，接近饱和，"
                            f"建议高峰时段直接常开")

        # 4) 未服务车辆
        if kpis["unserved"] > 0:
            recs.append(f"仿真结束仍有 {kpis['unserved']} 辆车未加上油，服务能力整体不足，"
                        f"需增加油枪或员工，或延长高峰排班")

        if not recs:
            recs.append("当前配置下各油品等待均在目标内，无需调整；可尝试减少 1 名员工验证成本空间")
        return recs

    # ---------- 工具 ----------
    def _validate(self):
        fuel_ids = {f.id for f in self.cfg.fuels}
        for p in self.cfg.pumps:
            unknown = set(p.fuels) - fuel_ids
            if unknown:
                raise ValueError(f"油枪 {p.name} 引用了未知油品: {unknown}")
        for f in self.cfg.fuels:
            if not any(f.id in p.fuels for p in self.cfg.pumps):
                raise ValueError(f"油品 {f.name} 没有任何油枪可加，请检查配置")
        if not self.cfg.periods:
            raise ValueError("至少需要一个时段")

    @staticmethod
    def _percentile(sorted_or_not, q: float) -> float:
        xs = sorted(sorted_or_not)
        if not xs:
            return 0.0
        i = min(len(xs) - 1, int(round(q * (len(xs) - 1))))
        return round(xs[i], 2)

    def _stats(self, ws: list[float]) -> dict:
        if not ws:
            return {"count": 0, "avg": 0, "p50": 0, "p95": 0, "max": 0}
        return {
            "count": len(ws),
            "avg": round(sum(ws) / len(ws), 2),
            "p50": self._percentile(ws, 0.5),
            "p95": self._percentile(ws, 0.95),
            "max": round(ws[-1], 1),
        }

    @staticmethod
    def _histogram(waits: list[float], bin_min: float = 1.0) -> list[dict]:
        if not waits:
            return []
        hi = max(waits)
        n = int(hi // bin_min) + 1
        bins = [0] * n
        for w in waits:
            bins[min(int(w // bin_min), n - 1)] += 1
        return [{"lo": i * bin_min, "hi": (i + 1) * bin_min, "count": c} for i, c in enumerate(bins)]

    @staticmethod
    def _merge_windows(windows: list[tuple[float, float]]) -> list[tuple[float, float]]:
        if not windows:
            return []
        windows.sort()
        merged = [list(windows[0])]
        for s, e in windows[1:]:
            if s <= merged[-1][1]:
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e])
        return [(s, e) for s, e in merged]


def run_simulation(cfg: SimConfig) -> SimResult:
    return Engine(cfg).run()
