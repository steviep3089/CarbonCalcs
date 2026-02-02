"use client";

import { useActionState } from "react";

type ActionState = {
  ok?: boolean;
  error?: string;
};

type SchemeModeToggleProps = {
  mode: string;
  onAuto: () => Promise<ActionState>;
  onManual: () => Promise<ActionState>;
  autoLabel?: string;
  manualLabel?: string;
  className?: string;
  showMessages?: boolean;
};

export function SchemeModeToggle({
  mode,
  onAuto,
  onManual,
  autoLabel = "Auto",
  manualLabel = "Manual",
  className,
  showMessages = true,
}: SchemeModeToggleProps) {
  const isAuto = (mode ?? "auto").toLowerCase() !== "manual";
  const [autoState, autoAction] = useActionState<ActionState, FormData>(
    async () => onAuto(),
    {}
  );
  const [manualState, manualAction] = useActionState<ActionState, FormData>(
    async () => onManual(),
    {}
  );
  const error = autoState?.error ?? manualState?.error;
  const success = autoState?.ok || manualState?.ok;

  return (
    <>
      <div className={`mode-toggle ${className ?? ""}`}>
        <form action={autoAction}>
          <button
            className={`mode-toggle-button ${isAuto ? "is-active" : ""}`}
            type="submit"
            disabled={isAuto}
          >
            {autoLabel}
          </button>
        </form>
        <form action={manualAction}>
          <button
            className={`mode-toggle-button ${!isAuto ? "is-active" : ""}`}
            type="submit"
            disabled={!isAuto}
          >
            {manualLabel}
          </button>
        </form>
      </div>
      {showMessages && error ? (
        <p className="create-scheme-message error">{error}</p>
      ) : null}
      {showMessages && success ? (
        <p className="create-scheme-message success">Mode updated.</p>
      ) : null}
    </>
  );
}
