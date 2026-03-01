"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CompareItem } from "./ScenarioCompareGrid";

type LayoutEntry = {
  key: string;
  x: number | null;
  y: number | null;
  scale: number | null;
};

type LabelLayout = {
  x: number;
  y: number;
  scale: number;
};

type MarkerDefinition = {
  key: string;
  stage: string;
  label: string;
};

const markerDefinitions: MarkerDefinition[] = [
  { key: "compare-map-A1", stage: "A1", label: "A1" },
  { key: "compare-map-A2", stage: "A2", label: "A2" },
  { key: "compare-map-A3", stage: "A3", label: "A3" },
  { key: "compare-map-A4", stage: "A4", label: "A4" },
  { key: "compare-map-A5", stage: "A5", label: "A5" },
  { key: "compare-map-B1-5", stage: "B1-B5", label: "B1-B5" },
  { key: "compare-map-C1", stage: "C1", label: "C1" },
  { key: "compare-map-C2", stage: "C2", label: "C2" },
  { key: "compare-map-C3", stage: "C3", label: "C3" },
  { key: "compare-map-C4", stage: "C4", label: "C4" },
];

const layoutDefaults: Record<string, LabelLayout> = {
  "compare-map-A1": { x: 18, y: 14, scale: 1 },
  "compare-map-A2": { x: 22, y: 28, scale: 1 },
  "compare-map-A3": { x: 26, y: 40, scale: 1 },
  "compare-map-A4": { x: 31, y: 54, scale: 1 },
  "compare-map-A5": { x: 32, y: 70, scale: 1 },
  "compare-map-B1-5": { x: 60, y: 34, scale: 1 },
  "compare-map-C1": { x: 50, y: 24, scale: 1 },
  "compare-map-C2": { x: 64, y: 34, scale: 1 },
  "compare-map-C3": { x: 61, y: 52, scale: 1 },
  "compare-map-C4": { x: 54, y: 68, scale: 1 },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const formatValue = (value: number | null, digits = 1) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export function ScenarioCompareMap({
  items,
  layouts = [],
  reportOnly = false,
}: {
  items: CompareItem[];
  layouts?: LayoutEntry[];
  reportOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [layoutState, setLayoutState] = useState<Record<string, LabelLayout>>({});
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(
    items[0]?.id ?? null
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!items.length) {
      setActiveItemId(null);
      return;
    }
    if (!activeItemId || !items.some((item) => item.id === activeItemId)) {
      setActiveItemId(items[0].id);
    }
  }, [items, activeItemId]);

  const layoutMap = useMemo(() => {
    const map = new Map<string, LabelLayout>();
    layouts.forEach((entry) => {
      if (!entry?.key) return;
      const fallback = layoutDefaults[entry.key];
      map.set(entry.key, {
        x: Number.isFinite(entry.x as number)
          ? (entry.x as number)
          : fallback?.x ?? 50,
        y: Number.isFinite(entry.y as number)
          ? (entry.y as number)
          : fallback?.y ?? 50,
        scale: Number.isFinite(entry.scale as number)
          ? (entry.scale as number)
          : fallback?.scale ?? 1,
      });
    });

    if (!map.has("compare-map-B1-5")) {
      const legacyKeys = [
        "compare-map-B1",
        "compare-map-B2",
        "compare-map-B3",
        "compare-map-B4",
        "compare-map-B5",
      ];
      const legacyLayouts = legacyKeys
        .map((key) => map.get(key))
        .filter((value): value is LabelLayout => Boolean(value));
      if (legacyLayouts.length) {
        const sum = legacyLayouts.reduce(
          (acc, layout) => ({
            x: acc.x + layout.x,
            y: acc.y + layout.y,
            scale: acc.scale + layout.scale,
          }),
          { x: 0, y: 0, scale: 0 }
        );
        map.set("compare-map-B1-5", {
          x: sum.x / legacyLayouts.length,
          y: sum.y / legacyLayouts.length,
          scale: sum.scale / legacyLayouts.length,
        });
      }
    }
    return map;
  }, [layouts]);

  useEffect(() => {
    setLayoutState((prev) => {
      const next: Record<string, LabelLayout> = { ...prev };
      markerDefinitions.forEach((marker) => {
        if (!next[marker.key]) {
          next[marker.key] = layoutMap.get(marker.key) ?? layoutDefaults[marker.key];
        }
      });
      return next;
    });
  }, [layoutMap]);

  const activeItem = items.find((item) => item.id === activeItemId) ?? null;

  const stagePerTonne = useMemo(() => {
    const map = new Map<string, number | null>();
    if (!activeItem) return map;
    activeItem.lifecycle.forEach((stage) => {
      map.set(stage.stage, stage.kgco2e_per_tonne ?? null);
    });
    return map;
  }, [activeItem]);

  const getStageValue = (stageKey: string) => {
    if (stageKey === "B1-B5") {
      const stages = ["B1", "B2", "B3", "B4", "B5"];
      const values = stages
        .map((stage) => stagePerTonne.get(stage))
        .filter((value): value is number => value !== null && value !== undefined);
      if (!values.length) return null;
      return values.reduce((sum, value) => sum + value, 0);
    }
    return stagePerTonne.get(stageKey) ?? null;
  };

  const handleZoom = (event: React.WheelEvent) => {
    if (reportOnly) return;
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => clamp(Number((prev + delta).toFixed(2)), 0.6, 2.2));
  };

  const toggleFullscreen = async () => {
    if (reportOnly) return;
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (fullscreenRef.current?.requestFullscreen) {
      await fullscreenRef.current.requestFullscreen();
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleDragStart = (key: string, event: React.PointerEvent) => {
    if (reportOnly) return;
    if (!editing) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const container = containerRef.current;
    const layout = layoutState[key];
    if (!container || !layout) return;
    const rect = container.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = layout.x;
    const originY = layout.y;

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const nextX = clamp(originX + (dx / rect.width) * 100, 0, 100);
      const nextY = clamp(originY + (dy / rect.height) * 100, 0, 100);
      setLayoutState((prev) => ({
        ...prev,
        [key]: { ...prev[key], x: nextX, y: nextY },
      }));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const handleResizeStart = (key: string, event: React.PointerEvent) => {
    if (reportOnly) return;
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const container = containerRef.current;
    const layout = layoutState[key];
    if (!container || !layout) return;
    const rect = container.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const originScale = layout.scale;
    const base = Math.min(rect.width, rect.height);

    const handleMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      const delta = Math.max(dx, dy);
      const nextScale = clamp(originScale + delta / base, 0.6, 1.8);
      setLayoutState((prev) => ({
        ...prev,
        [key]: { ...prev[key], scale: nextScale },
      }));
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  const saveLayouts = async () => {
    if (reportOnly) return;
    if (!markerDefinitions.length) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/report-equivalency-layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: markerDefinitions.map((marker) => ({
            key: marker.key,
            x: layoutState[marker.key]?.x ?? layoutDefaults[marker.key].x,
            y: layoutState[marker.key]?.y ?? layoutDefaults[marker.key].y,
            scale:
              layoutState[marker.key]?.scale ?? layoutDefaults[marker.key].scale,
          })),
        }),
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to save layout");
      }
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save layout");
    } finally {
      setSaving(false);
    }
  };

  if (!items.length) {
    return null;
  }

  return (
    <section className={`compare-map-card ${reportOnly ? "is-report-only" : ""}`}>
      {!reportOnly ? (
        <div className="compare-map-header">
          <div>
            <p className="scheme-kicker">Lifecycle map</p>
            <h2>{activeItem?.title ?? "Scenario map"}</h2>
            <p className="compare-map-meta">
              Labels show per-stage totals (tCO2e) for the currently selected scenario.
            </p>
          </div>
          <div className="compare-map-actions">
            <button type="button" className="btn-secondary" onClick={toggleFullscreen}>
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
            <button
              type="button"
              className={`btn-secondary ${editing ? "is-active" : ""}`}
              onClick={() => setEditing((prev) => !prev)}
            >
              {editing ? "Stop editing" : "Edit labels"}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={saveLayouts}
              disabled={!editing || saving}
            >
              {saving ? "Saving..." : "Save layout"}
            </button>
          </div>
        </div>
      ) : null}

      {!reportOnly && saveError ? <p className="create-scheme-message error">{saveError}</p> : null}

      {!reportOnly ? (
        <div className="compare-map-selection">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`btn-secondary ${activeItemId === item.id ? "is-active" : ""}`}
              onClick={() => setActiveItemId(item.id)}
            >
              {item.title}
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={fullscreenRef}
        className={`compare-map-wrap ${isFullscreen ? "is-fullscreen" : ""} ${
          reportOnly ? "is-report-only" : ""
        }`}
        onWheel={handleZoom}
      >
        <div
          className="compare-map-zoom"
          style={{
            transform: reportOnly ? "translateX(1.3%) scale(1.03)" : `scale(${zoom})`,
          }}
        >
          <img
            src="/neils-map.png"
            alt="Carbon life-cycle map"
            className="compare-map-image"
          />
          <div
            ref={containerRef}
            className={`compare-map-layer ${editing ? "is-editing" : ""}`}
          >
            {markerDefinitions.map((marker) => {
              const layout = layoutState[marker.key] ?? layoutDefaults[marker.key];
              const value =
                marker.stage === "A1"
                  ? activeItem?.a1Factor ?? null
                  : getStageValue(marker.stage);
              const digits = 2;
              return (
                <div
                  key={marker.key}
                  className="compare-map-label"
                  style={{
                    left: `${layout.x}%`,
                    top: reportOnly ? `calc(${layout.y}% + 12px)` : `${layout.y}%`,
                    transform: `translate(-50%, -100%) scale(${
                      reportOnly ? layout.scale * 0.62 : layout.scale
                    })`,
                    transformOrigin: "50% 100%",
                    pointerEvents: editing && !reportOnly ? "auto" : "none",
                    cursor: editing && !reportOnly ? "move" : "default",
                    touchAction: "none",
                  }}
                  onPointerDown={(event) => handleDragStart(marker.key, event)}
                >
                  <span
                    className={`compare-map-label-stage ${
                      marker.stage === "A1" ? "is-a1" : ""
                    }`}
                  >
                    {marker.label}
                  </span>
                  <span className="compare-map-label-value">
                    {formatValue(value, digits)}
                  </span>
                  <span
                    className="reports-equivalency-handle"
                    onPointerDown={(event) => handleResizeStart(marker.key, event)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
