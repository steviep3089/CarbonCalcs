import type { CompareItem } from "@/components/ScenarioCompareGrid";
import type { CSSProperties } from "react";

const colors = ["#7cd7ff", "#6bd1a8", "#f6c36b", "#f08fb8", "#9ea8ff"];

const formatPercent = (value: number | null, digits = 1) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export function ScenarioCompareRecycledSection({ items }: { items: CompareItem[] }) {
  if (!items.length) return null;

  const recycledValues = items.map((item) =>
    item.recycledPct !== null && item.recycledPct !== undefined && Number.isFinite(item.recycledPct)
      ? item.recycledPct
      : 0
  );

  const maxRecycled = Math.max(1, ...recycledValues);

  const perTonneValues = items
    .map((item) => item.summary_per_tonne)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  const highestPerTonne = perTonneValues.length ? Math.max(...perTonneValues) : null;
  const lowestPerTonne = perTonneValues.length ? Math.min(...perTonneValues) : null;

  const savingPct =
    highestPerTonne !== null &&
    lowestPerTonne !== null &&
    highestPerTonne > 0
      ? ((highestPerTonne - lowestPerTonne) / highestPerTonne) * 100
      : null;

  const savingLabel = savingPct !== null ? `${formatPercent(savingPct)}%` : "-";

  const gridStyle = { "--compare-count": items.length } as CSSProperties;

  return (
    <section className="compare-recycled-section">
      <div className="compare-chart compare-recycled-chart">
        <header className="compare-chart-header">
          <div>
            <h3>Recycled material content (%)</h3>
          </div>
        </header>

        <div className="compare-chart-grid totals" style={gridStyle}>
          {items.map((item, index) => {
            const value = recycledValues[index] ?? 0;
            const height = Math.max(6, (value / maxRecycled) * 100);

            return (
              <div key={item.id} className="compare-chart-group">
                <div className="compare-chart-bars">
                  <div className="compare-chart-bar compare-chart-bar-short">
                    <div className="compare-chart-bar-slot">
                      <span
                        className="compare-chart-bar-fill"
                        style={{
                          height: `${height}%`,
                          background: colors[index % colors.length],
                        }}
                        title={`${item.title}: ${formatPercent(value)}% recycled`}
                      />
                    </div>
                    <span className="compare-chart-bar-value">
                      {value ? `${formatPercent(value)}%` : "-"}
                    </span>
                  </div>
                </div>
                <span className="compare-chart-label">{item.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="compare-recycled-panel">
        <img
          src="/branding/recycle.png"
          alt="Recycled comparison"
          className="compare-recycled-image"
        />
        <div className="compare-recycled-overlay">
          <span>CO2e/t saving</span>
          <strong>{savingLabel}</strong>
        </div>
      </div>
    </section>
  );
}
