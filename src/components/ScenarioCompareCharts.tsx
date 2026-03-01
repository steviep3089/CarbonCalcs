import type { CompareItem } from "@/components/ScenarioCompareGrid";

const colors = ["#7cd7ff", "#6bd1a8", "#f6c36b", "#f08fb8"];
export type CompareChartStage = "A1-A3" | "A4" | "A5" | "A1-A5";

const toTonnes = (value: number | null) =>
  value && !Number.isNaN(value) ? value / 1000 : 0;

const formatTonnes = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const stageOrder: CompareChartStage[] = ["A1-A3", "A4", "A5"];
const stageLabels: Record<CompareChartStage, string> = {
  "A1-A3": "A1-A3",
  A4: "A4",
  A5: "A5",
  "A1-A5": "A1-A5",
};

const getStageTotalTonnes = (item: CompareItem, stage: CompareChartStage) => {
  if (stage === "A1-A3") {
    const a2 = item.lifecycle.find((row) => row.stage === "A2");
    const a3 = item.lifecycle.find((row) => row.stage === "A3");
    const sum = (a2?.total_kgco2e ?? 0) + (a3?.total_kgco2e ?? 0);
    return toTonnes(sum);
  }
  if (stage === "A1-A5") {
    const a2 = item.lifecycle.find((row) => row.stage === "A2");
    const a3 = item.lifecycle.find((row) => row.stage === "A3");
    const a4 = item.lifecycle.find((row) => row.stage === "A4");
    const a5 = item.lifecycle.find((row) => row.stage === "A5");
    const sum =
      (a2?.total_kgco2e ?? 0) +
      (a3?.total_kgco2e ?? 0) +
      (a4?.total_kgco2e ?? 0) +
      (a5?.total_kgco2e ?? 0);
    return toTonnes(sum);
  }
  const found = item.lifecycle.find((row) => row.stage === stage);
  return toTonnes(found?.total_kgco2e ?? null);
};

export function ScenarioCompareStageChart({
  items,
  stage,
}: {
  items: CompareItem[];
  stage: CompareChartStage;
}) {
  if (!items.length) return null;

  const gridStyle = { "--compare-count": items.length } as React.CSSProperties;
  const values = items.map((item) => getStageTotalTonnes(item, stage));
  const maxStageValue = Math.max(
    1,
    ...values.map((value) => (Number.isFinite(value) ? value : 0))
  );

  return (
    <div className="compare-chart">
      <header className="compare-chart-header">
        <div>
          <h3>{stageLabels[stage]} emissions (tCO2e)</h3>
        </div>
      </header>
      <div className="compare-chart-grid totals" style={gridStyle}>
        {items.map((item, itemIndex) => {
          const value = values[itemIndex] ?? 0;
          const height = Math.max(6, (value / maxStageValue) * 100);
          return (
            <div key={item.id} className="compare-chart-group">
              <div className="compare-chart-bars">
                <div className="compare-chart-bar">
                  <div className="compare-chart-bar-slot">
                    <span
                      className="compare-chart-bar-fill"
                      style={{
                        height: `${height}%`,
                        background: colors[itemIndex % colors.length],
                      }}
                      title={`${item.title}: ${formatTonnes(value)} t`}
                    />
                  </div>
                  <span className="compare-chart-bar-value">
                    {value ? formatTonnes(value) : "-"}
                  </span>
                </div>
              </div>
              <span className="compare-chart-label">{item.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ScenarioCompareCharts({ items }: { items: CompareItem[] }) {
  if (!items.length) return null;

  return (
    <section className="compare-charts">
      {stageOrder.map((stage) => (
        <ScenarioCompareStageChart key={stage} items={items} stage={stage} />
      ))}
    </section>
  );
}
