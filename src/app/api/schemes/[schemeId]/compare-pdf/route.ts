import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schemeId: string }>;
};

type Snapshot = {
  scheme_products?: Array<{
    product_id: string | null;
    plant_id: string | null;
    mix_type_id: string | null;
    delivery_type: string | null;
    tonnage: number | null;
    distance_km: number | null;
    distance_unit: string | null;
  }>;
  scheme_installation_items?: Array<{
    category: string | null;
  }>;
  scheme_carbon_results?: Array<{
    lifecycle_stage: string;
    total_kgco2e: number | null;
    kgco2e_per_tonne: number | null;
    detail_label: string | null;
    product_id: string | null;
    mix_type_id: string | null;
  }>;
  scheme_carbon_summary?: {
    total_kgco2e: number | null;
    kgco2e_per_tonne: number | null;
  } | null;
};

type PlantMixFactor = {
  plant_id: string;
  mix_type_id: string;
  product_id: string | null;
  kgco2e_per_tonne: number | null;
  recycled_materials_pct: number | null;
  is_default?: boolean | null;
};

export type ReportMetric = {
  id: string;
  label: string;
  unit: string | null;
  value: number | null;
  calc_op?: string | null;
  calc_factor?: number | null;
  source: string | null;
};

export type ReportLayout = {
  key: string;
  x: number | null;
  y: number | null;
  scale: number | null;
};

type LifecycleDetail = {
  label: string;
  mix: string;
  total_kgco2e: number | null;
  kgco2e_per_tonne: number | null;
};

type LifecycleStage = {
  stage: string;
  description: string;
  total_kgco2e: number | null;
  kgco2e_per_tonne: number | null;
  details: LifecycleDetail[];
};

export type CompareItem = {
  id: string;
  title: string;
  subtitle: string;
  summary_total: number | null;
  summary_per_tonne: number | null;
  narrative: string;
  bullets: string[];
  lifecycle: LifecycleStage[];
  a1Factor?: number | null;
  recycledPct?: number | null;
};

export type CompareChartStage = "A1-A3" | "A4" | "A5" | "A1-A5";

type LabelLayout = {
  x: number;
  y: number;
  scale: number;
};

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_SECTIONS =
  "cards,graph-a1a3,graph-a4,graph-a5,graph-a1a5,recycled,map,co2";
export const DISCLAIMER_TEXT =
  "It is the sole responsibility of the certificate holder to ensure the validity and current status of all information herein";
const PORTRAIT = { width: 595.28, height: 841.89 };
const LANDSCAPE = { width: 841.89, height: 595.28 };

const palette = {
  text: rgb(22 / 255, 36 / 255, 61 / 255),
  muted: rgb(92 / 255, 105 / 255, 125 / 255),
  border: rgb(211 / 255, 220 / 255, 231 / 255),
  soft: rgb(243 / 255, 246 / 255, 250 / 255),
  green: rgb(87 / 255, 160 / 255, 103 / 255),
  navy: rgb(22 / 255, 36 / 255, 61 / 255),
  white: rgb(1, 1, 1),
};

const chartColors = [
  rgb(124 / 255, 215 / 255, 255 / 255),
  rgb(107 / 255, 209 / 255, 168 / 255),
  rgb(246 / 255, 195 / 255, 107 / 255),
  rgb(240 / 255, 143 / 255, 184 / 255),
];

export const mapMarkers = [
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
] as const;

const mapMarkerNudges: Record<string, { x?: number; y?: number; scale?: number }> = {};

const mapLayoutDefaults: Record<string, LabelLayout> = {
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

const co2LayoutDefaults: Record<string, LabelLayout> = {
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

const co2ReportNudges: Record<string, Partial<LabelLayout>> = {
  flights: { x: -1.5, y: 2 },
  energy: { x: 2.5, y: 2, scale: -0.08 },
};

const publicDir = path.join(process.cwd(), "public");

const toDistance = (km: number, unit: string) => (unit === "mi" ? km / 1.60934 : km);

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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatNumber = (value: number | null, digits = 2) => {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
};

export const formatWholeNumber = (value: number | null) => formatNumber(value, 0);

export const formatPercent = (value: number | null, digits = 1) => {
  if (value === null || Number.isNaN(value)) return "-";
  return `${formatNumber(value, digits)}%`;
};

const normalizeLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const sanitizeFileName = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "carbon-comparison";
};

const wrapText = (
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  maxLines = 3
) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = "";
  let index = 0;

  while (index < words.length) {
    const word = words[index];
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      index += 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    } else {
      lines.push(word);
      index += 1;
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (index < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && font.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}...`;
  }

  return lines;
};

const truncateText = (text: string, font: PDFFont, size: number, maxWidth: number) => {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && font.widthOfTextAtSize(`${value}...`, size) > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value}...`;
};

const drawCenteredText = (
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  centerX: number,
  y: number,
  color = palette.text
) => {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y, size, font, color });
};

const drawRightText = (
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  xRight: number,
  y: number,
  color = palette.text
) => {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: xRight - width, y, size, font, color });
};

const fitRect = (
  sourceWidth: number,
  sourceHeight: number,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number
) => {
  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: boxX + (boxWidth - width) / 2,
    y: boxY + (boxHeight - height) / 2,
    width,
    height,
  };
};

export const getStageTotalTonnes = (item: CompareItem, stage: CompareChartStage) => {
  const sumStages = (keys: string[]) =>
    keys.reduce((sum, key) => {
      const found = item.lifecycle.find((row) => row.stage === key);
      return sum + (found?.total_kgco2e ?? 0);
    }, 0) / 1000;

  if (stage === "A1-A3") return sumStages(["A2", "A3"]);
  if (stage === "A1-A5") return sumStages(["A2", "A3", "A4", "A5"]);
  const found = item.lifecycle.find((row) => row.stage === stage);
  return (found?.total_kgco2e ?? 0) / 1000;
};

export const computeSavingPercentage = (items: CompareItem[]) => {
  const perTonneValues = items
    .map((item) => item.summary_per_tonne)
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (!perTonneValues.length) return null;
  const highest = Math.max(...perTonneValues);
  const lowest = Math.min(...perTonneValues);
  if (!highest) return null;
  return ((highest - lowest) / highest) * 100;
};

export const getMapLayout = (layouts: ReportLayout[]) => {
  const map = new Map<string, LabelLayout>();
  for (const entry of layouts) {
    if (!entry?.key) continue;
    const fallback = mapLayoutDefaults[entry.key];
    map.set(entry.key, {
      x: Number.isFinite(entry.x as number) ? (entry.x as number) : fallback?.x ?? 50,
      y: Number.isFinite(entry.y as number) ? (entry.y as number) : fallback?.y ?? 50,
      scale: Number.isFinite(entry.scale as number)
        ? (entry.scale as number)
        : fallback?.scale ?? 1,
    });
  }

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
      const total = legacyLayouts.reduce(
        (sum, entry) => ({
          x: sum.x + entry.x,
          y: sum.y + entry.y,
          scale: sum.scale + entry.scale,
        }),
        { x: 0, y: 0, scale: 0 }
      );
      map.set("compare-map-B1-5", {
        x: total.x / legacyLayouts.length,
        y: total.y / legacyLayouts.length,
        scale: total.scale / legacyLayouts.length,
      });
    }
  }

  return map;
};

