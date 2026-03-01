import path from "node:path";
import PptxGenJS from "pptxgenjs";
import {
  DEFAULT_SECTIONS,
  DISCLAIMER_TEXT,
  type CompareChartStage,
  type CompareItem,
  computeCo2Equivalencies,
  computeSavingPercentage,
  formatNumber,
  formatPercent,
  formatWholeNumber,
  getCo2Layout,
  getMapLayout,
  getMapStageValue,
  getStageTotalTonnes,
  loadCompareData,
  mapMarkers,
} from "../compare-pdf/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ schemeId: string }>;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SLIDE = {
  widthPt: 841.89,
  heightPt: 595.28,
  widthIn: 11.69,
  heightIn: 8.27,
};

const chartColors = ["7CD7FF", "6BD1A8", "F6C36B", "F08FB8"];
const colors = {
  text: "16243D",
  muted: "5C697D",
  border: "D3DCE7",
  soft: "F3F6FA",
  green: "3B9A62",
  navy: "16243D",
  white: "FFFFFF",
};

const IMAGE_SIZES = {
  logo: { width: 365, height: 84 },
  recycle: { width: 1024, height: 1024 },
  map: { width: 1474, height: 1093 },
  co2: { width: 1536, height: 1024 },
};

const publicPath = (...parts: string[]) => path.join(process.cwd(), "public", ...parts);
const logoPath = publicPath("branding", "holcim.png");
const recyclePath = publicPath("branding", "recycle.png");
const mapPath = publicPath("neils-map-ppt.png");
const co2Path = publicPath("co2-image.png");

const pt = (value: number) => Number((value / 72).toFixed(4));

const fitRect = (
  sourceWidth: number,
  sourceHeight: number,
  boxX: number,
  boxY: number,
  boxWidth: number,
  boxHeight: number
): Rect => {
  const sourceRatio = sourceWidth / sourceHeight;
  const boxRatio = boxWidth / boxHeight;

  let width = boxWidth;
  let height = boxHeight;

  if (sourceRatio > boxRatio) {
    height = width / sourceRatio;
  } else {
    width = height * sourceRatio;
  }

  return {
    x: boxX + (boxWidth - width) / 2,
    y: boxY + (boxHeight - height) / 2,
    width,
    height,
  };
};

const sanitizeFileName = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "carbon-comparison";
};

const CO2_BADGE_SPECS: Record<
  string,
  { width: number; height: number; text: string[]; circle?: boolean; numberWidth?: number }
> = {
  flights: {
    width: 156,
    height: 34,
    text: ["Return flights between the", "uk and sydney"],
    numberWidth: 24,
  },
  "car-world": {
    width: 150,
    height: 30,
    text: ["Times around the World"],
    numberWidth: 24,
  },
  "car-miles": {
    width: 210,
    height: 30,
    text: ["Miles a car can travel in a year"],
    numberWidth: 46,
  },
  homes: { width: 118, height: 26, text: ["UK homes heated"], numberWidth: 18 },
  trees: { width: 136, height: 26, text: ["Trees to offset"], numberWidth: 22 },
  people: {
    width: 184,
    height: 28,
    text: ["People's carbon footprint per year"],
    numberWidth: 18,
  },
  energy: {
    width: 210,
    height: 30,
    text: ["Light bulbs used for 8 hours"],
    numberWidth: 42,
  },
  stadium: { width: 206, height: 28, text: ["Schemes To fill Wembley Stadium"] },
  "stadium-value": { width: 48, height: 48, text: [""], circle: true },
};

