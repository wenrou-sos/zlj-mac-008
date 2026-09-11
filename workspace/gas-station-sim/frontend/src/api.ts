import type { Preset, SimConfig, SimResult } from "./types";

const BASE = "/api";

export async function fetchPresets(): Promise<Preset[]> {
  const r = await fetch(`${BASE}/presets`);
  if (!r.ok) throw new Error(`加载预设失败: ${r.status}`);
  return r.json();
}

export async function runSimulate(cfg: SimConfig): Promise<SimResult> {
  const r = await fetch(`${BASE}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  if (!r.ok) {
    const detail = await r.json().catch(() => null);
    throw new Error(detail?.detail ?? `仿真失败: ${r.status}`);
  }
  return r.json();
}
