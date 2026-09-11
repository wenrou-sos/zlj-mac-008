import {
  Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SimConfig, SimResult } from "../types";
import { fmtClock } from "../types";

export default function StaffChart({ result }: { result: SimResult; config: SimConfig }) {
  const { times, active_services, staff_capacity, open_pumps } = result.series;
  const data = times.map((t, i) => ({
    t,
    服务中: active_services[i],
    人力上限: staff_capacity[i],
    开启油枪: open_pumps[i],
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" />
        <XAxis dataKey="t" tickFormatter={(t) => fmtClock(result.open_time, t)} stroke="#7c8db0" fontSize={12} />
        <YAxis allowDecimals={false} stroke="#7c8db0" fontSize={12} />
        <Tooltip
          labelFormatter={(t) => `时刻 ${fmtClock(result.open_time, Number(t))}`}
          contentStyle={{ background: "#141b2e", border: "1px solid #2a3550", borderRadius: 8 }}
        />
        <Legend />
        <Area type="stepAfter" dataKey="服务中" stroke="#4ade80" fill="#4ade80" fillOpacity={0.35} isAnimationActive={false} />
        <Line type="stepAfter" dataKey="人力上限" stroke="#f87171" strokeDasharray="6 4" dot={false} isAnimationActive={false} />
        <Line type="stepAfter" dataKey="开启油枪" stroke="#94a3b8" strokeDasharray="2 4" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
