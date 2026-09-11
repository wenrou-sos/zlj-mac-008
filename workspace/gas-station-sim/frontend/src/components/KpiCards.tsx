import type { ReactNode } from "react";
import type { SimConfig, SimResult } from "../types";
import { fmtClock } from "../types";

interface Props {
  result: SimResult;
  config: SimConfig;
  prevKpis: Record<string, number> | null;
}

interface Card {
  label: string;
  value: string;
  sub?: string;
  delta?: ReactNode;
  bad?: boolean;
}

function Delta({ cur, prev, invert = false, suffix = "" }: {
  cur: number; prev: number | undefined; invert?: boolean; suffix?: string;
}) {
  if (prev === undefined) return null;
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return <span className="delta flat">— 持平</span>;
  const good = invert ? d < 0 : d > 0;
  return (
    <span className={`delta ${good ? "good" : "bad"}`}>
      {d > 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}{suffix} vs 上次
    </span>
  );
}

export default function KpiCards({ result, config, prevKpis }: Props) {
  const k = result.kpis;
  const cards: Card[] = [
    {
      label: "到站 / 服务车辆",
      value: `${k.arrived} / ${k.served}`,
      sub: k.unserved > 0 ? `⚠ ${k.unserved} 辆未加上油` : "全部完成服务",
      bad: k.unserved > 0,
    },
    {
      label: "平均等待",
      value: `${k.avg_wait} 分`,
      delta: <Delta cur={k.avg_wait} prev={prevKpis?.avg_wait} invert suffix="分" />,
    },
    {
      label: "P95 等待",
      value: `${k.p95_wait} 分`,
      delta: <Delta cur={k.p95_wait} prev={prevKpis?.p95_wait} invert suffix="分" />,
    },
    {
      label: "最大排队",
      value: `${k.max_queue} 辆`,
      sub: `出现在 ${fmtClock(result.open_time, k.max_queue_time)}`,
      delta: <Delta cur={k.max_queue} prev={prevKpis?.max_queue} invert />,
    },
    {
      label: `达标率(≤${config.policy.wait_target}分)`,
      value: `${k.sla_pct}%`,
      delta: <Delta cur={k.sla_pct} prev={prevKpis?.sla_pct} suffix="%" />,
      bad: k.sla_pct < 80,
    },
    {
      label: "员工利用率",
      value: `${Math.round(k.staff_util * 100)}%`,
      sub: `${config.staff_count} 名在岗 · 1人照看${config.policy.staff_pump_coverage}枪`,
    },
  ];
  return (
    <div className="kpi-grid">
      {cards.map((c, i) => (
        <div key={i} className={`kpi-card ${c.bad ? "kpi-bad" : ""}`}>
          <div className="kpi-label">{c.label}</div>
          <div className="kpi-value">{c.value}</div>
          <div className="kpi-sub">{c.sub}{c.delta}</div>
        </div>
      ))}
    </div>
  );
}