export const getCo2Layout = (key: string, layouts: ReportLayout[]) => {
  const found = layouts.find((layout) => layout.key === key);
  const fallback = co2LayoutDefaults[key] ?? { x: 50, y: 50, scale: 1 };
  const nudge = co2ReportNudges[key] ?? {};
  return {
    x: clamp(
      (Number.isFinite(found?.x as number) ? (found?.x as number) : fallback.x) + (nudge.x ?? 0),
      0,
      100
    ),
    y: clamp(
      (Number.isFinite(found?.y as number) ? (found?.y as number) : fallback.y) + (nudge.y ?? 0),
      0,
      100
    ),
    scale: Math.max(
      0.6,
      (Number.isFinite(found?.scale as number) ? (found?.scale as number) : fallback.scale) +
        (nudge.scale ?? 0)
    ),
  };
};

const getEquivalency = (
  metricsByLabel: Map<string, { equivalent: number | null }>,
  label: string,
  aliases: string[] = []
) => {
  const candidates = [label, ...aliases].map(normalizeLabel);
  const metric = candidates
    .map((candidate) => metricsByLabel.get(candidate))
    .find((entry) => entry);
  return metric?.equivalent ?? null;
};

const getEquivalencyByPredicate = (
  metricsByLabel: Map<string, { equivalent: number | null }>,
  predicate: (normalizedLabel: string) => boolean
) => {
  for (const [normalizedLabel, metric] of metricsByLabel.entries()) {
    if (predicate(normalizedLabel)) {
      return metric.equivalent ?? null;
    }
  }
  return null;
};

export const computeCo2Equivalencies = (tonnes: number, metrics: ReportMetric[]) => {
  const computed = metrics.map((metric) => {
    const perUnitValue = toNumber(metric.value);
    const normalized = normalizeLabel(metric.label);
    const isWembley =
      normalized.includes("wembley stadium") ||
      normalized === "stadium" ||
      normalized.includes("fill wembley stadium");
    const baseTonnes = toTonnes(perUnitValue, metric.unit);
    const perUnitTonnes = applyCalc(baseTonnes, metric.calc_op ?? null, metric.calc_factor ?? null);
    const equivalent =
      isWembley && perUnitTonnes && tonnes > 0
        ? 1_139_100 / (tonnes * perUnitTonnes)
        : perUnitTonnes && perUnitTonnes > 0
        ? tonnes / perUnitTonnes
        : null;
    return { ...metric, equivalent };
  });

  const byLabel = new Map(
    computed.map((metric) => [normalizeLabel(metric.label), { equivalent: metric.equivalent }])
  );

  const cars = getEquivalency(byLabel, "Miles a car can travel in a year", ["Cars on the Road"]);

  return {
    flights: getEquivalency(byLabel, "Flights Uk To Sydney", [
      "Return Flight To Sydney",
      "Flights from UK to Sydney",
      "Return Flights between the UK & Sydney",
    ]),
    cars,
    homes: getEquivalency(byLabel, "UK Homes Heated", ["Uk homes Heated"]),
    trees: getEquivalency(byLabel, "Trees to Offset", ["trees to offset"]),
    people: getEquivalency(byLabel, "People's Carbon Footprint", [
      "Peoples carbon footprint to remove",
    ]),
    energy: getEquivalency(byLabel, "Energy Wasted", [
      "Light bulbs used for 8 hours",
      "Energy wasted",
    ]),
    stadium:
      getEquivalency(byLabel, "Wembley Stadium could be filled", [
        "Wembley Stadium",
        "Wembley Stadium could be filled with people",
        "Wembley Stadium could be filled up",
        "Schemes To fill Wembley Stadium",
        "Fill Wembley Stadium",
        "To fill Wembley Stadium",
      ]) ??
      getEquivalencyByPredicate(
        byLabel,
        (label) => label.includes("wembley") || (label.includes("stadium") && label.includes("fill"))
      ),
    timesAroundWorld: cars && cars > 0 ? cars / 24900 : null,
  };
};

const drawHeader = (
  page: PDFPage,
  fonts: FontSet,
  logo: PDFImage,
  options: {
    kicker?: string;
    title?: string;
    titleSize?: number;
    logoWidth?: number;
  } = {}
) => {
  const pageWidth = page.getWidth();
  const logoWidth = options.logoWidth ?? 96;
  const logoHeight = (logo.height / logo.width) * logoWidth;
  const top = page.getHeight() - 24;
  const logoY = top - logoHeight;

  page.drawImage(logo, {
    x: (pageWidth - logoWidth) / 2,
    y: logoY,
    width: logoWidth,
    height: logoHeight,
  });

  let nextY = logoY - 10;
  if (options.kicker) {
    drawCenteredText(page, options.kicker.toUpperCase(), fonts.regular, 7.5, pageWidth / 2, nextY, palette.muted);
    nextY -= 12;
  }
  if (options.title) {
    drawCenteredText(
      page,
      options.title,
      fonts.bold,
      options.titleSize ?? 15,
      pageWidth / 2,
      nextY,
      palette.text
    );
    nextY -= (options.titleSize ?? 15) + 6;
  }

  return nextY;
};

const drawDisclaimer = (page: PDFPage, fonts: FontSet, text: string) => {
  const size = 7;
  const safeText = truncateText(text, fonts.regular, size, page.getWidth() - 60);
  drawCenteredText(page, safeText, fonts.regular, size, page.getWidth() / 2, 18, palette.muted);
};

const drawBarChart = (
  page: PDFPage,
  fonts: FontSet,
  rect: Rect,
  options: {
    title: string;
    items: CompareItem[];
    values: Array<number | null>;
    valueFormatter: (value: number | null) => string;
  }
) => {
  const titleY = rect.y + rect.height - 16;
  page.drawText(options.title, {
    x: rect.x,
    y: titleY,
    size: 14,
    font: fonts.bold,
    color: palette.text,
  });

  const count = Math.max(1, options.items.length);
  const chartTop = rect.y + rect.height - 34;
  const chartBottom = rect.y + 58;
  const chartHeight = Math.max(40, chartTop - chartBottom);
  const labelHeight = 34;
  const gap = count > 1 ? 12 : 0;
  const slotWidth = (rect.width - gap * (count - 1)) / count;
  const barWidth = Math.min(44, slotWidth * 0.72);
  const maxValue = Math.max(
    1,
    ...options.values.map((value) => (value !== null && Number.isFinite(value) ? value : 0))
  );

  options.items.forEach((item, index) => {
    const value = options.values[index];
    const safeValue = value !== null && Number.isFinite(value) ? value : 0;
    const slotX = rect.x + index * (slotWidth + gap);
    const centerX = slotX + slotWidth / 2;
    const barHeight = Math.max(8, (safeValue / maxValue) * chartHeight);
    const barX = centerX - barWidth / 2;

    page.drawRectangle({
      x: barX,
      y: chartBottom,
      width: barWidth,
      height: barHeight,
      color: chartColors[index % chartColors.length],
    });

    drawCenteredText(
      page,
      options.valueFormatter(value),
      fonts.regular,
      7.5,
      centerX,
      rect.y + 42,
      palette.muted
    );

    const labelLines = wrapText(item.title, fonts.regular, 7.5, slotWidth - 4, 4);
    const lineHeight = 8.5;
    const totalHeight = labelLines.length * lineHeight;
    let lineY = rect.y + (labelHeight + totalHeight) / 2 - lineHeight;
    labelLines.forEach((line) => {
      drawCenteredText(page, line, fonts.regular, 7.5, centerX, lineY, palette.text);
      lineY -= lineHeight;
    });
  });
};

