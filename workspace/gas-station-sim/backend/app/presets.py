"""预设场景：让站长一键载入典型高峰形态，再在此基础上微调。"""
from __future__ import annotations

from .models import FuelType, Period, Policy, Pump, SimConfig

DEFAULT_FUELS = [
    FuelType(id="92", name="92# 汽油", color="#38bdf8", service_min=2.0, service_mode=3.2, service_max=5.5),
    FuelType(id="95", name="95# 汽油", color="#a78bfa", service_min=2.0, service_mode=3.5, service_max=6.0),
    FuelType(id="98", name="98# 汽油", color="#f472b6", service_min=2.5, service_mode=4.0, service_max=7.0),
    FuelType(id="diesel", name="0# 柴油", color="#fbbf24", service_min=4.0, service_mode=7.0, service_max=12.0),
]


def _pumps() -> list[Pump]:
    return [
        Pump(id="p1", name="1号枪", fuels=["92", "95"], initial_open=True),
        Pump(id="p2", name="2号枪", fuels=["92", "95"], initial_open=True),
        Pump(id="p3", name="3号枪", fuels=["95", "98"], initial_open=True),
        Pump(id="p4", name="4号枪", fuels=["diesel"], initial_open=True),
        Pump(id="p5", name="5号枪(备用)", fuels=["92", "95"], initial_open=False),
        Pump(id="p6", name="6号枪(备用)", fuels=["92", "95", "98"], initial_open=False),
    ]


def preset_morning_peak() -> SimConfig:
    """工作日早高峰：7:00 开门，7:30–9:00 通勤车流集中加 92/95。"""
    return SimConfig(
        name="工作日早高峰",
        open_time="07:00",
        horizon_minutes=240,
        seed=42,
        staff_count=4,
        fuels=DEFAULT_FUELS,
        periods=[
            Period(start=0, end=30, arrivals={"92": 12, "95": 8, "98": 1, "diesel": 2}),
            Period(start=30, end=120, arrivals={"92": 34, "95": 22, "98": 3, "diesel": 4}),
            Period(start=120, end=180, arrivals={"92": 16, "95": 10, "98": 1, "diesel": 3}),
            Period(start=180, end=240, arrivals={"92": 8, "95": 6, "98": 1, "diesel": 2}),
        ],
        pumps=_pumps(),
        policy=Policy(),
    )


def preset_weekend_afternoon() -> SimConfig:
    """周末午后：总量平缓但持续，98# 占比略升。"""
    return SimConfig(
        name="周末午后平峰",
        open_time="12:00",
        horizon_minutes=300,
        seed=7,
        staff_count=3,
        fuels=DEFAULT_FUELS,
        periods=[
            Period(start=0, end=120, arrivals={"92": 18, "95": 14, "98": 4, "diesel": 2}),
            Period(start=120, end=240, arrivals={"92": 24, "95": 18, "98": 6, "diesel": 3}),
            Period(start=240, end=300, arrivals={"92": 12, "95": 10, "98": 3, "diesel": 2}),
        ],
        pumps=_pumps(),
        policy=Policy(open_queue_threshold=5, open_wait_threshold=7.0),
    )


def preset_diesel_night() -> SimConfig:
    """货运夜高峰：柴油重卡集中到站，单车服务时间长，考验柴油枪与人力。"""
    return SimConfig(
        name="货运柴油夜高峰",
        open_time="20:00",
        horizon_minutes=240,
        seed=11,
        staff_count=2,
        fuels=[f for f in DEFAULT_FUELS if f.id != "98"],  # 夜间柴油专场不配 98#
        periods=[
            Period(start=0, end=60, arrivals={"92": 6, "95": 4, "diesel": 8}),
            Period(start=60, end=150, arrivals={"92": 8, "95": 5, "diesel": 18}),
            Period(start=150, end=240, arrivals={"92": 5, "95": 3, "diesel": 10}),
        ],
        pumps=[
            Pump(id="p1", name="1号枪", fuels=["92", "95"], initial_open=True),
            Pump(id="p2", name="2号枪", fuels=["92", "95"], initial_open=True),
            Pump(id="p3", name="3号枪(柴油)", fuels=["diesel"], initial_open=True),
            Pump(id="p4", name="4号枪(柴油·备用)", fuels=["diesel"], initial_open=False),
        ],
        policy=Policy(open_queue_threshold=3, open_wait_threshold=8.0),
    )


ALL_PRESETS = [
    ("morning_peak", preset_morning_peak),
    ("weekend_afternoon", preset_weekend_afternoon),
    ("diesel_night", preset_diesel_night),
]
