"use client";

import { CompareReportDriveButton } from "@/components/CompareReportDriveButton";
import { CompareReportEmailButton } from "@/components/CompareReportEmailButton";
import { useMemo, useState } from "react";

type SectionOption = {
  key: string;
  label: string;
  defaultChecked?: boolean;
};

const sectionOptions: SectionOption[] = [
  { key: "cards", label: "Comparison cards", defaultChecked: true },
  { key: "graph-a1a3", label: "Graph: A1-A3", defaultChecked: true },
  { key: "graph-a4", label: "Graph: A4", defaultChecked: true },
  { key: "graph-a5", label: "Graph: A5", defaultChecked: true },
  { key: "graph-a1a5", label: "Graph: A1-A5", defaultChecked: true },
  { key: "recycled", label: "Recycled chart + sign", defaultChecked: true },
  { key: "map", label: "Lifecycle map", defaultChecked: true },
  { key: "co2", label: "CO2 savings image", defaultChecked: true },
];

export function CompareReportRunner({
  schemeId,
  schemeName,
  selectedItems,
  defaultReportEmail,
  defaultGoogleDriveFolder,
}: {
  schemeId: string;
  schemeName?: string;
  selectedItems: string[];
  defaultReportEmail?: string;
  defaultGoogleDriveFolder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<string[]>(
    sectionOptions.filter((option) => option.defaultChecked).map((option) => option.key)
  );

  const sectionParam = useMemo(() => checked.join(","), [checked]);
  const itemsParam = useMemo(() => selectedItems.join(","), [selectedItems]);
  const defaultSections =
    "cards,graph-a1a3,graph-a4,graph-a5,graph-a1a5,recycled,map,co2";

  const buildReportHref = (autoPrint = false) => {
    const params = new URLSearchParams();
    if (itemsParam) params.set("items", itemsParam);
    params.set("report", "1");
    params.set("sections", sectionParam || defaultSections);
    if (autoPrint) params.set("autoprint", "1");
    return `/schemes/${schemeId}/compare?${params.toString()}`;
  };

  const buildPdfHref = () => {
    const params = new URLSearchParams();
    if (itemsParam) params.set("items", itemsParam);
    params.set("sections", sectionParam || defaultSections);
    return `/api/schemes/${schemeId}/compare-pdf?${params.toString()}`;
  };

  const buildPptHref = () => {
    const params = new URLSearchParams();
    if (itemsParam) params.set("items", itemsParam);
    params.set("sections", sectionParam || defaultSections);
    return `/api/schemes/${schemeId}/compare-pptx?${params.toString()}`;
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
            <a className="btn-primary" href={buildPdfHref()} target="_blank" rel="noreferrer">
              Download PDF
            </a>
            <a className="btn-secondary" href={buildPptHref()} target="_blank" rel="noreferrer">
              Download PPT
            </a>
            <CompareReportDriveButton
              schemeId={schemeId}
              schemeName={schemeName}
              selectedItems={selectedItems}
              selectedSections={checked}
              defaultFolder={defaultGoogleDriveFolder}
            />
            <CompareReportEmailButton
              schemeId={schemeId}
              schemeName={schemeName}
              selectedItems={selectedItems}
              selectedSections={checked}
              defaultRecipients={defaultReportEmail}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