const drawInfoBox = (
  page: PDFPage,
  fonts: FontSet,
  rect: Rect,
  label: string,
  value: string
) => {
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    color: palette.soft,
    borderColor: palette.border,
    borderWidth: 1,
  });

  page.drawText(label.toUpperCase(), {
    x: rect.x + 10,
    y: rect.y + rect.height - 14,
    size: 6.5,
    font: fonts.regular,
    color: palette.muted,
  });
  page.drawText(value, {
    x: rect.x + 10,
    y: rect.y + 10,
    size: 10.5,
    font: fonts.bold,
    color: palette.text,
  });
};

const drawOverviewPage = (
  pdf: PDFDocument,
  fonts: FontSet,
  logo: PDFImage,
  recycleImage: PDFImage,
  schemeName: string,
  items: CompareItem[],
  selectedGraphSections: CompareChartStage[],
  includeRecycled: boolean,
  isLastPage: boolean
) => {
  const page = pdf.addPage([PORTRAIT.width, PORTRAIT.height]);
  const headerBottom = drawHeader(page, fonts, logo, {
    kicker: "Carbon Comparison",
    title: schemeName,
    titleSize: 15,
  });

  const marginX = 24;
  const contentWidth = page.getWidth() - marginX * 2;
  const gapX = 22;
  const chartWidth = (contentWidth - gapX) / 2;
  const chartHeight = 196;
  const chartGapY = 26;
  const topY = headerBottom - 12;

  const chartRects: Rect[] = [];
  for (let index = 0; index < selectedGraphSections.length; index += 1) {
    const row = Math.floor(index / 2);
    const col = index % 2;
    chartRects.push({
      x: marginX + col * (chartWidth + gapX),
      y: topY - chartHeight - row * (chartHeight + chartGapY),
      width: chartWidth,
      height: chartHeight,
    });
  }

  selectedGraphSections.forEach((stage, index) => {
    const values = items.map((item) => getStageTotalTonnes(item, stage));
    drawBarChart(page, fonts, chartRects[index], {
      title: `${stage} emissions (tCO2e)`,
      items,
      values,
      valueFormatter: (value) => (value !== null && value > 0 ? formatNumber(value, 2) : "-"),
    });
  });

  if (includeRecycled) {
    const row = Math.ceil(selectedGraphSections.length / 2);
    const recycledRect: Rect = {
      x: marginX,
      y: topY - chartHeight - row * (chartHeight + chartGapY),
      width: chartWidth,
      height: 226,
    };

    const values = items.map((item) =>
      item.recycledPct !== null &&
      item.recycledPct !== undefined &&
      Number.isFinite(item.recycledPct)
        ? item.recycledPct
        : null
    );
    drawBarChart(page, fonts, recycledRect, {
      title: "Recycled material content (%)",
      items,
      values,
      valueFormatter: (value) => (value !== null ? formatPercent(value) : "-"),
    });

    const savingPct = computeSavingPercentage(items);
    const recyclePanel: Rect = {
      x: marginX + chartWidth + gapX,
      y: recycledRect.y,
      width: chartWidth,
      height: recycledRect.height,
    };
    const recycleFitBase = fitRect(
      recycleImage.width,
      recycleImage.height,
      recyclePanel.x + 8,
      recyclePanel.y + 8,
      recyclePanel.width - 16,
      recyclePanel.height - 16
    );
    const recycleFit = {
      x: recycleFitBase.x + recycleFitBase.width * 0.09,
      y: recycleFitBase.y + recycleFitBase.height * 0.09,
      width: recycleFitBase.width * 0.82,
      height: recycleFitBase.height * 0.82,
    };
    page.drawImage(recycleImage, recycleFit);

    const overlayWidth = Math.min(102, recyclePanel.width * 0.35);
    const overlayHeight = 44;
    const overlayX = recycleFit.x + recycleFit.width / 2 - overlayWidth / 2;
    const overlayY = recycleFit.y + recycleFit.height / 2 - overlayHeight / 2;
    page.drawRectangle({
      x: overlayX,
      y: overlayY,
      width: overlayWidth,
      height: overlayHeight,
      color: palette.navy,
    });
    drawCenteredText(
      page,
      "CO2E/T SAVING",
      fonts.bold,
      8,
      overlayX + overlayWidth / 2,
      overlayY + 34,
      palette.white
    );
    drawCenteredText(
      page,
      savingPct !== null ? formatPercent(savingPct) : "-",
      fonts.bold,
      13,
      overlayX + overlayWidth / 2,
      overlayY + 14,
      palette.white
    );
  }

  if (isLastPage) {
    drawDisclaimer(page, fonts, DISCLAIMER_TEXT);
  }
};

