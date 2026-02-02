import type { CompareItem } from "@/components/ScenarioCompareGrid";

const colors = ["#7cd7ff", "#6bd1a8", "#f6c36b", "#f08fb8"];

const toTonnes = (value: number | null) =>
  value && !Number.isNaN(value) ? value / 1000 : 0;

const formatTonnes = (value: number) =>
  new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const stageOrder = ["A1-A3", "A4", "A5"];
const stageLabels: Record<string, string> = {
  "A1-A3": "A1-A3",
  A4: "A4",
  A5: "A5",
};

const getStageTotalTonnes = (item: CompareItem, stage: string) => {
  if (stage === "A1-A3") {
    const a2 = item.lifecycle.find((row) => row.stage === "A2");
    const a3 = item.lifecycle.find((row) => row.stage === "A3");
    const sum = (a2?.total_kgco2e ?? 0) + (a3?.total_kgco2e ?? 0);
    return toTonnes(sum);
  }
  const found = item.lifecycle.find((row) => row.stage === stage);
  return toTonnes(found?.total_kgco2e ?? null);
};

export function ScenarioCompareCharts({ items }: { items: CompareItem[] }) {
  if (!items.length) return null;

  const gridStyle = { "--compare-count": items.length } as React.CSSProperties;

  const stageValues = stageOrder.map((stage) =>
    items.map((item) => getStageTotalTonnes(item, stage))
  );

  return (
    <section className="compare-charts">
      {stageOrder.map((stage, stageIndex) => {
        const maxStageValue = Math.max(
          1,
          ...stageValues[stageIndex].map((value) =>
            Number.isFinite(value) ? value : 0
          )
        );
        return (
        <div key={stage} className="compare-chart">
          <header className="compare-chart-header">
            <div>
              <p className="scheme-kicker">Visualisation</p>
              <h3>{stageLabels[stage]} emissions (tCO2e)</h3>
            </div>
            <div className="compare-chart-legend">
              {items.map((item, index) => (
                <span key={item.id} className="compare-legend-item">
                  <span
                    className="compare-legend-swatch"
                    style={{ background: colors[index % colors.length] }}
                  />
                  {item.title}
                </span>
              ))}
            </div>
          </header>
          <div className="compare-chart-grid totals" style={gridStyle}>
            {items.map((item, itemIndex) => {
              const value = stageValues[stageIndex][itemIndex] ?? 0;
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
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </section>
  );
}
