"use client";

import { useEffect, useState } from "react";

type CompareReportDriveButtonProps = {
  schemeId: string;
  schemeName?: string;
  selectedItems: string[];
  selectedSections: string[];
  defaultFolder?: string;
  buttonClassName?: string;
  buttonLabel?: string;
};

export function CompareReportDriveButton({
  schemeId,
  schemeName,
  selectedItems,
  selectedSections,
  defaultFolder = "",
  buttonClassName = "btn-secondary",
  buttonLabel = "Add to Google Drive",
}: CompareReportDriveButtonProps) {
  const [open, setOpen] = useState(false);
  const [folder, setFolder] = useState(defaultFolder);
  const [includePdf, setIncludePdf] = useState(true);
  const [includePptx, setIncludePptx] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFolder(defaultFolder);
    }
  }, [defaultFolder, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, saving]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!includePdf && !includePptx) {
      setError("Select at least one attachment format.");
      return;
    }

    if (!folder.trim()) {
      setError("Enter a Google Drive folder URL or folder ID.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/schemes/${schemeId}/compare-drive`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folder: folder.trim(),
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
        throw new Error(details || `Drive upload failed (${response.status})`);
      }

      const result = (await response.json()) as {
        folderUrl?: string;
        files?: Array<{ name: string; webViewLink?: string | null }>;
      };

      setOpen(false);
      const fileNames = result.files?.map((file) => file.name).join(", ") || "report files";
      const folderLine = result.folderUrl ? `\nFolder: ${result.folderUrl}` : "";
      window.alert(`Saved to Google Drive: ${fileNames}.${folderLine}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save to Google Drive right now.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className={buttonClassName} type="button" onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>

      {open ? (
        <div className="scheme-modal" onClick={() => (saving ? null : setOpen(false))}>
          <div className="scheme-modal-card compare-report-email-card" onClick={(event) => event.stopPropagation()}>
            <div className="scheme-modal-header">
              <div>
                <p className="scheme-kicker">Google Drive</p>
                <h2>{schemeName ? `Save ${schemeName}` : "Save report to Google Drive"}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving}>
                Close
              </button>
            </div>

            <form className="compare-report-email-form" onSubmit={handleSave}>
              <label className="compare-report-email-field">
                <span>Folder URL or ID</span>
                <input
                  type="text"
                  name="folder"
                  value={folder}
                  onChange={(event) => setFolder(event.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  autoFocus
                />
                <small>Paste a Google Drive folder URL or a folder ID.</small>
              </label>

              <fieldset className="compare-report-email-options">
                <legend>Files to save</legend>
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
                <button className="btn-secondary" type="button" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn-primary" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save to Google Drive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
