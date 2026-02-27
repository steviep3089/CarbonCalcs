"use client";

import { useMemo, useState } from "react";

type SectionOption = {
  key: string;
  label: string;
  defaultChecked?: boolean;
};

const sectionOptions: SectionOption[] = [
  { key: "cards", label: "Comparison cards", defaultChecked: true },
  { key: "graphs", label: "Existing graphs", defaultChecked: true },
  { key: "recycled", label: "Recycled chart + sign", defaultChecked: true },
  { key: "map", label: "Lifecycle map", defaultChecked: true },
  { key: "co2", label: "CO2 savings image", defaultChecked: true },
];

export function CompareReportRunner({
  schemeId,
  selectedItems,
}: {
  schemeId: string;
  selectedItems: string[];
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>(
    sectionOptions.filter((option) => option.defaultChecked).map((option) => option.key)
  );

  const sectionParam = useMemo(() => checked.join(","), [checked]);
  const itemsParam = useMemo(() => selectedItems.join(","), [selectedItems]);

  const buildReportHref = (autoPrint = false) => {
    const params = new URLSearchParams();
    if (itemsParam) params.set("items", itemsParam);
    params.set("report", "1");
    params.set("sections", sectionParam || "cards,graphs,recycled,map,co2");
    if (autoPrint) params.set("autoprint", "1");
    return `/schemes/${schemeId}/compare?${params.toString()}`;
  };

  const toggle = (key: string) => {
    setChecked((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  return (
    <div className="compare-report-runner">
      <button className="btn-secondary" type="button" onClick={() => setOpen((v) => !v)}>
        Run reports
      </button>

      {open ? (
        <div className="compare-report-menu">
          <p className="scheme-muted">Select sections for report output.</p>
          <div className="compare-report-options">
            {sectionOptions.map((option) => (
              <label key={option.key} className="compare-report-option">
                <input
                  type="checkbox"
                  checked={checked.includes(option.key)}
                  onChange={() => toggle(option.key)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <div className="compare-report-actions">
            <a className="btn-secondary" href={buildReportHref(false)} target="_blank" rel="noreferrer">
              Preview
            </a>
            <a className="btn-primary" href={buildReportHref(true)} target="_blank" rel="noreferrer">
              Download PDF
            </a>
            <button className="btn-secondary" type="button" disabled title="Coming next phase">
              Download PPT
            </button>
            <button className="btn-secondary" type="button" disabled title="Coming next phase">
              Email report
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
