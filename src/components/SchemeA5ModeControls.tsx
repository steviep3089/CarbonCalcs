"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { applyA5AutoUsage, enableManualA5Usage } from "@/app/schemes/[schemeId]/actions";

type ActionState = {
  ok?: boolean;
  error?: string;
};

type SchemeA5ModeControlsProps = {
  schemeId: string;
  fuelMode: string;
  distanceUnit: string;
  hasA5Postcodes: boolean;
  hasUsageEntries: boolean;
};

export function SchemeA5ModeControls({
  schemeId,
  fuelMode,
  distanceUnit,
  hasA5Postcodes,
  hasUsageEntries,
}: SchemeA5ModeControlsProps) {
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [distanceValue, setDistanceValue] = useState("");
  const isAuto = (fuelMode ?? "auto").toLowerCase() !== "manual";
  const [autoTriggered, setAutoTriggered] = useState(false);

  const [autoState, autoAction] = useActionState<ActionState, FormData>(
    async (_prev, formData) => applyA5AutoUsage(schemeId, formData),
    {}
  );
  const [manualState, manualAction] = useActionState<ActionState, FormData>(
    async () => enableManualA5Usage(schemeId),
    {}
  );

  useEffect(() => {
    if (autoState?.ok) {
      setShowAutoModal(false);
      setDistanceValue("");
    }
  }, [autoState?.ok]);

  useEffect(() => {
    if (!isAuto || autoTriggered || hasUsageEntries) return;
    if (!hasA5Postcodes) return;
    const formData = new FormData();
    startTransition(() => {
      autoAction(formData);
      setAutoTriggered(true);
    });
  }, [isAuto, autoTriggered, hasUsageEntries, hasA5Postcodes, autoAction]);

  return (
    <>
      <div className="mode-toggle">
        <button
          type="button"
          className={`mode-toggle-button ${isAuto ? "is-active" : ""}`}
          onClick={() => {
            if (hasA5Postcodes) {
              const formData = new FormData();
              startTransition(() => {
                autoAction(formData);
              });
            } else {
              setShowAutoModal(true);
            }
          }}
        >
          Auto
        </button>
        <form action={manualAction}>
          <button
            className={`mode-toggle-button ${!isAuto ? "is-active" : ""}`}
            type="submit"
            disabled={!isAuto}
          >
            Manual
          </button>
        </form>
      </div>

      {manualState?.error ? (
        <p className="create-scheme-message error">{manualState.error}</p>
      ) : null}
      {manualState?.ok ? (
        <p className="create-scheme-message success">Manual logging enabled.</p>
      ) : null}

      {showAutoModal && !hasA5Postcodes ? (
        <div className="admin-modal">
          <div className="admin-modal-card">
            <h3>Auto transport distance</h3>
            <p className="scheme-muted">
              Enter a single distance (each way) to apply to all transport items,
              or leave blank to auto-calculate from the scheme base and site postcodes.
            </p>
            <form action={autoAction} className="admin-modal-form">
              <label>
                Distance each way ({distanceUnit})
                <input
                  name="distance_km_each_way"
                  type="number"
                  step="0.1"
                  min="0"
                  value={distanceValue}
                  onChange={(event) => setDistanceValue(event.target.value)}
                />
              </label>
              {autoState?.error ? (
                <p className="create-scheme-message error">{autoState.error}</p>
              ) : null}
              <div className="admin-modal-actions">
                <button className="btn-primary" type="submit">
                  Update distance
                </button>
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => setShowAutoModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
