import type { SimConfig, SimResult } from "../types";
import { fmtClock } from "../types";

/** 油枪开闭甘特图（纯 SVG）：绿色=开启时段，备用枪用斜纹色区分；右侧利用率条 */
export default function PumpGantt({ result, config }: { result: SimResult; config: SimConfig }) {
  const W = 720;
  const H_PER = 30;
  const LABEL_W = 130;
  const horizon = result.horizon_minutes;
  const x = (t: number) => LABEL_W + (t / horizon) * (W - LABEL_W);

  const ticks: number[] = [];
  for (let t = 0; t <= horizon; t += 30) ticks.push(t);

  return (
    <div className="gantt-wrap">
      <svg viewBox={`0 0 ${W} ${result.pumps.length * H_PER + 24}`} className="gantt">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={16} x2={x(t)} y2={result.pumps.length * H_PER + 16} stroke="#2a3550" />
            <text x={x(t)} y={12} fontSize={10} fill="#7c8db0" textAnchor="middle">
              {fmtClock(result.open_time, t)}
            </text>
          </g>
        ))}
        {result.pumps.map((p, i) => {
          const y = 20 + i * H_PER;
          return (
            <g key={p.id}>
              <text x={4} y={y + 14} fontSize={12} fill={p.reserve ? "#fbbf24" : "#e2e8f0"}>
                {p.name}{p.reserve ? " ⏱" : ""}
              </text>
              <rect x={x(0)} y={y} width={x(horizon) - x(0)} height={18} rx={3} fill="#1a2238" />
              {p.open_intervals.map(([s, e], j) => (
                <rect
                  key={j}
                  x={x(s)}
                  y={y}
                  width={Math.max(1.5, x(e) - x(s))}
                  height={18}
                  rx={3}
                  fill={p.reserve ? "#b45309" : "#15803d"}
                >
                  <title>{fmtClock(result.open_time, s)} – {fmtClock(result.open_time, e)} 开启</title>
                </rect>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="util-list">
        {result.pumps.map((p) => {
          const fuelNames = p.fuels
            .map((fid) => config.fuels.find((f) => f.id === fid)?.name ?? fid)
            .join(" / ");
          return (
            <div key={p.id} className="util-row">
              <span className="util-name">{p.name} <small className="muted">({fuelNames})</small></span>
              <div className="util-bar-bg">
                <div
                  className={`util-bar ${p.utilization > 0.85 ? "util-hot" : ""}`}
                  style={{ width: `${Math.min(100, p.utilization * 100)}%` }}
                />
              </div>
              <span className="util-num">{Math.round(p.utilization * 100)}% · {p.served}辆</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
