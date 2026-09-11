"""数据模型：站长输入的仿真配置与仿真结果结构。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class FuelType(BaseModel):
    """油品：服务时间用三角分布（最小/最可能/最大），对站长可解释。"""
    id: str
    name: str
    color: str = "#64748b"
    service_min: float = Field(2.0, description="最短加油时间(分钟)")
    service_mode: float = Field(3.5, description="最可能加油时间(分钟)")
    service_max: float = Field(6.0, description="最长加油时间(分钟)")


class Period(BaseModel):
    """时段：[start, end) 分钟内，各油品每小时到站车辆数（泊松到达）。"""
    start: float
    end: float
    arrivals: dict[str, float] = Field(default_factory=dict)  # fuel_id -> 辆/小时


class Pump(BaseModel):
    """油枪：兼容若干油品；initial_open=False 表示备用枪，由策略动态增开。"""
    id: str
    name: str
    fuels: list[str]
    initial_open: bool = True


class Policy(BaseModel):
    """动态增开/关闭策略与考核目标。"""
    open_queue_threshold: int = Field(4, description="某油品排队达到该辆数则增开备用枪")
    open_wait_threshold: float = Field(6.0, description="或最久等待超过该分钟数则增开")
    close_idle_minutes: float = Field(4.0, description="备用枪连续空闲该分钟数后关闭")
    check_interval: float = Field(1.0, description="策略巡检间隔(分钟)")
    staff_pump_coverage: int = Field(1, description="1名员工可同时照看的油枪数")
    wait_target: float = Field(8.0, description="等待时间考核目标(分钟)")


class SimConfig(BaseModel):
    name: str = "未命名方案"
    open_time: str = "06:00"          # 仅用于展示，把仿真分钟换算成钟点
    horizon_minutes: int = 240
    seed: int = 42
    staff_count: int = 3
    fuels: list[FuelType]
    periods: list[Period]
    pumps: list[Pump]
    policy: Policy = Field(default_factory=Policy)


# ---------- 仿真结果 ----------

class SimEvent(BaseModel):
    """可解释事件：仿真过程中值得站长关注的每一个决策与异常。"""
    t: float                       # 仿真分钟
    kind: str                      # pump_open / pump_close / staff_short / long_wait / period / info
    level: str = "info"            # info / warn / alert
    message: str


class SimResult(BaseModel):
    config_name: str
    open_time: str
    horizon_minutes: int
    kpis: dict
    series: dict                   # 时间序列：排队/在岗/服务能力
    pumps: list[dict]              # 每把枪的利用率与开闭区间
    wait_by_fuel: dict
    events: list[SimEvent]
    staff_buckets: list[dict]      # 15 分钟粒度的人力需求
    recommendations: list[str]
    wait_histogram: list[dict]
