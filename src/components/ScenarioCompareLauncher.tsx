"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ScenarioOption = {
  id: string;
  label: string | null;
};

type ScenarioCompareLauncherProps = {
  schemeId: string;
  scenarios: ScenarioOption[];
};

export function ScenarioCompareLauncher({
  schemeId,
  scenarios,
}: ScenarioCompareLauncherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(["live"]);
  const [error, setError] = useState<string | null>(null);

  const scenarioOptions = useMemo(
    () =>
      scenarios.map((scenario, index) => ({
        id: scenario.id,
        label: scenario.label?.trim() || `Scenario ${index + 1}`,
      })),
    [scenarios]
  );

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    if (selected.length < 2) {
      setError("Select at least 2 items to compare.");
      return;
    }
    if (selected.length > 4) {
      setError("Select up to 4 items.");
      return;
    }
    const ordered = ["live", ...scenarioOptions.map((s) => s.id)].filter((id) =>
      selected.includes(id)
    );
    router.push(
      `/schemes/${schemeId}/compare?items=${encodeURIComponent(ordered.join(","))}`
    );
    setOpen(false);
  };

  return (
    <>
      <button className="btn-secondary" type="button" onClick={() => setOpen(true)}>
        Run comparison
      </button>
      {open ? (
        <div className="scheme-modal">
          <div className="scheme-modal-card">
            <div className="scheme-modal-header">
              <h3>Compare scenarios</h3>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <p className="scheme-muted">
              Pick 2–4 options to compare. Live scheme is the current working data.
            </p>
            <div className="scheme-modal-list">
              <label className="scheme-modal-option">
                <input
                  type="checkbox"
                  checked={selected.includes("live")}
                  onChange={() => toggleSelection("live")}
                />
                <span>Live scheme</span>
              </label>
              {scenarioOptions.map((scenario) => (
                <label key={scenario.id} className="scheme-modal-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(scenario.id)}
                    onChange={() => toggleSelection(scenario.id)}
                  />
                  <span>{scenario.label}</span>
                </label>
              ))}
            </div>
            {error ? <p className="scheme-error">{error}</p> : null}
            <div className="scheme-modal-actions">
              <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn-primary" type="button" onClick={handleConfirm}>
                Compare
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
