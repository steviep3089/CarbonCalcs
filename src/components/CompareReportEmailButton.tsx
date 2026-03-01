"use client";

import { useEffect, useState } from "react";

type CompareReportEmailButtonProps = {
  schemeId: string;
  schemeName?: string;
  selectedItems: string[];
  selectedSections: string[];
  defaultRecipients?: string;
  buttonClassName?: string;
  buttonLabel?: string;
};

export function CompareReportEmailButton({
  schemeId,
  schemeName,
  selectedItems,
  selectedSections,
  defaultRecipients = "",
  buttonClassName = "btn-secondary",
  buttonLabel = "Email report",
}: CompareReportEmailButtonProps) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState(defaultRecipients);
  const [includePdf, setIncludePdf] = useState(true);
  const [includePptx, setIncludePptx] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRecipients(defaultRecipients);
    }
  }, [defaultRecipients, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sending) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, sending]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedRecipients = recipients.trim();
    if (!trimmedRecipients) {
      setError("Enter at least one email address.");
      return;
    }

    if (!includePdf && !includePptx) {
      setError("Select at least one attachment format.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/schemes/${schemeId}/compare-email`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: trimmedRecipients,
          items: selectedItems,
          sections: selectedSections,
          attachments: {
            pdf: includePdf,
            pptx: includePptx,
          },
        }),
      });

      if (!response.ok) {
        const details = (await response.text().catch(() => "")).trim();
        throw new Error(details || `Email failed (${response.status})`);
      }

      const result = (await response.json().catch(() => null)) as
        | {
            accepted?: string[];
            rejected?: string[];
            response?: string;
            messageId?: string;
          }
        | null;
      setOpen(false);
      const accepted = result?.accepted?.length ? result.accepted.join(", ") : trimmedRecipients;
      const responseLine = result?.response ? `\nSMTP: ${result.response}` : "";
      window.alert(`Report handed to SMTP for: ${accepted}.${responseLine}`);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send the report right now.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button className={buttonClassName} type="button" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>

      {open ? (
        <div className="scheme-modal" onClick={() => (sending ? null : setOpen(false))}>
          <div className="scheme-modal-card compare-report-email-card" onClick={(event) => event.stopPropagation()}>
            <div className="scheme-modal-header">
              <div>
                <p className="scheme-kicker">Email report</p>
                <h2>{schemeName ? `Send ${schemeName}` : "Send comparison report"}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={sending}>
                Close
              </button>
            </div>

            <form className="compare-report-email-form" onSubmit={handleSend}>
              <label className="compare-report-email-field">
                <span>Recipients</span>
                <input
                  type="text"
                  name="recipients"
                  value={recipients}
                  onChange={(event) => setRecipients(event.target.value)}
                  placeholder="name@example.com, second@example.com"
                  autoFocus
                />
                <small>Use commas or semicolons for multiple recipients.</small>
              </label>

              <fieldset className="compare-report-email-options">
                <legend>Attachments</legend>
                <label className="compare-report-email-option">
                  <input
                    type="checkbox"
                    checked={includePdf}
                    onChange={(event) => setIncludePdf(event.target.checked)}
                  />
                  <span>PDF</span>
                </label>
                <label className="compare-report-email-option">
                  <input
                    type="checkbox"
                    checked={includePptx}
                    onChange={(event) => setIncludePptx(event.target.checked)}
                  />
                  <span>PPTX</span>
                </label>
              </fieldset>

              {error ? <p className="scheme-error">{error}</p> : null}

              <div className="scheme-modal-actions">
                <button className="btn-secondary" type="button" onClick={() => setOpen(false)} disabled={sending}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={sending}>
                  {sending ? "Sending..." : "Send report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