const wrapWords = (text: string, maxChars: number, maxLines: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;
    if (lines.length === maxLines - 1) break;
  }

  const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  const remainingWords = words.slice(consumedWords);
  const lastLine = (remainingWords.length ? remainingWords.join(" ") : current).trim();
  lines.push(lastLine);

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines[lines.length - 1].length > maxChars + 6) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, maxChars + 3).trim()}...`;
  }

  return lines;
};

const addTextBox = (
  slide: PptxGenJS.Slide,
  text: string,
  rect: Rect,
  options: {
    fontSize?: number;
    bold?: boolean;
    color?: string;
    align?: "left" | "center" | "right";
    valign?: "top" | "middle" | "bottom";
    margin?: number;
    italic?: boolean;
    fit?: "none" | "shrink" | "resize";
    wrap?: boolean;
  } = {}
) => {
  slide.addText(text, {
    x: pt(rect.x),
    y: pt(rect.y),
    w: pt(rect.width),
    h: pt(rect.height),
    fontFace: "Arial",
    fontSize: options.fontSize ?? 10,
    bold: options.bold ?? false,
    italic: options.italic ?? false,
    color: options.color ?? colors.text,
    align: options.align ?? "left",
    valign: options.valign ?? "middle",
    margin: options.margin ?? 0,
    fit: options.fit ?? "shrink",
    breakLine: false,
    wrap: options.wrap ?? true,
    paraSpaceAfter: 0,
    lineSpacingMultiple: 1,
  });
};

const drawMapMarker = (
  slide: PptxGenJS.Slide,
  label: string,
  valueText: string,
  rect: Rect
) => {
  const pointHeight = rect.height * 0.28;
  const bodyHeight = rect.height - pointHeight;
  const labelFontSize = label.length > 3 ? Math.max(7.5, rect.width * 0.13) : Math.max(8.5, rect.width * 0.16);
  const valueFontSize = Math.max(7.2, rect.width * 0.14);

  slide.addShape("rect", {
    x: pt(rect.x),
    y: pt(rect.y),
    w: pt(rect.width),
    h: pt(bodyHeight),
    line: { color: colors.green, transparency: 100 },
    fill: { color: colors.green },
  });

  slide.addShape("triangle", {
    x: pt(rect.x),
    y: pt(rect.y + bodyHeight - 0.5),
    w: pt(rect.width),
    h: pt(pointHeight + 0.5),
    rotate: 180,
    line: { color: colors.green, transparency: 100 },
    fill: { color: colors.green },
  });

  addTextBox(
    slide,
    label,
    {
      x: rect.x + rect.width * 0.08,
      y: rect.y + rect.height * 0.12,
      width: rect.width * 0.84,
      height: rect.height * 0.2,
    },
    { fontSize: labelFontSize, bold: true, color: colors.white, align: "center" }
  );

  addTextBox(
    slide,
    valueText,
    {
      x: rect.x + rect.width * 0.08,
      y: rect.y + rect.height * 0.36,
      width: rect.width * 0.84,
      height: rect.height * 0.18,
    },
    { fontSize: valueFontSize, bold: true, color: colors.white, align: "center" }
  );
};

const drawDisclaimer = (slide: PptxGenJS.Slide) => {
  addTextBox(
    slide,
    DISCLAIMER_TEXT,
    { x: 80, y: SLIDE.heightPt - 24, width: SLIDE.widthPt - 160, height: 12 },
    { fontSize: 7, color: colors.muted, align: "center" }
  );
};

const drawHeader = (
  slide: PptxGenJS.Slide,
  schemeName?: string,
  options: { kicker?: string; logoWidthPt?: number } = {}
) => {
  const logoWidth = options.logoWidthPt ?? 92;
  const logoHeight = (IMAGE_SIZES.logo.height / IMAGE_SIZES.logo.width) * logoWidth;
  const logoX = (SLIDE.widthPt - logoWidth) / 2;
  const logoY = 18;

  slide.addImage({
    path: logoPath,
    x: pt(logoX),
    y: pt(logoY),
    w: pt(logoWidth),
    h: pt(logoHeight),
  });

  let nextY = logoY + logoHeight + 8;
  if (options.kicker) {
    addTextBox(
      slide,
      options.kicker.toUpperCase(),
      { x: 0, y: nextY, width: SLIDE.widthPt, height: 10 },
      { fontSize: 7.5, color: colors.muted, align: "center" }
    );
    nextY += 10;
  }
  if (schemeName) {
    addTextBox(
      slide,
      schemeName,
      { x: 0, y: nextY, width: SLIDE.widthPt, height: 16 },
      { fontSize: 15, bold: true, align: "center" }
    );
    nextY += 18;
  }

  return nextY;
};

const drawBarChart = (
  slide: PptxGenJS.Slide,
  rect: Rect,
  options: {
    title: string;
    items: CompareItem[];
    values: Array<number | null>;
    valueFormatter: (value: number | null) => string;
  }
) => {
  addTextBox(slide, options.title, { x: rect.x, y: rect.y, width: rect.width, height: 16 }, { fontSize: 14, bold: true });

  const chartTop = rect.y + 24;
  const chartBottom = rect.y + rect.height - 44;
  const chartHeight = chartBottom - chartTop;
  const count = Math.max(1, options.items.length);
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
    const barY = chartBottom - barHeight;

    slide.addShape("rect", {
      x: pt(barX),
      y: pt(barY),
      w: pt(barWidth),
      h: pt(barHeight),
      line: { color: chartColors[index % chartColors.length], transparency: 100 },
      fill: { color: chartColors[index % chartColors.length] },
    });

    addTextBox(
      slide,
      options.valueFormatter(value),
      { x: slotX, y: chartBottom + 4, width: slotWidth, height: 10 },
      { fontSize: 7.5, color: colors.muted, align: "center" }
    );

    const labelLines = wrapWords(item.title.replace(/,\s*/g, ", "), 14, 4);
    addTextBox(
      slide,
      labelLines.join("\n"),
      { x: slotX + 2, y: chartBottom + 14, width: slotWidth - 4, height: 32 },
      { fontSize: 7.4, align: "center", valign: "top" }
    );
  });
};

const drawOverviewSlide = (
  pptx: PptxGenJS,
  schemeName: string,
  items: CompareItem[],
  selectedGraphSections: CompareChartStage[],
  includeRecycled: boolean,
  isLastSlide: boolean
) => {
  const slide = pptx.addSlide();
  const headerBottom = drawHeader(slide, schemeName, {
    kicker: "Carbon Comparison",
    logoWidthPt: 92,
  });

  const marginX = 24;
  const gapX = 22;
  const contentWidth = SLIDE.widthPt - marginX * 2;
  const chartWidth = (contentWidth - gapX) / 2;
  const chartHeight = 118;
  const chartGapY = 20;
  const topY = headerBottom + 4;

  const chartRects: Rect[] = [];
  for (let index = 0; index < selectedGraphSections.length; index += 1) {
    const row = Math.floor(index / 2);
    const col = index % 2;
    chartRects.push({
      x: marginX + col * (chartWidth + gapX),
      y: topY + row * (chartHeight + chartGapY),
      width: chartWidth,
      height: chartHeight,
    });
  }

  selectedGraphSections.forEach((stage, index) => {
    const values = items.map((item) => getStageTotalTonnes(item, stage));
    drawBarChart(slide, chartRects[index], {
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
      y: topY + row * (chartHeight + chartGapY) + 10,
      width: chartWidth,
      height: 156,
    };

    const values = items.map((item) =>
      item.recycledPct !== null && item.recycledPct !== undefined && Number.isFinite(item.recycledPct)
        ? item.recycledPct
        : null
    );
    drawBarChart(slide, recycledRect, {
      title: "Recycled material content (%)",
      items,
      values,
      valueFormatter: (value) => (value !== null ? formatPercent(value) : "-"),
    });

    const recyclePanel: Rect = {
      x: marginX + chartWidth + gapX,
      y: recycledRect.y,
      width: chartWidth,
      height: recycledRect.height,
    };
    const recycleFitBase = fitRect(
      IMAGE_SIZES.recycle.width,
      IMAGE_SIZES.recycle.height,
      recyclePanel.x + 18,
      recyclePanel.y + 12,
      recyclePanel.width - 36,
      recyclePanel.height - 24
    );
    const recycleFit = {
      x: recycleFitBase.x + recycleFitBase.width * 0.14,
      y: recycleFitBase.y + recycleFitBase.height * 0.14,
      width: recycleFitBase.width * 0.72,
      height: recycleFitBase.height * 0.72,
    };

    slide.addImage({
      path: recyclePath,
      x: pt(recycleFit.x),
      y: pt(recycleFit.y),
      w: pt(recycleFit.width),
      h: pt(recycleFit.height),
    });

    const savingPct = computeSavingPercentage(items);
    const overlayWidth = Math.min(100, recyclePanel.width * 0.32);
    const overlayHeight = 40;
    const overlayX = recycleFit.x + recycleFit.width / 2 - overlayWidth / 2;
    const overlayY = recycleFit.y + recycleFit.height / 2 - overlayHeight / 2;
    slide.addShape("roundRect", {
      x: pt(overlayX),
      y: pt(overlayY),
      w: pt(overlayWidth),
      h: pt(overlayHeight),
      rectRadius: 0.08,
      fill: { color: colors.navy },
      line: { color: colors.navy, transparency: 100 },
    });
    addTextBox(
      slide,
      "CO2E/T SAVING",
      { x: overlayX, y: overlayY + 5, width: overlayWidth, height: 10 },
      { fontSize: 8, bold: true, color: colors.white, align: "center" }
    );
    addTextBox(
      slide,
      savingPct !== null ? formatPercent(savingPct) : "-",
      { x: overlayX, y: overlayY + 18, width: overlayWidth, height: 14 },
      { fontSize: 13, bold: true, color: colors.white, align: "center" }
    );
  }

  if (isLastSlide) {
    drawDisclaimer(slide);
  }
};

const drawInfoBox = (
  slide: PptxGenJS.Slide,
  rect: Rect,
  label: string,
  value: string
) => {
  slide.addShape("rect", {
    x: pt(rect.x),
    y: pt(rect.y),
    w: pt(rect.width),
    h: pt(rect.height),
    fill: { color: colors.soft },
    line: { color: colors.border, pt: 1 },
  });
  addTextBox(
    slide,
    label.toUpperCase(),
    { x: rect.x + 8, y: rect.y + 4, width: rect.width - 16, height: 8 },
    { fontSize: 6.5, color: colors.muted }
  );
  addTextBox(
    slide,
    value,
    { x: rect.x + 8, y: rect.y + 14, width: rect.width - 16, height: 14 },
    { fontSize: 10.5, bold: true }
  );
};

const drawComparisonCard = (slide: PptxGenJS.Slide, rect: Rect, item: CompareItem) => {
  slide.addShape("rect", {
    x: pt(rect.x),
    y: pt(rect.y),
    w: pt(rect.width),
    h: pt(rect.height),
    fill: { color: colors.white },
    line: { color: colors.border, pt: 1 },
  });

  const innerX = rect.x + 14;
  const innerWidth = rect.width - 28;
  let cursorY = rect.y + 12;

  addTextBox(
    slide,
    item.subtitle.toUpperCase(),
    { x: innerX, y: cursorY, width: innerWidth, height: 10 },
    { fontSize: 7, color: colors.muted }
  );
  cursorY += 12;

  addTextBox(
    slide,
    item.title,
    { x: innerX, y: cursorY, width: innerWidth, height: 32 },
    { fontSize: 13, bold: true, fit: "shrink" }
  );
  cursorY += 34;

  const infoHeight = 34;
  const infoGap = 10;
  const infoWidth = (innerWidth - infoGap) / 2;
  drawInfoBox(
    slide,
    { x: innerX, y: cursorY, width: infoWidth, height: infoHeight },
    "Total kgCO2e",
    formatNumber(item.summary_total, 2)
  );
  drawInfoBox(
    slide,
    { x: innerX + infoWidth + infoGap, y: cursorY, width: infoWidth, height: infoHeight },
    "kgCO2e / tonne",
    formatNumber(item.summary_per_tonne, 2)
  );
  cursorY += infoHeight + 12;

  addTextBox(slide, "Stage", { x: innerX, y: cursorY, width: 36, height: 10 }, { fontSize: 7, bold: true, color: colors.muted });
  addTextBox(slide, "Description", { x: innerX + 42, y: cursorY, width: innerWidth - 150, height: 10 }, { fontSize: 7, bold: true, color: colors.muted });
  addTextBox(slide, "kgCO2e", { x: rect.x + rect.width - 110, y: cursorY, width: 54, height: 10 }, { fontSize: 7, bold: true, color: colors.muted, align: "right" });
  addTextBox(slide, "/ t", { x: rect.x + rect.width - 48, y: cursorY, width: 28, height: 10 }, { fontSize: 7, bold: true, color: colors.muted, align: "right" });
  cursorY += 10;

  const lifecycleStages = ["A2", "A3", "A4", "A5"].map((stage) => {
    const found = item.lifecycle.find((row) => row.stage === stage);
    return {
      stage,
      description: found?.description ?? stage,
      total: found?.total_kgco2e ?? null,
      perTonne: found?.kgco2e_per_tonne ?? null,
    };
  });

  lifecycleStages.forEach((row) => {
    addTextBox(slide, row.stage, { x: innerX, y: cursorY, width: 36, height: 12 }, { fontSize: 9, bold: true });
    addTextBox(slide, row.description, { x: innerX + 42, y: cursorY, width: innerWidth - 150, height: 12 }, { fontSize: 8.4, fit: "shrink" });
    addTextBox(slide, formatNumber(row.total, 2), { x: rect.x + rect.width - 110, y: cursorY, width: 54, height: 12 }, { fontSize: 8.4, align: "right" });
    addTextBox(slide, formatNumber(row.perTonne, 2), { x: rect.x + rect.width - 48, y: cursorY, width: 28, height: 12 }, { fontSize: 8.4, align: "right" });
    cursorY += 14;
  });

  cursorY += 4;
  addTextBox(slide, `A1 factor: ${formatNumber(item.a1Factor ?? null, 2)}`, { x: innerX, y: cursorY, width: innerWidth / 2, height: 12 }, { fontSize: 8.4 });
  addTextBox(slide, `Recycled: ${formatPercent(item.recycledPct ?? null)}`, { x: innerX + innerWidth / 2, y: cursorY, width: innerWidth / 2, height: 12 }, { fontSize: 8.4, align: "right" });
  cursorY += 18;

  const bulletText = item.bullets.slice(0, 3).map((bullet) => `- ${bullet}`).join("\n");
  addTextBox(
    slide,
    bulletText,
    { x: innerX, y: cursorY, width: innerWidth, height: rect.y + rect.height - cursorY - 12 },
    { fontSize: 8, color: colors.muted, valign: "top", fit: "shrink" }
  );
};

const drawCardsSlides = (
  pptx: PptxGenJS,
  schemeName: string,
  items: CompareItem[],
  isLastSlide: (pageIndex: number, totalPages: number) => boolean
) => {
  const chunkSize = 2;
  const totalPages = Math.max(1, Math.ceil(items.length / chunkSize));

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const slide = pptx.addSlide();
    const headerBottom = drawHeader(slide, schemeName, {
      kicker: "Carbon Comparison",
      logoWidthPt: 92,
    });

    const marginX = 26;
    const gapX = 18;
    const cardWidth = (SLIDE.widthPt - marginX * 2 - gapX) / 2;
    const cardHeight = SLIDE.heightPt - headerBottom - 40;
    const topY = headerBottom + 8;
    const chunk = items.slice(pageIndex * chunkSize, pageIndex * chunkSize + chunkSize);

    chunk.forEach((item, index) => {
      drawComparisonCard(slide, {
        x: marginX + index * (cardWidth + gapX),
        y: topY,
        width: cardWidth,
        height: cardHeight,
      }, item);
    });

    if (isLastSlide(pageIndex, totalPages)) {
      drawDisclaimer(slide);
    }
  }
};

const drawMapSlide = (
  pptx: PptxGenJS,
  item: CompareItem,
  layouts: Parameters<typeof getMapLayout>[0],
  isLastSlide: boolean
) => {
  const slide = pptx.addSlide();
  const headerBottom = drawHeader(slide, undefined, { logoWidthPt: 92 });
  const mapRect = fitRect(
    IMAGE_SIZES.map.width,
    IMAGE_SIZES.map.height,
    18,
    headerBottom + 8,
    SLIDE.widthPt - 36,
    SLIDE.heightPt - headerBottom - (isLastSlide ? 34 : 22) - 16
  );

  slide.addImage({
    path: mapPath,
    x: pt(mapRect.x),
    y: pt(mapRect.y),
    w: pt(mapRect.width),
    h: pt(mapRect.height),
  });

  const layoutMap = getMapLayout(layouts);
  mapMarkers.forEach((marker) => {
    const layout = layoutMap.get(marker.key);
    if (!layout) return;

    const scale = layout.scale * 0.54;
    const tipX = mapRect.x + (layout.x / 100) * mapRect.width;
    const tipY = mapRect.y + (layout.y / 100) * mapRect.height + 12;
    const markerWidth = (marker.label.length > 3 ? 54 : 41) * scale;
    const markerHeight = (marker.label.length > 3 ? 66 : 60) * scale;
    const markerX = tipX - markerWidth / 2;
    const markerY = tipY - markerHeight;

    drawMapMarker(slide, marker.label, formatNumber(getMapStageValue(item, marker.stage), 2), {
      x: markerX,
      y: markerY,
      width: markerWidth,
      height: markerHeight,
    });
  });

  if (isLastSlide) {
    drawDisclaimer(slide);
  }
};

const drawBadge = (
  slide: PptxGenJS.Slide,
  key: keyof typeof CO2_BADGE_SPECS,
  centerX: number,
  centerY: number,
  lines: Array<{ number?: string; text: string }>,
  scale: number,
  options: { circle?: boolean; textScale?: number; paddingScale?: number } = {}
) => {
  const spec = CO2_BADGE_SPECS[key];
  const width = spec.width * scale;
  const height = spec.height * scale;
  const leftX = centerX - width / 2;
  const topY = centerY - height / 2;
  const textScale = options.textScale ?? 1;

  slide.addShape(spec.circle ? "ellipse" : "roundRect", {
    x: pt(leftX),
    y: pt(topY),
    w: pt(width),
    h: pt(height),
    rectRadius: spec.circle ? undefined : 0.08,
    fill: { color: colors.white },
    line: { color: colors.border, pt: 1 },
  });

  if (spec.circle) {
    addTextBox(
      slide,
      lines[0]?.text ?? "",
      { x: leftX, y: topY, width, height },
      { fontSize: 14 * scale * textScale, bold: true, align: "center", valign: "middle" }
    );
    return;
  }

  const paddingX = 9 * scale;
  const paddingY = 5 * scale;
  const numberWidth = (spec.numberWidth ?? 0) * scale;
  const gap = 6 * scale;
  const numberText = lines[0]?.number ?? "";
  const labelLines = lines.flatMap((line, index) => {
    if (index === 0) return line.text ? [line.text] : [];
    return line.text ? [line.text] : [];
  });
  const textBlockX = leftX + paddingX + (numberText ? numberWidth + gap : 0);
  const textBlockWidth = width - paddingX * 2 - (numberText ? numberWidth + gap : 0);

  if (numberText) {
    addTextBox(
      slide,
      numberText,
      { x: leftX + paddingX, y: topY, width: numberWidth, height },
      {
        fontSize: 10 * scale * textScale,
        bold: true,
        align: "right",
        valign: "middle",
        wrap: false,
        fit: "shrink",
      }
    );
  }

  addTextBox(
    slide,
    labelLines.join("\n"),
    { x: textBlockX, y: topY + paddingY, width: textBlockWidth, height: height - paddingY * 2 },
    {
      fontSize: (labelLines.length > 1 ? 7.8 : 9) * scale * textScale,
      align: labelLines.length > 1 ? "left" : numberText ? "left" : "center",
      valign: "middle",
      margin: 0,
      wrap: false,
      fit: "shrink",
    }
  );
};

const drawCo2Slide = (
  pptx: PptxGenJS,
  tonnes: number,
  metrics: Parameters<typeof computeCo2Equivalencies>[1],
  layouts: Parameters<typeof getCo2Layout>[1],
  isLastSlide: boolean
) => {
  const slide = pptx.addSlide();
  const headerBottom = drawHeader(slide, undefined, { logoWidthPt: 92 });
  const imageRect = fitRect(
    IMAGE_SIZES.co2.width,
    IMAGE_SIZES.co2.height,
    18,
    headerBottom + 8,
    SLIDE.widthPt - 36,
    SLIDE.heightPt - headerBottom - (isLastSlide ? 34 : 22) - 16
  );

  slide.addImage({
    path: co2Path,
    x: pt(imageRect.x),
    y: pt(imageRect.y),
    w: pt(imageRect.width),
    h: pt(imageRect.height),
  });

  const values = computeCo2Equivalencies(tonnes, metrics);
  const resolvePoint = (key: string) => {
    const layout = getCo2Layout(key, layouts);
    return {
      centerX: imageRect.x + (layout.x / 100) * imageRect.width,
      centerY: imageRect.y + (layout.y / 100) * imageRect.height,
      scale: layout.scale,
    };
  };

  {
    const point = resolvePoint("flights");
    drawBadge(
      slide,
      "flights",
      point.centerX,
      point.centerY,
      [
        { number: formatWholeNumber(values.flights), text: "Return flights between the" },
        { text: "uk and sydney" },
      ],
      point.scale * 0.82
    );
  }
  {
    const point = resolvePoint("car-world");
    drawBadge(
      slide,
      "car-world",
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.timesAroundWorld), text: "Times around the World" }],
      point.scale * 0.84
    );
  }
  {
    const point = resolvePoint("car-miles");
    drawBadge(
      slide,
      "car-miles",
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.cars), text: "Miles a car can travel in a year" }],
      point.scale * 0.84
    );
  }
  {
    const point = resolvePoint("homes");
    drawBadge(
      slide,
      "homes",
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.homes), text: "UK homes heated" }],
      point.scale * 0.84
    );
  }
  {
    const point = resolvePoint("trees");
    drawBadge(
      slide,
      "trees",
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.trees), text: "Trees to offset" }],
      point.scale * 0.84
    );
  }
  {
    const point = resolvePoint("people");
    drawBadge(
      slide,
      "people",
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.people), text: "People's carbon footprint per year" }],
      point.scale * 0.84
    );
  }
  {
    const point = resolvePoint("energy");
    drawBadge(
      slide,
      "energy",
      point.centerX,
      point.centerY,
      [{ number: formatWholeNumber(values.energy), text: "Light bulbs used for 8 hours" }],
      point.scale * 0.76
    );
  }
  {
    const point = resolvePoint("stadium");
    drawBadge(
      slide,
      "stadium",
      point.centerX,
      point.centerY,
      [{ text: "Schemes To fill Wembley Stadium" }],
      point.scale * 0.82
    );
  }
  {
    const point = resolvePoint("stadium-value");
    drawBadge(
      slide,
      "stadium-value",
      point.centerX,
      point.centerY,
      [{ text: formatWholeNumber(values.stadium) }],
      point.scale * 0.43,
      { circle: true, textScale: 1.18, paddingScale: 0.84 }
    );
  }

  if (isLastSlide) {
    drawDisclaimer(slide);
  }
};

export async function GET(request: Request, context: RouteContext) {
  const { schemeId } = await context.params;
  const url = new URL(request.url);
  const selected = (url.searchParams.get("items") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const selectedSections = new Set(
    (url.searchParams.get("sections") ?? DEFAULT_SECTIONS)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  const result = await generateComparePptxExport(schemeId, selected, selectedSections);
  if ("error" in result) {
    return new Response(result.error, { status: result.status });
  }
  return new Response(result.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function generateComparePptxExport(
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

  const pagePlan: Array<"overview" | "cards" | "map" | "co2"> = [];
  if (selectedGraphSections.length || selectedSections.has("recycled")) pagePlan.push("overview");
  if (selectedSections.has("cards")) {
    const cardPageCount = Math.max(1, Math.ceil(compareData.compareItems.length / 2));
    for (let index = 0; index < cardPageCount; index += 1) pagePlan.push("cards");
  }
  if (selectedSections.has("map")) pagePlan.push("map");
  if (selectedSections.has("co2")) pagePlan.push("co2");

  if (!pagePlan.length) {
    return { error: "No report sections selected", status: 400 as const };
  }

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "A4L", width: SLIDE.widthIn, height: SLIDE.heightIn });
  pptx.layout = "A4L";
  pptx.author = "Holcim Carbon Calculator Portal";
  pptx.company = "Holcim";
  pptx.subject = "Carbon Comparison";
  pptx.title = `${compareData.schemeName} Carbon Comparison`;

  let slideIndex = 0;
  const isLastSlide = () => slideIndex === pagePlan.length - 1;

  if (pagePlan[slideIndex] === "overview") {
    drawOverviewSlide(
      pptx,
      compareData.schemeName,
      compareData.compareItems,
      selectedGraphSections,
      selectedSections.has("recycled"),
      isLastSlide()
    );
    slideIndex += 1;
  }

  if (selectedSections.has("cards")) {
    const totalCardSlides = Math.max(1, Math.ceil(compareData.compareItems.length / 2));
    drawCardsSlides(
      pptx,
      compareData.schemeName,
      compareData.compareItems,
      (pageIndex, totalPages) => {
        const thisSlideIndex = slideIndex + pageIndex;
        return thisSlideIndex === pagePlan.length - 1 && pageIndex === totalPages - 1;
      }
    );
    slideIndex += totalCardSlides;
  }

  if (selectedSections.has("map")) {
    drawMapSlide(pptx, compareData.compareItems[0], compareData.mapLayouts, isLastSlide());
    slideIndex += 1;
  }

  if (selectedSections.has("co2")) {
    drawCo2Slide(
      pptx,
      compareData.compareItems[0].summary_total ? compareData.compareItems[0].summary_total / 1000 : 0,
      compareData.co2Metrics,
      compareData.co2Layouts,
      isLastSlide()
    );
  }

  const buffer = await pptx.write({ outputType: "nodebuffer", compression: true });
  const fileName = `${sanitizeFileName(compareData.schemeName)}-carbon-comparison.pptx`;
  return { buffer, fileName, schemeName: compareData.schemeName };
}
