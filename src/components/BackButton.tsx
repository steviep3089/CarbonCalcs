"use client";

export function BackButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => window.history.back()}
    >
      {label}
    </button>
  );
}
