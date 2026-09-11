import type { SimResult } from "../types";
import { fmtClock } from "../types";

/** 15 分钟粒度人力需求热力条：红色 = 需求超过在编，需要机动班 */
export default function StaffBuckets({ result }: { result: SimResult }) {
  const maxNeed = Math.max(1, ...result.staff_buckets.map((b) => b.required));
  return (
    <div>
      <div className="bucket-row">
        {result.staff_buckets.map((b, i) => {
          const short = b.required > b.scheduled;
          return (
            <div key={i} className="bucket-cell" title={
              `${fmtClock(result.open_time, b.start)}–${fmtClock(result.open_time, b.end)}：` +
              `需要 ${b.required} 人 / 在编 ${b.scheduled} 人`
            }>
              <div
                className={`bucket-bar ${short ? "bucket-short" : ""}`}
                style={{ height: `${(b.required / maxNeed) * 72 + 4}px` }}
              />
              <div className="bucket-label">{fmtClock(result.open_time, b.start)}</div>
            </div>
          );
        })}
      </div>
      <div className="legend-line">
        <span><i className="swatch sw-ok" /> 需求 ≤ 在编({result.staff_buckets[0]?.scheduled}人)</span>
        <span><i className="swatch sw-short" /> 人力缺口（建议机动班）</span>
      </div>
    </div>
  );
}
