"use client";

import { useEffect, useState } from "react";

export function CO2SavingsTitleValue({
  initialTonnes,
  hasQuery,
}: {
  initialTonnes: number;
  hasQuery: boolean;
}) {
  const storageKey = "co2SavingsTonnes";
  const [value, setValue] = useState(
    Number.isFinite(initialTonnes) ? initialTonnes : 0
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("" + (Number.isFinite(initialTonnes) ? initialTonnes : 0));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasQuery) {
      window.localStorage.setItem(storageKey, String(initialTonnes));
      setValue(initialTonnes);
      setDraft(String(initialTonnes));
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      setValue(parsed);
      setDraft(String(parsed));
    }
  }, [hasQuery, initialTonnes]);

  const commitDraft = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    setValue(parsed);
    setEditing(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("co2-tonnes-change", { detail: { value: parsed } })
      );
    }
  };

  const formatted = new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return (
    <div className="reports-title-value">
      {editing ? (
        <input
          className="reports-title-value-input"
          type="number"
          step="0.01"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitDraft();
            if (event.key === "Escape") {
              setDraft(String(value));
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="reports-title-value-button"
          onClick={() => setEditing(true)}
        >
          <span className="reports-title-value-number">{formatted}</span>
        </button>
      )}
      <span className="reports-title-value-unit">tonnes</span>
    </div>
  );
}
