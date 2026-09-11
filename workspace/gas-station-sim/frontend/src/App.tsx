import { useEffect, useState } from "react";
import { fetchPresets, runSimulate } from "./api";
import type { Preset, SimConfig, SimResult } from "./types";
import ConfigPanel from "./components/ConfigPanel";
import ResultsDashboard from "./components/ResultsDashboard";

export default function App() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [config, setConfig] = useState<SimConfig | null>(null);
  const [result, setResult] = useState<SimResult | null>(null);
  const [prevKpis, setPrevKpis] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPresets()
      .then((ps) => {
        setPresets(ps);
        if (ps.length > 0) setConfig(ps[0].config);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const loadPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (p) setConfig(structuredClone(p.config));
  };

  const run = async () => {
    if (!config) return;
    setLoading(true);
    setError(null);
    try {
      const r = await runSimulate(config);
      setPrevKpis(result?.kpis ?? null);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>⛽ 加油站高峰车道疏导模拟器</h1>
        <p>离散事件模拟 · 油品车道分流 · 备用油枪动态增开 · 员工调度建议</p>
      </header>
      <div className="layout">
        <aside className="sidebar">
          {config ? (
            <ConfigPanel
              config={config}
              presets={presets}
              loading={loading}
              onChange={setConfig}
              onLoadPreset={loadPreset}
              onRun={run}
            />
          ) : (
            <div className="muted">正在加载预设…</div>
          )}
          {error && <div className="error-box">⚠ {error}</div>}
        </aside>
        <main className="content">
          {result ? (
            <ResultsDashboard result={result} config={config!} prevKpis={prevKpis} />
          ) : (
            <div className="empty-state">
              <div className="empty-icon">⛽</div>
              <p>在左侧配置时段车流、油枪与员工，点击「运行模拟」查看排队演化与调度建议</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