const drawComparisonCard = (
  page: PDFPage,
  fonts: FontSet,
  rect: Rect,
  item: CompareItem
) => {
  page.drawRectangle({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    borderColor: palette.border,
    borderWidth: 1,
    color: palette.white,
  });

  const innerX = rect.x + 14;
  const innerWidth = rect.width - 28;
  let cursorY = rect.y + rect.height - 18;

  page.drawText(item.subtitle.toUpperCase(), {
    x: innerX,
    y: cursorY,
    size: 7,
    font: fonts.regular,
    color: palette.muted,
  });
  cursorY -= 16;

  const titleLines = wrapText(item.title, fonts.bold, 13, innerWidth, 2);
  titleLines.forEach((line) => {
    page.drawText(line, {
      x: innerX,
      y: cursorY,
      size: 13,
      font: fonts.bold,
      color: palette.text,
    });
    cursorY -= 15;
  });

  const infoHeight = 40;
  const infoGap = 10;
  const infoWidth = (innerWidth - infoGap) / 2;
  drawInfoBox(
    page,
    fonts,
    { x: innerX, y: cursorY - infoHeight, width: infoWidth, height: infoHeight },
    "Total kgCO2e",
    formatNumber(item.summary_total, 2)
  );
  drawInfoBox(
    page,
    fonts,
    {
      x: innerX + infoWidth + infoGap,
      y: cursorY - infoHeight,
      width: infoWidth,
      height: infoHeight,
    },
    "kgCO2e / tonne",
    formatNumber(item.summary_per_tonne, 2)
  );
  cursorY -= infoHeight + 14;

  const lifecycleStages = ["A2", "A3", "A4", "A5"].map((stage) => {
    const found = item.lifecycle.find((row) => row.stage === stage);
    return {
      stage,
      description: found?.description ?? stage,
      total: found?.total_kgco2e ?? null,
      perTonne: found?.kgco2e_per_tonne ?? null,
    };
  });

  const headerY = cursorY;
  page.drawText("Stage", {
    x: innerX,
    y: headerY,
    size: 7,
    font: fonts.bold,
    color: palette.muted,
  });
  page.drawText("Description", {
    x: innerX + 42,
    y: headerY,
    size: 7,
    font: fonts.bold,
    color: palette.muted,
  });
  drawRightText(page, "kgCO2e", fonts.bold, 7, rect.x + rect.width - 72, headerY, palette.muted);
  drawRightText(page, "/ t", fonts.bold, 7, rect.x + rect.width - 18, headerY, palette.muted);
  cursorY -= 14;

  lifecycleStages.forEach((row) => {
    page.drawText(row.stage, {
      x: innerX,
      y: cursorY,
      size: 9,
      font: fonts.bold,
      color: palette.text,
    });
    page.drawText(
      truncateText(row.description, fonts.regular, 8.5, rect.x + rect.width - 160 - (innerX + 42)),
      {
        x: innerX + 42,
        y: cursorY,
        size: 8.5,
        font: fonts.regular,
        color: palette.text,
      }
    );
    drawRightText(page, formatNumber(row.total, 2), fonts.regular, 8.5, rect.x + rect.width - 72, cursorY, palette.text);
    drawRightText(
      page,
      formatNumber(row.perTonne, 2),
      fonts.regular,
      8.5,
      rect.x + rect.width - 18,
      cursorY,
      palette.text
    );
    cursorY -= 16;
  });

  cursorY -= 6;
  page.drawText(`A1 factor: ${formatNumber(item.a1Factor ?? null, 2)}`, {
    x: innerX,
    y: cursorY,
    size: 8.5,
    font: fonts.regular,
    color: palette.text,
  });
  drawRightText(
    page,
    `Recycled: ${formatPercent(item.recycledPct ?? null)}`,
    fonts.regular,
    8.5,
    rect.x + rect.width - 14,
    cursorY,
    palette.text
  );

  cursorY -= 22;
  const bulletLines = item.bullets.slice(0, 3);
  bulletLines.forEach((bullet) => {
    const lines = wrapText(`- ${bullet}`, fonts.regular, 8, innerWidth, 2);
    lines.forEach((line) => {
      if (cursorY < rect.y + 12) return;
      page.drawText(line, {
        x: innerX,
        y: cursorY,
        size: 8,
        font: fonts.regular,
        color: palette.muted,
      });
      cursorY -= 10;
    });
  });
};

const drawCardsPages = (
  pdf: PDFDocument,
  fonts: FontSet,
  logo: PDFImage,
  schemeName: string,
  items: CompareItem[],
  isLastPage: (pageIndexWithinCards: number, totalPagesWithinCards: number) => boolean
) => {
  const chunkSize = 4;
  const pages = Math.max(1, Math.ceil(items.length / chunkSize));

  for (let pageIndex = 0; pageIndex < pages; pageIndex += 1) {
    const page = pdf.addPage([PORTRAIT.width, PORTRAIT.height]);
    const headerBottom = drawHeader(page, fonts, logo, {
      kicker: "Carbon Comparison",
      title: schemeName,
      titleSize: 15,
    });

    const chunk = items.slice(pageIndex * chunkSize, pageIndex * chunkSize + chunkSize);
    const marginX = 30;
    const gapX = 16;
    const gapY = 18;
    const cardWidth = (page.getWidth() - marginX * 2 - gapX) / 2;
    const rows = Math.max(1, Math.ceil(chunk.length / 2));
    const availableHeight = headerBottom - 56;
    const cardHeight = Math.min(298, (availableHeight - gapY * (rows - 1)) / rows);
    const topY = headerBottom - 18;

    chunk.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const col = index % 2;
      drawComparisonCard(
        page,
        fonts,
        {
          x: marginX + col * (cardWidth + gapX),
          y: topY - cardHeight - row * (cardHeight + gapY),
          width: cardWidth,
          height: cardHeight,
        },
        item
      );
    });

    if (isLastPage(pageIndex, pages)) {
      drawDisclaimer(page, fonts, DISCLAIMER_TEXT);
    }
  }
};

export const getMapStageValue = (item: CompareItem, stageKey: string) => {
  if (stageKey === "A1") return item.a1Factor ?? null;
  if (stageKey === "B1-B5") {
    const values = ["B1", "B2", "B3", "B4", "B5"]
      .map((stage) => item.lifecycle.find((row) => row.stage === stage)?.kgco2e_per_tonne ?? null)
      .filter((value): value is number => value !== null && Number.isFinite(value));
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0);
  }
  return item.lifecycle.find((row) => row.stage === stageKey)?.kgco2e_per_tonne ?? null;
};

const drawMapPage = (
  pdf: PDFDocument,
  fonts: FontSet,
  logo: PDFImage,
  mapImage: PDFImage,
  item: CompareItem,
  layouts: ReportLayout[],
  isLastPage: boolean
) => {
  const page = pdf.addPage([LANDSCAPE.width, LANDSCAPE.height]);
  const headerBottom = drawHeader(page, fonts, logo, { logoWidth: 92 });
  const bottomPadding = isLastPage ? 34 : 22;
  const mapRect = fitRect(
    mapImage.width,
    mapImage.height,
    18,
    bottomPadding,
    page.getWidth() - 36,
    headerBottom - bottomPadding - 10
  );

  page.drawImage(mapImage, mapRect);

  const layoutMap = getMapLayout(layouts);
  mapMarkers.forEach((marker) => {
    const layout = layoutMap.get(marker.key) ?? mapLayoutDefaults[marker.key];
    const nudge = mapMarkerNudges[marker.key] ?? {};
    const centerX = mapRect.x + ((layout.x + (nudge.x ?? 0)) / 100) * mapRect.width;
    const bottomPointY =
      mapRect.y + mapRect.height - ((layout.y + (nudge.y ?? 0)) / 100) * mapRect.height - 6;
    const scale = layout.scale * 0.527 * (nudge.scale ?? 1);
    const markerValue = getMapStageValue(item, marker.stage);
    const valueText = formatNumber(markerValue, 2);
    const labelSize = (marker.label.length > 3 ? 12.2 : 13.2) * scale;
    const valueFont = markerValue === null ? fonts.regular : fonts.bold;
    const valueSize = (markerValue === null ? 10.4 : 11.1) * scale;
    const horizontalPadding = 10 * scale;
    const topPadding = 5 * scale;
    const bottomPadding = 14 * scale;
    const gap = 4 * scale;
    const labelFont = fonts.bold;
    const labelWidth = labelFont.widthOfTextAtSize(marker.label, labelSize);
    const valueWidth = valueFont.widthOfTextAtSize(valueText, valueSize);
    const bodyWidth = Math.max(labelWidth, valueWidth) + horizontalPadding * 2;
    const rectHeight = topPadding + labelSize + gap + valueSize + bottomPadding;
    const totalHeight = rectHeight / 0.72;
    const topY = bottomPointY + totalHeight;
    const leftX = centerX - bodyWidth / 2;
    const stageY = topY - topPadding - labelSize;
    const valueY = stageY - valueSize - gap;

    page.drawSvgPath(
      `M 0 0 L 0 ${rectHeight} L ${bodyWidth / 2} ${totalHeight} L ${bodyWidth} ${rectHeight} L ${bodyWidth} 0 Z`,
      {
        x: leftX,
        y: topY,
        color: rgb(59 / 255, 154 / 255, 98 / 255),
        borderWidth: 0,
        borderOpacity: 0,
      }
    );

    drawCenteredText(
      page,
      marker.label,
      labelFont,
      labelSize,
      centerX,
      stageY,
      palette.white
    );

    drawCenteredText(page, valueText, valueFont, valueSize, centerX, valueY, palette.white);
  });

  if (isLastPage) {
    drawDisclaimer(page, fonts, DISCLAIMER_TEXT);
  }
};

