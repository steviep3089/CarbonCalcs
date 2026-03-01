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

const formatNumber = (value: number | null, digits = 0) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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

const reportLayoutNudges: Record<string, Partial<LabelLayout>> = {
  flights: { x: -1.5, y: 2 },
  energy: { x: 2.5, y: 2, scale: -0.08 },
};

const getLayout = (key: string, layouts: ReportLayout[]) => {
  const found = layouts.find((layout) => layout.key === key);
  const fallback = layoutDefaults[key] ?? { x: 50, y: 50, scale: 1 };
  return {
    x: Number.isFinite(found?.x as number) ? (found?.x as number) : fallback.x,
    y: Number.isFinite(found?.y as number) ? (found?.y as number) : fallback.y,
    scale: Number.isFinite(found?.scale as number)
      ? (found?.scale as number)
      : fallback.scale,
  };
};

const getEquivalency = (
  metricsByLabel: Map<string, { equivalent: number | null; label: string }>,
  label: string,
  aliases: string[] = []
) => {
  const candidates = [label, ...aliases].map(normalizeLabel);
  const metric = candidates
    .map((candidate) => metricsByLabel.get(candidate))
    .find((match) => match);
  return metric?.equivalent ?? null;
};

const getEquivalencyByPredicate = (
  metricsByLabel: Map<string, { equivalent: number | null; label: string }>,
  predicate: (normalizedLabel: string) => boolean
) => {
  for (const [normalizedLabel, metric] of metricsByLabel.entries()) {
    if (predicate(normalizedLabel)) {
      return metric.equivalent ?? null;
    }
  }
  return null;
};

export function ScenarioCompareCO2Equivalency({
  tonnes,
  equivalencies,
  layouts,
}: {
  tonnes: number;
  equivalencies: ReportMetric[];
  layouts: ReportLayout[];
}) {
  const computed = equivalencies.map((metric) => {
    const perUnitValue = toNumber(metric.value);
    const normalizedLabel = normalizeLabel(metric.label);
    const isWembley =
      normalizedLabel.includes("wembley stadium") ||
      normalizedLabel === "stadium" ||
      normalizedLabel.includes("fill wembley stadium");
    const baseTonnes = toTonnes(perUnitValue, metric.unit);
    const perUnitTonnes = applyCalc(
      baseTonnes,
      metric.calc_op ?? null,
      metric.calc_factor ?? null
    );
    const equivalent =
      isWembley && perUnitTonnes && tonnes > 0
        ? 1_139_100 / (tonnes * perUnitTonnes)
        : perUnitTonnes && perUnitTonnes > 0
        ? tonnes / perUnitTonnes
        : null;
    return { ...metric, equivalent };
  });

  const metricsByLabel = new Map(
    computed.map((metric) => [normalizeLabel(metric.label), metric])
  );

  const flights = getEquivalency(metricsByLabel, "Flights Uk To Sydney", [
    "Return Flight To Sydney",
    "Flights from UK to Sydney",
    "Return Flights between the UK & Sydney",
  ]);
  const cars = getEquivalency(metricsByLabel, "Miles a car can travel in a year", [
    "Cars on the Road",
  ]);
  const homes = getEquivalency(metricsByLabel, "UK Homes Heated", ["Uk homes Heated"]);
  const trees = getEquivalency(metricsByLabel, "Trees to Offset", ["trees to offset"]);
  const people = getEquivalency(metricsByLabel, "People's Carbon Footprint", [
    "Peoples carbon footprint to remove",
  ]);
  const energy = getEquivalency(metricsByLabel, "Energy Wasted", [
    "Light bulbs used for 8 hours",
    "Energy wasted",
  ]);
  const stadium =
    getEquivalency(metricsByLabel, "Wembley Stadium could be filled", [
      "Wembley Stadium",
      "Wembley Stadium could be filled with people",
      "Wembley Stadium could be filled up",
      "Schemes To fill Wembley Stadium",
      "Fill Wembley Stadium",
      "To fill Wembley Stadium",
    ]) ??
    getEquivalencyByPredicate(
      metricsByLabel,
      (label) => label.includes("wembley") || (label.includes("stadium") && label.includes("fill"))
    );
  const timesAroundWorld = cars && cars > 0 ? cars / 24900 : null;

  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const labelStyle = (key: string) => {
    const layout = getLayout(key, layouts);
    const nudge = reportLayoutNudges[key] ?? {};
    const x = clamp(layout.x + (nudge.x ?? 0), 0, 100);
    const y = clamp(layout.y + (nudge.y ?? 0), 0, 100);
    const scale = Math.max(0.6, (layout.scale ?? 1) + (nudge.scale ?? 0));
    return {
      left: `${x}%`,
      top: `${y}%`,
      right: "auto",
      bottom: "auto",
      transform: `translate(-50%, -50%) scale(${scale})`,
      transformOrigin: "50% 50%",
    } as const;
  };

  return (
    <section className="compare-co2-equivalency-card">
      <div className="reports-image-wrap compare-co2-report-wrap">
        <div className="reports-image-zoom compare-co2-report-zoom">
          <img
            src="/co2-image.png"
            alt="CO2 equivalency illustration"
            className="reports-equivalency-image compare-co2-report-image"
          />
          <div className="reports-equivalency-layer compare-co2-report-layer">
            <div className="reports-equivalency-label flights" style={labelStyle("flights")}>
              <span className="reports-equivalency-number">{formatNumber(flights)}</span>
              <span>
                Return flights between the
                <br />
                uk and sydney
              </span>
            </div>
            <div className="reports-equivalency-label car-world" style={labelStyle("car-world")}>
              <span className="reports-equivalency-number">{formatNumber(timesAroundWorld)}</span>
              <span>Times around the World</span>
            </div>
            <div className="reports-equivalency-label car-miles" style={labelStyle("car-miles")}>
              <span className="reports-equivalency-number">{formatNumber(cars)}</span>
              <span>Miles a car can travel in a year</span>
            </div>
            <div className="reports-equivalency-label homes" style={labelStyle("homes")}>
              <span className="reports-equivalency-number">{formatNumber(homes)}</span>
              <span>UK homes heated</span>
            </div>
            <div className="reports-equivalency-label trees" style={labelStyle("trees")}>
              <span className="reports-equivalency-number">{formatNumber(trees)}</span>
              <span>Trees to offset</span>
            </div>
            <div className="reports-equivalency-label people" style={labelStyle("people")}>
              <span className="reports-equivalency-number">{formatNumber(people)}</span>
              <span>People&apos;s carbon footprint per year</span>
            </div>
            <div className="reports-equivalency-label energy" style={labelStyle("energy")}>
              <span className="reports-equivalency-number">{formatNumber(energy)}</span>
              <span>Light bulbs used for 8 hours</span>
            </div>
            <div className="reports-equivalency-label stadium" style={labelStyle("stadium")}>
              <span>Schemes To fill Wembley Stadium</span>
            </div>
            <div className="reports-equivalency-label stadium-value" style={labelStyle("stadium-value")}>
              <span className="reports-equivalency-number">{formatNumber(stadium)}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
