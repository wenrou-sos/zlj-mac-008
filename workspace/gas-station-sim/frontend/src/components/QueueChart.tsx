import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SimConfig, SimResult } from "../types";
import { fmtClock } from "../types";

export default function QueueChart({ result, config }: { result: SimResult; config: SimConfig }) {
  const { times, waiting_by_fuel } = result.series;
  const data = times.map((t, i) => {
    const row: Record<string, number | string> = { t, clock: fmtClock(result.open_time, t) };
    for (const f of config.fuels) row[f.id] = waiting_by_fuel[f.id]?.[i] ?? 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3550" />
        <XAxis
          dataKey="t"
          tickFormatter={(t) => fmtClock(result.open_time, t)}
          stroke="#7c8db0"
          fontSize={12}
        />
        <YAxis allowDecimals={false} stroke="#7c8db0" fontSize={12} />
        <Tooltip
          labelFormatter={(t) => `时刻 ${fmtClock(result.open_time, Number(t))}`}
          contentStyle={{ background: "#141b2e", border: "1px solid #2a3550", borderRadius: 8 }}
        />
        <Legend />
        {config.fuels.map((f) => (
          <Area
            key={f.id}
            type="stepAfter"
            dataKey={f.id}
            name={f.name}
            stackId="q"
            stroke={f.color}
            fill={f.color}
            fillOpacity={0.55}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
