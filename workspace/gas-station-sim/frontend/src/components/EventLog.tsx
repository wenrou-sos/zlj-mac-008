import { useState } from "react";
import type { SimResult } from "../types";
import { fmtClock } from "../types";

const KIND_META: Record<string, { icon: string; label: string }> = {
  pump_open: { icon: "🟢", label: "增开" },
  pump_close: { icon: "⚪", label: "关闭" },
  staff_short: { icon: "🔴", label: "人力不足" },
  long_wait: { icon: "🟠", label: "长等待" },
  period: { icon: "🔵", label: "时段" },
  info: { icon: "ℹ️", label: "信息" },
};

const FILTERS = [
  { id: "all", label: "全部" },
  { id: "pump", label: "油枪开闭" },
  { id: "staff_short", label: "人力不足" },
  { id: "long_wait", label: "长等待" },
];

export default function EventLog({ result }: { result: SimResult }) {
  const [filter, setFilter] = useState("all");
  const events = result.events.filter((e) => {
    if (filter === "all") return e.kind !== "period";
    if (filter === "pump") return e.kind === "pump_open" || e.kind === "pump_close";
    return e.kind === filter;
  });

  return (
    <div>
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`chip ${filter === f.id ? "chip-active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <span className="muted">{events.length} 条</span>
      </div>
      <div className="event-list">
        {events.length === 0 && <div className="muted">该类别下无事件</div>}
        {events.map((e, i) => {
          const meta = KIND_META[e.kind] ?? KIND_META.info;
          return (
            <div key={i} className={`event-item level-${e.level}`}>
              <span className="event-time">{fmtClock(result.open_time, e.t)}</span>
              <span className="event-icon">{meta.icon}</span>
              <span className="event-msg">{e.message}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
