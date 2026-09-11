import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SimConfig, SimResult } from "../types";

export default function WaitPanel({ result, config }: { result: SimResult; config: SimConfig }) {
  const hist = result.wait_histogram.map((b) => ({
    range: `${b.lo}–${b.hi}分`,
    车辆数: b.count,
  }));

  return (
    <div className="two-col">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={hist} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" />
          <XAxis dataKey="range" stroke="#7c8db0" fontSize={11} />
          <YAxis allowDecimals={false} stroke="#7c8db0" fontSize={12} />
          <Tooltip contentStyle={{ background: "#141b2e", border: "1px solid #2a3550", borderRadius: 8 }} />
          <Bar dataKey="车辆数" fill="#38bdf8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <table className="stats-table">
        <thead>
          <tr><th>油品</th><th>服务数</th><th>平均</th><th>P50</th><th>P95</th><th>最长</th><th>未服务</th></tr>
        </thead>
        <tbody>
          {config.fuels.map((f) => {
            const s = result.wait_by_fuel[f.id];
            if (!s) return null;
            const over = s.p95 > config.policy.wait_target;
            return (
              <tr key={f.id} className={over ? "row-warn" : ""}>
                <td><i className="dot" style={{ background: f.color }} />{f.name}</td>
                <td>{s.count}</td>
                <td>{s.avg}分</td>
                <td>{s.p50}分</td>
                <td>{s.p95}分{over ? " ⚠" : ""}</td>
                <td>{s.max}分</td>
                <td>{s.unserved ?? 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
