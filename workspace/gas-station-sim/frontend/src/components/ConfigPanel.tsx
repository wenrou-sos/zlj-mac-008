import type { ChangeEvent } from "react";
import type { Preset, SimConfig } from "../types";

interface Props {
  config: SimConfig;
  presets: Preset[];
  loading: boolean;
  onChange: (c: SimConfig) => void;
  onLoadPreset: (id: string) => void;
  onRun: () => void;
}

function Num({ value, onChange, min = 0, step = 1, width = 56 }: {
  value: number; onChange: (v: number) => void; min?: number; step?: number; width?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      step={step}
      style={{ width }}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
    />
  );
}

export default function ConfigPanel({ config, presets, loading, onChange, onLoadPreset, onRun }: Props) {
  const up = (fn: (c: SimConfig) => void) => {
    const next = structuredClone(config);
    fn(next);
    onChange(next);
  };

  return (
    <div className="config-panel">
      <section>
        <h2>场景</h2>
        <div className="row">
          <select
            value=""
            onChange={(e) => e.target.value && onLoadPreset(e.target.value)}
          >
            <option value="">载入预设场景…</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{p.config.name}</option>
            ))}
          </select>
          <input
            className="grow"
            value={config.name}
            onChange={(e) => up((c) => { c.name = e.target.value; })}
            placeholder="方案名称"
          />
        </div>
        <div className="grid2">
          <label>开门时间
            <input type="time" value={config.open_time}
              onChange={(e) => up((c) => { c.open_time = e.target.value; })} />
          </label>
          <label>模拟时长(分)
            <Num value={config.horizon_minutes} min={30} step={30}
              onChange={(v) => up((c) => { c.horizon_minutes = v; })} />
          </label>
          <label>员工数量
            <Num value={config.staff_count} min={1}
              onChange={(v) => up((c) => { c.staff_count = v; })} />
          </label>
          <label>随机种子
            <Num value={config.seed}
              onChange={(v) => up((c) => { c.seed = v; })} />
          </label>
        </div>
      </section>

      <section>
        <h2>油品与加油时长 <small>三角分布 最小/常见/最大(分钟)</small></h2>
        {config.fuels.map((f, i) => (
          <div className="row fuel-row" key={f.id}>
            <input type="color" value={f.color}
              onChange={(e) => up((c) => { c.fuels[i].color = e.target.value; })} />
            <input className="fuel-name" value={f.name}
              onChange={(e) => up((c) => { c.fuels[i].name = e.target.value; })} />
            <Num value={f.service_min} step={0.5} width={48}
              onChange={(v) => up((c) => { c.fuels[i].service_min = v; })} />
            <Num value={f.service_mode} step={0.5} width={48}
              onChange={(v) => up((c) => { c.fuels[i].service_mode = v; })} />
            <Num value={f.service_max} step={0.5} width={48}
              onChange={(v) => up((c) => { c.fuels[i].service_max = v; })} />
          </div>
        ))}
      </section>

      <section>
        <h2>分时段到站车流 <small>辆/小时（按油品）</small></h2>
        <table className="compact-table">
          <thead>
            <tr>
              <th>起(分)</th><th>止(分)</th>
              {config.fuels.map((f) => <th key={f.id} style={{ color: f.color }}>{f.name}</th>)}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {config.periods.map((p, pi) => (
              <tr key={pi}>
                <td><Num value={p.start} step={15} width={48}
                  onChange={(v) => up((c) => { c.periods[pi].start = v; })} /></td>
                <td><Num value={p.end} step={15} width={48}
                  onChange={(v) => up((c) => { c.periods[pi].end = v; })} /></td>
                {config.fuels.map((f) => (
                  <td key={f.id}>
                    <Num value={p.arrivals[f.id] ?? 0} width={48}
                      onChange={(v) => up((c) => { c.periods[pi].arrivals[f.id] = v; })} />
                  </td>
                ))}
                <td>
                  <button className="icon-btn" title="删除时段"
                    onClick={() => up((c) => { c.periods.splice(pi, 1); })}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="ghost-btn" onClick={() => up((c) => {
          const last = c.periods[c.periods.length - 1];
          c.periods.push({ start: last ? last.end : 0, end: (last ? last.end : 0) + 60, arrivals: {} });
        })}>+ 添加时段</button>
      </section>

      <section>
        <h2>油枪配置 <small>勾选兼容油品；备用枪由策略动态增开</small></h2>
        {config.pumps.map((p, pi) => (
          <div className="row pump-row" key={p.id}>
            <input className="pump-name" value={p.name}
              onChange={(e) => up((c) => { c.pumps[pi].name = e.target.value; })} />
            {config.fuels.map((f) => (
              <label key={f.id} className="chk" style={{ color: f.color }}>
                <input
                  type="checkbox"
                  checked={p.fuels.includes(f.id)}
                  onChange={(e) => up((c) => {
                    const fuels = c.pumps[pi].fuels;
                    c.pumps[pi].fuels = e.target.checked
                      ? [...fuels, f.id]
                      : fuels.filter((x) => x !== f.id);
                  })}
                />
                {f.name}
              </label>
            ))}
            <select
              value={p.initial_open ? "open" : "reserve"}
              onChange={(e) => up((c) => { c.pumps[pi].initial_open = e.target.value === "open"; })}
            >
              <option value="open">常开</option>
              <option value="reserve">备用</option>
            </select>
            <button className="icon-btn" title="删除油枪"
              onClick={() => up((c) => { c.pumps.splice(pi, 1); })}>✕</button>
          </div>
        ))}
        <button className="ghost-btn" onClick={() => up((c) => {
          c.pumps.push({
            id: `p${Date.now() % 100000}`,
            name: `${c.pumps.length + 1}号枪`,
            fuels: [c.fuels[0]?.id ?? ""],
            initial_open: false,
          });
        })}>+ 添加油枪</button>
      </section>

      <section>
        <h2>疏导策略</h2>
        <div className="grid2">
          <label>增开阈值(辆)
            <Num value={config.policy.open_queue_threshold} min={1}
              onChange={(v) => up((c) => { c.policy.open_queue_threshold = v; })} />
          </label>
          <label>增开等待(分)
            <Num value={config.policy.open_wait_threshold} min={1}
              onChange={(v) => up((c) => { c.policy.open_wait_threshold = v; })} />
          </label>
          <label>空闲关闭(分)
            <Num value={config.policy.close_idle_minutes} min={1}
              onChange={(v) => up((c) => { c.policy.close_idle_minutes = v; })} />
          </label>
          <label>1人照看枪数
            <Num value={config.policy.staff_pump_coverage} min={1}
              onChange={(v) => up((c) => { c.policy.staff_pump_coverage = v; })} />
          </label>
          <label>考核目标(分)
            <Num value={config.policy.wait_target} min={1}
              onChange={(v) => up((c) => { c.policy.wait_target = v; })} />
          </label>
        </div>
      </section>

      <button className="run-btn" disabled={loading} onClick={onRun}>
        {loading ? "模拟中…" : "▶ 运行模拟"}
      </button>
    </div>
  );
}
