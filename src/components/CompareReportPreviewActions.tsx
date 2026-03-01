"use client";

import { CompareReportDriveButton } from "@/components/CompareReportDriveButton";
import { CompareReportEmailButton } from "@/components/CompareReportEmailButton";
import { useMemo, useState } from "react";

const sanitizeFileName = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "carbon-comparison";
};

export function CompareReportPreviewActions({
  schemeId,
  schemeName,
  selectedItems,
  selectedSections,
  defaultReportEmail,
  defaultGoogleDriveFolder,
}: {
  schemeId: string;
  schemeName: string;
  selectedItems: string[];
  selectedSections: string[];
  defaultReportEmail?: string;
  defaultGoogleDriveFolder?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadingPpt, setDownloadingPpt] = useState(false);

  const itemsParam = useMemo(() => selectedItems.join(","), [selectedItems]);
  const sectionsParam = useMemo(() => selectedSections.join(","), [selectedSections]);

  const compareHref = useMemo(() => {
    const params = new URLSearchParams();
    if (itemsParam) params.set("items", itemsParam);
    return `/schemes/${schemeId}/compare?${params.toString()}`;
  }, [itemsParam, schemeId]);

  const pdfHref = useMemo(() => {
    const params = new URLSearchParams();
    if (itemsParam) params.set("items", itemsParam);
    if (sectionsParam) params.set("sections", sectionsParam);
    return `/api/schemes/${schemeId}/compare-pdf?${params.toString()}`;
  }, [itemsParam, schemeId, sectionsParam]);

  const pptHref = useMemo(() => {
    const params = new URLSearchParams();
    if (itemsParam) params.set("items", itemsParam);
    if (sectionsParam) params.set("sections", sectionsParam);
    return `/api/schemes/${schemeId}/compare-pptx?${params.toString()}`;
  }, [itemsParam, schemeId, sectionsParam]);

  const defaultFileName = useMemo(
    () => `${sanitizeFileName(schemeName)}-carbon-comparison.pdf`,
    [schemeName]
  );

  const defaultPptFileName = useMemo(
    () => `${sanitizeFileName(schemeName)}-carbon-comparison.pptx`,
    [schemeName]
  );

  const handleDownload = async (
    href: string,
    defaultName: string,
    promptLabel: string,
    extension: ".pdf" | ".pptx",
    onState: (value: boolean) => void,
    failureMessage: string
  ) => {
    const requestedName = window.prompt(promptLabel, defaultName);
    if (requestedName === null) return;

    let fileName = requestedName.trim() || defaultName;
    if (!fileName.toLowerCase().endsWith(extension)) {
      fileName = `${fileName}${extension}`;
    }

    onState(true);
    try {
      const response = await fetch(href, { method: "GET", credentials: "same-origin" });
      if (!response.ok) {
        const details = (await response.text().catch(() => "")).trim();
        throw new Error(
          details ? `Export failed (${response.status}): ${details}` : `Export failed (${response.status})`
        );
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      const details = error instanceof Error ? error.message : "";
      window.alert(details || failureMessage);
    } finally {
      onState(false);
    }
  };

  return (
    <div className="compare-report-toolbar">
      <div>
        <p className="scheme-kicker">Report preview</p>
        <p className="scheme-muted">Download from here without going back to the comparison page.</p>
      </div>
      <div className="compare-report-toolbar-actions">
        <a className="btn-secondary" href={compareHref}>
          Back to comparison
        </a>
        <button
          className="btn-secondary"
          type="button"
          onClick={() =>
            handleDownload(
              pptHref,
              defaultPptFileName,
              "Save PowerPoint as",
              ".pptx",
              setDownloadingPpt,
              "Unable to download the PowerPoint right now."
            )
          }
          disabled={downloadingPpt || downloading}
        >
          {downloadingPpt ? "Preparing PPT..." : "Download PPT"}
        </button>
        <CompareReportEmailButton
          schemeId={schemeId}
          schemeName={schemeName}
          selectedItems={selectedItems}
          selectedSections={selectedSections}
          defaultRecipients={defaultReportEmail}
        />
        <CompareReportDriveButton
          schemeId={schemeId}
          schemeName={schemeName}
          selectedItems={selectedItems}
          selectedSections={selectedSections}
          defaultFolder={defaultGoogleDriveFolder}
        />
        <button
          className="btn-primary"
          type="button"
          onClick={() =>
            handleDownload(
              pdfHref,
              defaultFileName,
              "Save PDF as",
              ".pdf",
              setDownloading,
              "Unable to download the PDF right now."
            )
          }
          disabled={downloading}
        >
          {downloading ? "Preparing PDF..." : "Download PDF"}
        </button>
      </div>
    </div>
  );
}
