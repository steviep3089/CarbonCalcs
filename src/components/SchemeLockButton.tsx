"use client";

import { lockScheme } from "@/app/schemes/[schemeId]/actions";

type SchemeLockButtonProps = {
  schemeId: string;
  locked: boolean;
};

export function SchemeLockButton({ schemeId, locked }: SchemeLockButtonProps) {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.stopPropagation();
    if (locked) {
      event.preventDefault();
      return;
    }
    if (!window.confirm("Permanently lock this scheme and its contents?")) {
      event.preventDefault();
    }
  };

  return (
    <form
      className="scheme-lock-form"
      action={lockScheme.bind(null, schemeId)}
      onSubmit={handleSubmit}
    >
      <button
        type="submit"
        className={`scheme-lock-button ${locked ? "is-locked" : "is-open"}`}
        disabled={locked}
        aria-label={locked ? "Scheme is locked" : "Lock scheme"}
        title={locked ? "Scheme locked" : "Lock scheme"}
      >
        <span className="scheme-lock-icon" aria-hidden="true">
          {locked ? (
            <svg viewBox="0 0 24 24" role="presentation">
              <path
                d="M7 10V7a5 5 0 0 1 10 0v3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="5"
                y="10"
                width="14"
                height="10"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" role="presentation">
              <path
                d="M15 10V7a5 5 0 0 0-9-3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="5"
                y="10"
                width="14"
                height="10"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          )}
        </span>
        <span className="scheme-lock-text">{locked ? "Locked" : "Open"}</span>
      </button>
    </form>
  );
}
