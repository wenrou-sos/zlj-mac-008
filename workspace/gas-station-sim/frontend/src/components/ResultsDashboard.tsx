import type { SimConfig, SimResult } from "../types";
import KpiCards from "./KpiCards";
import QueueChart from "./QueueChart";
import StaffChart from "./StaffChart";
import PumpGantt from "./PumpGantt";
import WaitPanel from "./WaitPanel";
import StaffBuckets from "./StaffBuckets";
import EventLog from "./EventLog";

interface Props {
  result: SimResult;
  config: SimConfig;
  prevKpis: Record<string, number> | null;
}

export default function ResultsDashboard({ result, config, prevKpis }: Props) {
  return (
    <div className="dashboard">
      <KpiCards result={result} config={config} prevKpis={prevKpis} />

      {result.recommendations.length > 0 && (
        <section className="card">
          <h3>💡 调度建议</h3>
          <ul className="rec-list">
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      <section className="card">
        <h3>各油品车道排队长度（辆）</h3>
        <QueueChart result={result} config={config} />
      </section>

      <div className="two-col">
        <section className="card">
          <h3>人力负荷 vs 在岗人力</h3>
          <StaffChart result={result} config={config} />
        </section>
        <section className="card">
          <h3>15分钟人力需求与排班</h3>
          <StaffBuckets result={result} />
        </section>
      </div>

      <section className="card">
        <h3>油枪开闭时间线与利用率</h3>
        <PumpGantt result={result} config={config} />
      </section>

      <section className="card">
        <h3>等待时间分布与分油品统计</h3>
        <WaitPanel result={result} config={config} />
      </section>

      <section className="card">
        <h3>事件轨迹（可解释性日志）</h3>
        <EventLog result={result} />
      </section>
    </div>
  );
}