const drawBadge = (
  page: PDFPage,
  fonts: FontSet,
  centerX: number,
  centerY: number,
  lines: Array<{ number?: string; text: string }>,
  scale: number,
  options: {
    circle?: boolean;
    regularSizeScale?: number;
    boldSizeScale?: number;
    paddingScale?: number;
  } = {}
) => {
  const regularSize = 10.2 * scale * (options.regularSizeScale ?? 1);
  const boldSize = 10.6 * scale * (options.boldSizeScale ?? 1);
  const lineGap = 10.8 * scale;
  const paddingScale = options.paddingScale ?? 1;
  const paddingX = (options.circle ? 10 * scale : 8 * scale) * paddingScale;
  const paddingY = (options.circle ? 10 * scale : 6 * scale) * paddingScale;

  const lineWidths = lines.map((line) => {
    const numberWidth = line.number
      ? fonts.bold.widthOfTextAtSize(line.number, boldSize) + 6 * scale
      : 0;
    const labelWidth = line.text ? fonts.regular.widthOfTextAtSize(line.text, regularSize) : 0;
    return numberWidth + labelWidth;
  });
  const width = Math.max(...lineWidths, 32 * scale) + paddingX * 2;
  const height = lines.length * lineGap + paddingY * 2;

  if (options.circle) {
    const radius = Math.max(width, height) / 2;
    page.drawCircle({
      x: centerX,
      y: centerY,
      size: radius,
      color: palette.white,
      borderColor: palette.border,
      borderWidth: 1,
    });
  } else {
    page.drawRectangle({
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      color: palette.white,
      borderColor: palette.border,
      borderWidth: 1,
    });
  }

  let currentY = centerY + (lines.length - 1) * lineGap * 0.5;
  lines.forEach((line) => {
    const numberWidth = line.number ? fonts.bold.widthOfTextAtSize(line.number, boldSize) : 0;
    const labelWidth = line.text ? fonts.regular.widthOfTextAtSize(line.text, regularSize) : 0;
    const totalWidth = numberWidth + (line.number ? 6 * scale : 0) + labelWidth;
    const lineStartX = centerX - totalWidth / 2;

    if (line.number) {
      page.drawText(line.number, {
        x: lineStartX,
        y: currentY - regularSize * 0.32,
        size: boldSize,
        font: fonts.bold,
        color: palette.text,
      });
    }
    page.drawText(line.text, {
      x: lineStartX + (line.number ? numberWidth + 6 * scale : 0),
      y: currentY - regularSize * 0.32,
      size: regularSize,
      font: fonts.regular,
      color: palette.text,
    });
    currentY -= lineGap;
  });
};

const drawCo2Page = (
  pdf: PDFDocument,
  fonts: FontSet,
  logo: PDFImage,
  co2Image: PDFImage,
  tonnes: number,
  metrics: ReportMetric[],
  layouts: ReportLayout[],
  isLastPage: boolean
) => {
  const page = pdf.addPage([LANDSCAPE.width, LANDSCAPE.height]);
  const headerBottom = drawHeader(page, fonts, logo, { logoWidth: 92 });
  const bottomPadding = isLastPage ? 34 : 22;
  const imageRect = fitRect(
    co2Image.width,
    co2Image.height,
    18,
    bottomPadding,
    page.getWidth() - 36,
    headerBottom - bottomPadding - 10
  );
  page.drawImage(co2Image, imageRect);

  const values = computeCo2Equivalencies(tonnes, metrics);
  const resolvePoint = (key: string) => {
    const layout = getCo2Layout(key, layouts);
    return {
      centerX: imageRect.x + (layout.x / 100) * imageRect.width,
      centerY: imageRect.y + imageRect.height - (layout.y / 100) * imageRect.height,
      scale: layout.scale,
    };
  };

  {
    const point = resolvePoint("flights");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [
        { number: formatWholeNumber(values.flights), text: "Return flights between the" },
        { text: "uk and sydney" },
      ],
      point.scale * 0.9
    );
  }

  {
    const point = resolvePoint("car-world");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.timesAroundWorld), text: "Times around the World" }],
      point.scale * 0.92
    );
  }

  {
    const point = resolvePoint("car-miles");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.cars), text: "Miles a car can travel in a year" }],
      point.scale * 0.92
    );
  }

  {
    const point = resolvePoint("homes");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.homes), text: "UK homes heated" }],
      point.scale * 0.9
    );
  }

  {
    const point = resolvePoint("trees");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.trees), text: "Trees to offset" }],
      point.scale * 0.9
    );
  }

  {
    const point = resolvePoint("people");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.people), text: "People's carbon footprint per year" }],
      point.scale * 0.9
    );
  }

  {
    const point = resolvePoint("energy");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.energy), text: "Light bulbs used for 8 hours" }],
      point.scale * 0.84
    );
  }

  {
    const point = resolvePoint("stadium");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ text: "Schemes To fill Wembley Stadium" }],
      point.scale * 0.9
    );
  }

  {
    const point = resolvePoint("stadium-value");
    drawBadge(
      page,
      fonts,
      point.centerX,
      point.centerY,
      [{ text: formatWholeNumber(values.stadium) }],
      point.scale * 0.43,
      { circle: true, regularSizeScale: 1.18, paddingScale: 0.84 }
    );
  }

  if (isLastPage) {
    drawDisclaimer(page, fonts, DISCLAIMER_TEXT);
  }
};

const readPublicAsset = async (relativePath: string) =>
  fs.readFile(path.join(publicDir, ...relativePath.split("/")));

