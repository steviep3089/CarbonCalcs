"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ReportMetric = {
  id: string;
  label: string;
  unit: string | null;
  value: number | null;
  calc_op?: string | null;
  calc_factor?: number | null;
  source: string | null;
};

type ReportLayout = {
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

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const normalized =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(normalized) ? normalized : null;
};

const toTonnes = (value: number | null, unit: string | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const normalized = (unit ?? "").toLowerCase();
  if (normalized === "g") return value / 1_000_000;
  if (normalized === "kg") return value / 1000;
  if (normalized === "tonnes") return value;
  return value;
};

const applyCalc = (
  base: number | null,
  op: string | null | undefined,
  factor: number | null | undefined
) => {
  if (base === null || base === undefined || Number.isNaN(base)) return null;
  if (factor === null || factor === undefined || Number.isNaN(factor)) return base;
  switch ((op ?? "").toLowerCase()) {
    case "+":
      return base + factor;
    case "-":
      return base - factor;
    case "x":
    case "*":
      return base * factor;
    case "/":
      return factor === 0 ? null : base / factor;
    default:
      return base;
  }
};

const formatNumber = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export function CO2SavingsView({
  initialTonnes,
  hasQuery,
  equivalencies,
  savings,
  layouts,
}: {
  initialTonnes: number;
  hasQuery: boolean;
  equivalencies: ReportMetric[];
  savings: ReportMetric[];
  layouts: ReportLayout[];
}) {
  const [tonnes, setTonnes] = useState(
    Number.isFinite(initialTonnes) ? initialTonnes : 0
  );
  const storageKey = "co2SavingsTonnes";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [layoutState, setLayoutState] = useState<Record<string, LabelLayout>>({});
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const normalizeLabel = (value: string) =>
    value
      .toLowerCase()
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const computed = useMemo(
    () =>
      equivalencies.map((metric) => {
        const perUnitValue = toNumber(metric.value);
        const normalizedLabel = normalizeLabel(metric.label);
        const isWembley =
          normalizedLabel.includes("wembley stadium") ||
          normalizedLabel === "stadium" ||
          normalizedLabel.includes("stadium") ||
          normalizedLabel.includes("fill wembley stadium");
        const baseTonnes = toTonnes(perUnitValue, metric.unit);
        const perUnitTonnes = applyCalc(
          baseTonnes,
          metric.calc_op ?? null,
          metric.calc_factor ?? null
        );
        const equivalent = isWembley && perUnitTonnes && tonnes > 0
          ? 1_139_100 / (tonnes * perUnitTonnes)
          : perUnitTonnes && perUnitTonnes > 0
            ? tonnes / perUnitTonnes
            : null;
        return { ...metric, equivalent, perUnitTonnes };
      }),
    [equivalencies, tonnes]
  );

  const equivalencyLookup = useMemo(() => {
    const map = new Map<string, (typeof computed)[number]>();
    computed.forEach((metric) => {
      map.set(normalizeLabel(metric.label), metric);
    });
    return map;
  }, [computed]);

  const getEquivalency = (label: string, aliases: string[] = []) => {
    const candidates = [label, ...aliases].map(normalizeLabel);
    const metric = candidates
      .map((candidate) => equivalencyLookup.get(candidate))
      .find((match) => match);
    if (!metric) return null;
    if (metric.equivalent === null || Number.isNaN(metric.equivalent)) return null;
    return {
      id: metric.id,
      value: metric.equivalent,
      unit: metric.unit ?? "",
      label: metric.label,
    };
  };

  const formatValue = (value: number | null, digits = 0) => {
    if (value === null || Number.isNaN(value)) return "-";
    return formatNumber(value, digits);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasQuery) {
      window.localStorage.setItem(storageKey, String(tonnes));
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      setTonnes(parsed);
    }
  }, [hasQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ value?: number }>;
      const next = custom.detail?.value;
      if (typeof next === "number" && Number.isFinite(next)) {
        setTonnes(next);
      }
    };
    window.addEventListener("co2-tonnes-change", handler as EventListener);
    return () => {
      window.removeEventListener("co2-tonnes-change", handler as EventListener);
    };
  }, []);

  const flightsEquiv = getEquivalency("Flights Uk To Sydney", [
    "Return Flight To Sydney",
    "Flights from UK to Sydney",
    "Flights from uk to sydney",
    "Return Flights between the UK & Sydney",
  ]);
  const carsEquiv = getEquivalency("Miles a car can travel in a year", [
    "Cars on the Road",
  ]);
  const homesEquiv = getEquivalency("UK Homes Heated", ["Uk homes Heated"]);
  const treesEquiv = getEquivalency("Trees to Offset", ["trees to offset"]);
  const peopleEquiv = getEquivalency("People's Carbon Footprint", [
    "People’s Carbon Footprint",
    "Peoples carbon footprint to remove",
  ]);
  const energyEquiv = getEquivalency("Energy Wasted", [
    "Light bulbs used for 8 hours",
    "Energy wasted",
  ]);
  const stadiumEquiv = getEquivalency("Wembley Stadium could be filled", [
    "Wembley Stadium",
    "Wembley Stadium could be filled with people",
    "Wembley Stadium could be filled up",
    "Stadium",
    "Fill Wembley Stadium",
    "Fill the Wembley Stadium",
    "To fill Wembley Stadium",
  ]);
  const timesAroundWorld =
    carsEquiv && carsEquiv.value > 0 ? carsEquiv.value / 24900 : null;

  const maxSaving = Math.max(
    1,
    ...savings.map((metric) => toNumber(metric.value) ?? 0)
  );

  const layoutDefaults: Record<string, LabelLayout> = {
    flights: { x: 24, y: 42, scale: 1 },
    "car-world": { x: 82, y: 18, scale: 1 },
    "car-miles": { x: 82, y: 44, scale: 1 },
    homes: { x: 26, y: 80, scale: 1 },
    trees: { x: 50, y: 92, scale: 1 },
    people: { x: 82, y: 80, scale: 1 },
    energy: { x: 50, y: 12, scale: 1 },
    stadium: { x: 50, y: 56, scale: 1 },
    "stadium-value": { x: 50, y: 50, scale: 1 },
  };

  const layoutMap = useMemo(() => {
    const map = new Map<string, LabelLayout>();
    layouts.forEach((layout) => {
      if (!layout.key) return;
      const fallback = layoutDefaults[layout.key];
      map.set(layout.key, {
        x: Number.isFinite(layout.x as number)
          ? (layout.x as number)
          : fallback?.x ?? 50,
        y: Number.isFinite(layout.y as number)
          ? (layout.y as number)
          : fallback?.y ?? 50,
        scale: Number.isFinite(layout.scale as number)
          ? (layout.scale as number)
          : fallback?.scale ?? 1,
      });
    });
    return map;
  }, [layouts]);

  useEffect(() => {
    const initial: Record<string, LabelLayout> = {};
    Object.keys(layoutDefaults).forEach((key) => {
      initial[key] = layoutMap.get(key) ?? layoutDefaults[key];
    });
    setLayoutState(initial);
  }, [layoutMap]);

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const handleZoom = (event: React.WheelEvent) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => clamp(Number((prev + delta).toFixed(2)), 0.6, 2.2));
  };

  const toggleFullscreen = async () => {
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
    if (!editing) return;
    if ((event.target as HTMLElement).closest(".reports-equivalency-handle")) return;
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
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/report-equivalency-layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(layoutState).map(([key, layout]) => ({
            key,
            x: layout.x,
            y: layout.y,
            scale: layout.scale,
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

  return (
    <div className="reports-content">
      {/* CO2 total moved to page header. */}

      {/* Environmental savings summary removed by request. */}

      <section className="scheme-card reports-card reports-equivalency-card">
        <div className="scheme-card-header">
          <div>
            <p className="scheme-kicker">Visual</p>
            <h2>CO2 impact equivalencies</h2>
          </div>
          <div className="reports-equivalency-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
            <button
              type="button"
              className={`btn-secondary ${editing ? "is-active" : ""}`}
              onClick={() => setEditing((prev) => !prev)}
            >
              {editing ? "Stop editing" : "Edit layout"}
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
        {saveError ? <p className="create-scheme-message error">{saveError}</p> : null}
        <div
          ref={fullscreenRef}
          className={`reports-image-wrap ${isFullscreen ? "is-fullscreen" : ""}`}
          onWheel={handleZoom}
        >
          <div
            className="reports-image-zoom"
            style={{ transform: `scale(${zoom})` }}
          >
            <img
              src="/co2-image.png"
              alt="CO2 equivalency illustration"
              className="reports-equivalency-image"
            />
            <div
              ref={containerRef}
              className={`reports-equivalency-layer ${editing ? "is-editing" : ""}`}
            >
            <div
              className="reports-equivalency-label flights"
              style={{
                left: `${layoutState.flights?.x ?? layoutDefaults.flights.x}%`,
                top: `${layoutState.flights?.y ?? layoutDefaults.flights.y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState.flights?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("flights", event)}
            >
            <span className="reports-equivalency-number">
              {formatValue(flightsEquiv?.value ?? null)}
            </span>
            <span>Return Flights between the UK &amp; Sydney</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("flights", event)}
              />
            </div>
            <div
              className="reports-equivalency-label car-world"
              style={{
                left: `${layoutState["car-world"]?.x ?? layoutDefaults["car-world"].x}%`,
                top: `${layoutState["car-world"]?.y ?? layoutDefaults["car-world"].y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState["car-world"]?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("car-world", event)}
            >
            <span className="reports-equivalency-number">
              {formatNumber(timesAroundWorld ?? null, 0)}
            </span>
            <span>Times around the World</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("car-world", event)}
              />
            </div>
            <div
              className="reports-equivalency-label car-miles"
              style={{
                left: `${layoutState["car-miles"]?.x ?? layoutDefaults["car-miles"].x}%`,
                top: `${layoutState["car-miles"]?.y ?? layoutDefaults["car-miles"].y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState["car-miles"]?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("car-miles", event)}
            >
            <span className="reports-equivalency-number">
              {formatValue(carsEquiv?.value ?? null)}
            </span>
            <span>Miles a car can travel in a year</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("car-miles", event)}
              />
            </div>
            <div
              className="reports-equivalency-label homes"
              style={{
                left: `${layoutState.homes?.x ?? layoutDefaults.homes.x}%`,
                top: `${layoutState.homes?.y ?? layoutDefaults.homes.y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState.homes?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("homes", event)}
            >
            <span className="reports-equivalency-number">
              {formatValue(homesEquiv?.value ?? null)}
            </span>
            <span>UK homes heated</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("homes", event)}
              />
            </div>
            <div
              className="reports-equivalency-label trees"
              style={{
                left: `${layoutState.trees?.x ?? layoutDefaults.trees.x}%`,
                top: `${layoutState.trees?.y ?? layoutDefaults.trees.y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState.trees?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("trees", event)}
            >
            <span className="reports-equivalency-number">
              {formatValue(treesEquiv?.value ?? null)}
            </span>
            <span>Trees to offset</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("trees", event)}
              />
            </div>
            <div
              className="reports-equivalency-label people"
              style={{
                left: `${layoutState.people?.x ?? layoutDefaults.people.x}%`,
                top: `${layoutState.people?.y ?? layoutDefaults.people.y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState.people?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("people", event)}
            >
            <span className="reports-equivalency-number">
              {formatValue(peopleEquiv?.value ?? null)}
            </span>
            <span>People&apos;s carbon footprint per year</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("people", event)}
              />
            </div>
            <div
              className="reports-equivalency-label energy"
              style={{
                left: `${layoutState.energy?.x ?? layoutDefaults.energy.x}%`,
                top: `${layoutState.energy?.y ?? layoutDefaults.energy.y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState.energy?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("energy", event)}
            >
            <span className="reports-equivalency-number">
              {formatValue(energyEquiv?.value ?? null)}
            </span>
            <span>Light bulbs used for 8 hours</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("energy", event)}
              />
            </div>
            <div
              className="reports-equivalency-label stadium"
              style={{
                left: `${layoutState.stadium?.x ?? layoutDefaults.stadium.x}%`,
                top: `${layoutState.stadium?.y ?? layoutDefaults.stadium.y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState.stadium?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("stadium", event)}
            >
            <span>Schemes To fill Wembley Stadium</span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("stadium", event)}
              />
            </div>
            <div
              className="reports-equivalency-label stadium-value"
              style={{
                left: `${layoutState["stadium-value"]?.x ?? layoutDefaults["stadium-value"].x}%`,
                top: `${layoutState["stadium-value"]?.y ?? layoutDefaults["stadium-value"].y}%`,
                right: "auto",
                transform: `translate(-50%, -50%) scale(${layoutState["stadium-value"]?.scale ?? 1})`,
                pointerEvents: editing ? "auto" : "none",
                cursor: editing ? "move" : "default",
                touchAction: "none",
              }}
              onPointerDown={(event) => handleDragStart("stadium-value", event)}
            >
              <span className="reports-equivalency-number">
                {formatValue(stadiumEquiv?.value ?? null)}
              </span>
              <span
                className="reports-equivalency-handle"
                onPointerDown={(event) => handleResizeStart("stadium-value", event)}
              />
            </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
