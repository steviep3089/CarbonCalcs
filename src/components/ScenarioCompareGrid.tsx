"use client";

import { useState } from "react";

type LifecycleDetail = {
  label: string;
  mix: string;
  total_kgco2e: number | null;
  kgco2e_per_tonne: number | null;
};

type LifecycleStage = {
  stage: string;
  description: string;
  total_kgco2e: number | null;
  kgco2e_per_tonne: number | null;
  details: LifecycleDetail[];
};

export type CompareItem = {
  id: string;
  title: string;
  subtitle: string;
  summary_total: number | null;
  summary_per_tonne: number | null;
  narrative: string;
  bullets: string[];
  lifecycle: LifecycleStage[];
};

const formatNumber = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export function ScenarioCompareGrid({ items }: { items: CompareItem[] }) {
  const [view, setView] = useState<"narrative" | "summary">("narrative");

  return (
    <div className="compare-wrapper">
      <div className="compare-toggle">
        <button
          type="button"
          className={`btn-secondary ${view === "narrative" ? "is-active" : ""}`}
          onClick={() => setView("narrative")}
        >
          Narrative
        </button>
        <button
          type="button"
          className={`btn-secondary ${view === "summary" ? "is-active" : ""}`}
          onClick={() => setView("summary")}
        >
          Summary
        </button>
      </div>
      <div className="compare-grid">
        {items.map((item) => (
          <section key={item.id} className="scheme-card compare-card">
            <div className="compare-card-header">
              <div>
                <p className="scheme-kicker">{item.subtitle}</p>
                <h2>{item.title}</h2>
              </div>
              <div className="compare-card-totals">
                <div>
                  <span>Total kgCO2e</span>
                  <strong>{formatNumber(item.summary_total, 2)}</strong>
                </div>
                <div>
                  <span>kgCO2e / tonne</span>
                  <strong>{formatNumber(item.summary_per_tonne, 2)}</strong>
                </div>
              </div>
            </div>

            {view === "narrative" ? (
              <p className="compare-narrative">{item.narrative}</p>
            ) : (
              <ul className="compare-bullets">
                {item.bullets.map((bullet, index) => (
                  <li key={index}>{bullet}</li>
                ))}
              </ul>
            )}

            <div className="lifecycle-grid">
              <div className="lifecycle-header">
                <span>Stage</span>
                <span>Description</span>
                <span className="lifecycle-right">kgCO2e</span>
                <span className="lifecycle-right">kgCO2e / t</span>
              </div>
              {item.lifecycle.map((stage) => (
                <details key={stage.stage} className="lifecycle-card">
                  <summary className="lifecycle-summary">
                    <div className="lifecycle-stage">
                      <span className="lifecycle-badge">{stage.stage}</span>
                    </div>
                    <span className="lifecycle-desc">{stage.description}</span>
                    <span className="lifecycle-right">
                      {formatNumber(stage.total_kgco2e, 2)}
                    </span>
                    <span className="lifecycle-right">
                      {formatNumber(stage.kgco2e_per_tonne, 2)}
                    </span>
                  </summary>
                  {stage.details.length ? (
                    <div className="lifecycle-details">
                      <div className="lifecycle-detail-head">
                        <span>Product</span>
                        <span>Mix</span>
                        <span className="lifecycle-right">kgCO2e</span>
                        <span className="lifecycle-right">kgCO2e / t</span>
                      </div>
                      {stage.details.map((detail, index) => (
                        <div
                          key={`${stage.stage}-${index}`}
                          className="lifecycle-detail-row"
                        >
                          <span>{detail.label}</span>
                          <span>{detail.mix}</span>
                          <span className="lifecycle-right">
                            {formatNumber(detail.total_kgco2e, 2)}
                          </span>
                          <span className="lifecycle-right">
                            {formatNumber(detail.kgco2e_per_tonne, 2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </details>
              ))}
              {!item.lifecycle.length ? (
                <div className="compare-empty">
                  No lifecycle totals stored for this snapshot yet. Go back and click
                  “Update scenario” to capture calculations.
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