export const loadCompareData = async (
  schemeId: string,
  selected: string[],
  selectedSections: Set<string>
) => {
  const supabase = await createSupabaseServerClient();
  const scenarioIds = selected.filter((item) => item !== "live");

  const [
    { data: scheme },
    { data: mixTypes },
    { data: products },
    scenarioResponse,
    mapLayoutResponse,
    co2LayoutResponse,
    co2MetricResponse,
  ] = await Promise.all([
    supabase.from("schemes").select("id, name, distance_unit, plant_id").eq("id", schemeId).single(),
    supabase.from("mix_types").select("id, name"),
    supabase.from("products").select("id, name"),
    scenarioIds.length
      ? supabase.from("scheme_scenarios").select("id, label, snapshot").eq("scheme_id", schemeId).in("id", scenarioIds)
      : Promise.resolve({ data: [] as Array<{ id: string; label: string | null; snapshot: Snapshot | null }> }),
    selectedSections.has("map")
      ? supabase
          .from("report_equivalency_layouts")
          .select("key, x, y, scale")
          .ilike("key", "compare-map-%")
      : Promise.resolve({ data: [] as ReportLayout[] }),
    selectedSections.has("co2")
      ? supabase.from("report_equivalency_layouts").select("key, x, y, scale")
      : Promise.resolve({ data: [] as ReportLayout[] }),
    selectedSections.has("co2")
      ? supabase
          .from("report_metrics")
          .select("id, label, unit, value, source, calc_op, calc_factor")
          .eq("kind", "equivalency")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as ReportMetric[] }),
  ]);

  if (!scheme) return null;

  const mixNameById = new Map((mixTypes ?? []).map((mix) => [mix.id, mix.name]));
  const productNameById = new Map((products ?? []).map((product) => [product.id, product.name]));
  const scenarioRows = scenarioResponse.data ?? [];
  const scenarioById = new Map(scenarioRows.map((row) => [row.id, row]));

  const collectProducts = (snapshot?: Snapshot | null) =>
    (snapshot?.scheme_products ?? []).filter((row) => row.mix_type_id);
  const scenarioProducts = scenarioRows.flatMap((row) => collectProducts(row.snapshot as Snapshot | null));

  const buildNarrative = (
    title: string,
    productsList: Snapshot["scheme_products"] = [],
    installationItems: Snapshot["scheme_installation_items"] = [],
    distanceUnit: string
  ) => {
    const delivery = productsList.filter(
      (row) => (row.delivery_type ?? "delivery").toLowerCase() === "delivery"
    );
    const returned = productsList.filter(
      (row) => (row.delivery_type ?? "").toLowerCase() === "return"
    );
    const tipped = productsList.filter((row) => (row.delivery_type ?? "").toLowerCase() === "tip");
    const totalDelivered = delivery.reduce((sum, row) => sum + (row.tonnage ?? 0), 0);
    const totalReturned = returned.reduce((sum, row) => sum + (row.tonnage ?? 0), 0);
    const totalTipped = tipped.reduce((sum, row) => sum + (row.tonnage ?? 0), 0);

    const allMixes = new Set<string>();
    productsList.forEach((row) => {
      if (row.mix_type_id && mixNameById.has(row.mix_type_id)) {
        allMixes.add(mixNameById.get(row.mix_type_id)!);
      }
    });

    const deliveryDistances = delivery
      .map((row) => (row.distance_km ? toDistance(row.distance_km, distanceUnit) : null))
      .filter((value): value is number => value !== null);
    const avgDistance =
      deliveryDistances.length > 0
        ? deliveryDistances.reduce((sum, value) => sum + value, 0) / deliveryDistances.length
        : null;

    const plantCount = installationItems.filter((row) =>
      (row.category ?? "").toLowerCase().includes("plant")
    ).length;
    const transportCount = installationItems.filter((row) =>
      (row.category ?? "").toLowerCase().includes("transport")
    ).length;
    const materialCount = installationItems.filter((row) =>
      (row.category ?? "").toLowerCase().includes("material")
    ).length;

    const mixText = allMixes.size
      ? `Mixes used: ${Array.from(allMixes).join(", ")}.`
      : "No mix types recorded.";
    const distanceText =
      avgDistance !== null
        ? `Average delivery distance: ${avgDistance.toFixed(1)} ${distanceUnit}.`
        : "Delivery distances not recorded.";
    const installText = `Installation items: ${plantCount} plant, ${transportCount} transport, ${materialCount} material.`;

    return `${title} includes ${delivery.length} deliveries totaling ${totalDelivered.toFixed(
      1
    )} t, ${totalReturned.toFixed(1)} t returned, and ${totalTipped.toFixed(1)} t sent to tip. ${mixText} ${distanceText} ${installText}`;
  };

  const buildBullets = (
    productsList: Snapshot["scheme_products"] = [],
    installationItems: Snapshot["scheme_installation_items"] = [],
    distanceUnit: string
  ) => {
    const delivery = productsList.filter(
      (row) => (row.delivery_type ?? "delivery").toLowerCase() === "delivery"
    );
    const returned = productsList.filter(
      (row) => (row.delivery_type ?? "").toLowerCase() === "return"
    );
    const tipped = productsList.filter((row) => (row.delivery_type ?? "").toLowerCase() === "tip");
    const totalDelivered = delivery.reduce((sum, row) => sum + (row.tonnage ?? 0), 0);
    const totalReturned = returned.reduce((sum, row) => sum + (row.tonnage ?? 0), 0);
    const totalTipped = tipped.reduce((sum, row) => sum + (row.tonnage ?? 0), 0);

    const deliveryDistances = delivery
      .map((row) => (row.distance_km ? toDistance(row.distance_km, distanceUnit) : null))
      .filter((value): value is number => value !== null);
    const avgDistance =
      deliveryDistances.length > 0
        ? deliveryDistances.reduce((sum, value) => sum + value, 0) / deliveryDistances.length
        : null;

    const plantCount = installationItems.filter((row) =>
      (row.category ?? "").toLowerCase().includes("plant")
    ).length;
    const transportCount = installationItems.filter((row) =>
      (row.category ?? "").toLowerCase().includes("transport")
    ).length;
    const materialCount = installationItems.filter((row) =>
      (row.category ?? "").toLowerCase().includes("material")
    ).length;

    return [
      `Delivered: ${totalDelivered.toFixed(1)} t`,
      `Returned: ${totalReturned.toFixed(1)} t`,
      `Tipped: ${totalTipped.toFixed(1)} t`,
      avgDistance !== null
        ? `Avg delivery distance: ${avgDistance.toFixed(1)} ${distanceUnit}`
        : "Avg delivery distance: n/a",
      `Installation items: ${plantCount} plant, ${transportCount} transport, ${materialCount} material`,
    ];
  };

  const stageDescription = (stage: string) => {
    switch (stage) {
      case "A2":
        return "Transport to manufacturing plant";
      case "A3":
        return "Manufacturing";
      case "A4":
        return "Transport to site";
      case "A5":
        return "Installation";
      default:
        return stage;
    }
  };

  const buildLifecycle = (results: Snapshot["scheme_carbon_results"] = []) => {
    const groups = new Map<string, LifecycleStage>();
    results.forEach((row) => {
      if (!groups.has(row.lifecycle_stage)) {
        groups.set(row.lifecycle_stage, {
          stage: row.lifecycle_stage,
          description: stageDescription(row.lifecycle_stage),
          total_kgco2e: null,
          kgco2e_per_tonne: null,
          details: [],
        });
      }
      const group = groups.get(row.lifecycle_stage);
      if (!group) return;
      if (!row.product_id && !row.mix_type_id && !row.detail_label) {
        group.total_kgco2e = row.total_kgco2e;
        group.kgco2e_per_tonne = row.kgco2e_per_tonne;
      } else {
        group.details.push({
          label:
            row.detail_label ??
            (row.product_id ? productNameById.get(row.product_id) ?? row.product_id : "-"),
          mix: row.mix_type_id ? mixNameById.get(row.mix_type_id) ?? row.mix_type_id : "-",
          total_kgco2e: row.total_kgco2e,
          kgco2e_per_tonne: row.kgco2e_per_tonne,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => a.stage.localeCompare(b.stage));
  };

  const livePayload = selected.includes("live")
    ? await (async () => {
        const [
          { data: liveProducts },
          { data: liveInstall },
          { data: liveResults },
          { data: liveSummary },
        ] = await Promise.all([
          supabase
            .from("scheme_products")
            .select("product_id, plant_id, mix_type_id, delivery_type, tonnage, distance_km, distance_unit")
            .eq("scheme_id", schemeId),
          supabase
            .from("scheme_installation_items")
            .select("category")
            .eq("scheme_id", schemeId),
          supabase
            .from("scheme_carbon_results")
            .select("lifecycle_stage, total_kgco2e, kgco2e_per_tonne, detail_label, product_id, mix_type_id")
            .eq("scheme_id", schemeId)
            .order("lifecycle_stage"),
          supabase
            .from("scheme_carbon_summaries")
            .select("total_kgco2e, kgco2e_per_tonne")
            .eq("scheme_id", schemeId)
            .maybeSingle(),
        ]);
        return {
          products: liveProducts ?? [],
          install: liveInstall ?? [],
          results: liveResults ?? [],
          summary: liveSummary ?? null,
        };
      })()
    : null;

  const plantIds = new Set<string>();
  if (scheme.plant_id) {
    plantIds.add(scheme.plant_id);
  }
  scenarioProducts.forEach((row) => {
    if (row.plant_id) {
      plantIds.add(row.plant_id);
    }
  });
  livePayload?.products.forEach((row) => {
    if (row.plant_id) {
      plantIds.add(row.plant_id);
    }
  });

  const plantIdList = Array.from(plantIds);
  const plantMixFactors = plantIdList.length
    ? (
        await supabase
          .from("plant_mix_carbon_factors")
          .select(
            "plant_id, mix_type_id, product_id, kgco2e_per_tonne, recycled_materials_pct, is_default"
          )
          .in("plant_id", plantIdList)
          .is("valid_to", null)
      ).data ?? []
    : [];

  const factorByKey = new Map<string, PlantMixFactor>();
  const defaultFactorByPlant = new Map<string, PlantMixFactor>();
  plantMixFactors.forEach((row) => {
    const key = `${row.plant_id}::${row.mix_type_id}::${row.product_id ?? "null"}`;
    factorByKey.set(key, row);
    if (row.is_default) {
      defaultFactorByPlant.set(row.plant_id, row);
    }
  });

  const resolveMixFactor = (
    plantId: string | null,
    mixTypeId: string | null,
    productId: string | null
  ) => {
    if (!plantId || !mixTypeId) return null;
    const exact = factorByKey.get(`${plantId}::${mixTypeId}::${productId ?? "null"}`);
    if (toNumber(exact?.kgco2e_per_tonne) !== null) {
      return toNumber(exact?.kgco2e_per_tonne);
    }
    const fallback = factorByKey.get(`${plantId}::${mixTypeId}::null`);
    if (toNumber(fallback?.kgco2e_per_tonne) !== null) {
      return toNumber(fallback?.kgco2e_per_tonne);
    }
    return toNumber(defaultFactorByPlant.get(plantId)?.kgco2e_per_tonne);
  };

  const resolveRecycledPct = (
    plantId: string | null,
    mixTypeId: string | null,
    productId: string | null
  ) => {
    if (!plantId || !mixTypeId) return null;
    const exact = factorByKey.get(`${plantId}::${mixTypeId}::${productId ?? "null"}`);
    if (toNumber(exact?.recycled_materials_pct) !== null) {
      return toNumber(exact?.recycled_materials_pct);
    }
    const fallback = factorByKey.get(`${plantId}::${mixTypeId}::null`);
    if (toNumber(fallback?.recycled_materials_pct) !== null) {
      return toNumber(fallback?.recycled_materials_pct);
    }
    return toNumber(defaultFactorByPlant.get(plantId)?.recycled_materials_pct);
  };

  const computeA1Factor = (productsList: Snapshot["scheme_products"] = []) => {
    const delivered = productsList.filter(
      (row) => (row.delivery_type ?? "delivery").toLowerCase() === "delivery"
    );
    const factorByProduct = new Map<string, number>();
    delivered.forEach((row, index) => {
      if (!row.mix_type_id) return;
      const plantId = row.plant_id ?? scheme.plant_id ?? null;
      const factor = resolveMixFactor(plantId, row.mix_type_id, row.product_id ?? null);
      if (factor === null) return;
      const key = row.product_id ?? `row-${index}`;
      if (!factorByProduct.has(key)) {
        factorByProduct.set(key, factor);
      }
    });

    if (!factorByProduct.size) return null;
    const total = Array.from(factorByProduct.values()).reduce((sum, value) => sum + value, 0);
    return total / factorByProduct.size;
  };

  const computeRecycledPct = (productsList: Snapshot["scheme_products"] = []) => {
    let weightedTotal = 0;
    let totalTonnage = 0;
    productsList.forEach((row) => {
      if (!row.mix_type_id) return;
      const plantId = row.plant_id ?? scheme.plant_id ?? null;
      const recycledPct = resolveRecycledPct(plantId, row.mix_type_id, row.product_id ?? null);
      const tonnage = toNumber(row.tonnage) ?? 0;
      if (recycledPct === null || tonnage <= 0) return;
      weightedTotal += recycledPct * tonnage;
      totalTonnage += tonnage;
    });
    if (totalTonnage <= 0) return null;
    return weightedTotal / totalTonnage;
  };

  const compareItems: CompareItem[] = [];

  if (livePayload) {
    const unit = (scheme.distance_unit ?? "km").toLowerCase() === "mi" ? "mi" : "km";
    compareItems.push({
      id: "live",
      title: "Live scheme",
      subtitle: scheme.name ?? "Current scheme",
      summary_total: livePayload.summary?.total_kgco2e ?? null,
      summary_per_tonne: livePayload.summary?.kgco2e_per_tonne ?? null,
      narrative: buildNarrative("Live scheme", livePayload.products, livePayload.install, unit),
      bullets: buildBullets(livePayload.products, livePayload.install, unit),
      lifecycle: buildLifecycle(livePayload.results),
      a1Factor: computeA1Factor(livePayload.products),
      recycledPct: computeRecycledPct(livePayload.products),
    });
  }

  scenarioIds.forEach((scenarioId, index) => {
    const scenario = scenarioById.get(scenarioId);
    if (!scenario) return;
    const snapshot = (scenario.snapshot ?? {}) as Snapshot;
    const unit = (scheme.distance_unit ?? "km").toLowerCase() === "mi" ? "mi" : "km";
    const label = scenario.label?.trim() || `Scenario ${index + 1}`;
    compareItems.push({
      id: scenarioId,
      title: label,
      subtitle: "Scenario snapshot",
      summary_total: snapshot.scheme_carbon_summary?.total_kgco2e ?? null,
      summary_per_tonne: snapshot.scheme_carbon_summary?.kgco2e_per_tonne ?? null,
      narrative: buildNarrative(
        label,
        snapshot.scheme_products ?? [],
        snapshot.scheme_installation_items ?? [],
        unit
      ),
      bullets: buildBullets(
        snapshot.scheme_products ?? [],
        snapshot.scheme_installation_items ?? [],
        unit
      ),
      lifecycle: buildLifecycle(snapshot.scheme_carbon_results ?? []),
      a1Factor: computeA1Factor(snapshot.scheme_products ?? []),
      recycledPct: computeRecycledPct(snapshot.scheme_products ?? []),
    });
  });

  const perTonneValues = compareItems
    .map((item) => item.summary_per_tonne)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const maxPerTonne = perTonneValues.length ? Math.max(...perTonneValues) : null;
  const minPerTonne = perTonneValues.length ? Math.min(...perTonneValues) : null;

  return {
    schemeName: scheme.name ?? "Scheme comparison",
    compareItems,
    deltaPerTonne: maxPerTonne !== null && minPerTonne !== null ? maxPerTonne - minPerTonne : 0,
    mapLayouts: mapLayoutResponse.data ?? [],
    co2Layouts: co2LayoutResponse.data ?? [],
    co2Metrics: co2MetricResponse.data ?? [],
  };
};

export async function generateComparePdfExport(
  schemeId: string,
  selected: string[],
  selectedSections: Set<string>
) {
  const normalizedSelected = selected.length ? [...selected] : ["live"];
  const selectedGraphSections: CompareChartStage[] = [
    { key: "graph-a1a3", stage: "A1-A3" as const },
    { key: "graph-a4", stage: "A4" as const },
    { key: "graph-a5", stage: "A5" as const },
    { key: "graph-a1a5", stage: "A1-A5" as const },
  ]
    .filter((entry) => selectedSections.has(entry.key))
    .map((entry) => entry.stage);

  const compareData = await loadCompareData(schemeId, normalizedSelected, selectedSections);
  if (!compareData) {
    return { error: "Scheme not found", status: 404 as const };
  }
  if (!compareData.compareItems.length) {
    return { error: "No comparison items selected", status: 400 as const };
  }

  const pdf = await PDFDocument.create();
  const [regular, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  const fonts: FontSet = { regular, bold };

  const [logoBytes, recycleBytes, mapBytes, co2Bytes] = await Promise.all([
    readPublicAsset("branding/holcim.png"),
    readPublicAsset("branding/recycle.png"),
    readPublicAsset("neils-map-ppt.png"),
    readPublicAsset("co2-image.png"),
  ]);

  const [logo, recycleImage, mapImage, co2Image] = await Promise.all([
    pdf.embedPng(logoBytes),
    pdf.embedPng(recycleBytes),
    pdf.embedPng(mapBytes),
    pdf.embedPng(co2Bytes),
  ]);

  const pagePlan: Array<{
    key: "overview" | "cards" | "map" | "co2";
    cardPageIndex?: number;
    cardPageCount?: number;
  }> = [];

  if (selectedGraphSections.length || selectedSections.has("recycled")) {
    pagePlan.push({ key: "overview" });
  }
  if (selectedSections.has("cards")) {
    const cardPageCount = Math.max(1, Math.ceil(compareData.compareItems.length / 4));
    for (let index = 0; index < cardPageCount; index += 1) {
      pagePlan.push({ key: "cards", cardPageIndex: index, cardPageCount });
    }
  }
  if (selectedSections.has("map")) {
    pagePlan.push({ key: "map" });
  }
  if (selectedSections.has("co2")) {
    pagePlan.push({ key: "co2" });
  }

  if (!pagePlan.length) {
    return { error: "No report sections selected", status: 400 as const };
  }

  if (pagePlan.some((entry) => entry.key === "overview")) {
    drawOverviewPage(
      pdf,
      fonts,
      logo,
      recycleImage,
      compareData.schemeName,
      compareData.compareItems,
      selectedGraphSections,
      selectedSections.has("recycled"),
      pagePlan.at(-1)?.key === "overview"
    );
  }

  if (selectedSections.has("cards")) {
    drawCardsPages(
      pdf,
      fonts,
      logo,
      compareData.schemeName,
      compareData.compareItems,
      (cardPageIndex, totalPagesWithinCards) =>
        pagePlan.at(-1)?.key === "cards" && cardPageIndex === totalPagesWithinCards - 1
    );
  }

  if (selectedSections.has("map")) {
    drawMapPage(
      pdf,
      fonts,
      logo,
      mapImage,
      compareData.compareItems[0],
      compareData.mapLayouts,
      pagePlan.at(-1)?.key === "map"
    );
  }

  if (selectedSections.has("co2")) {
    drawCo2Page(
      pdf,
      fonts,
      logo,
      co2Image,
      compareData.deltaPerTonne,
      compareData.co2Metrics,
      compareData.co2Layouts,
      pagePlan.at(-1)?.key === "co2"
    );
  }

  const pdfBytes = await pdf.save();
  const fileName = `${sanitizeFileName(compareData.schemeName)}-carbon-comparison.pdf`;
  return { bytes: pdfBytes, fileName, schemeName: compareData.schemeName };
}

export async function GET(request: Request, context: RouteContext) {
  const { schemeId } = await context.params;
  const url = new URL(request.url);
  const selected = (url.searchParams.get("items") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!selected.length) {
    selected.push("live");
  }

  const selectedSections = new Set(
    (url.searchParams.get("sections") ?? DEFAULT_SECTIONS)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  const result = await generateComparePdfExport(schemeId, selected, selectedSections);
  if ("error" in result) {
    return new Response(result.error, { status: result.status });
  }
  const responseBody = result.bytes.buffer.slice(
    result.bytes.byteOffset,
    result.bytes.byteOffset + result.bytes.byteLength
  ) as ArrayBuffer;

  return new Response(responseBody, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
