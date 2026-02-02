import { config as loadEnv } from "dotenv";
import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });
loadEnv();

const YEAR = Number(process.env.GHG_YEAR ?? 2025);
const SOURCE_URL =
  process.env.GHG_FLAT_FILE_URL ??
  "https://assets.publishing.service.gov.uk/media/6846b6ea57f3515d9611f0dd/ghg-conversion-factors-2025-flat-format.xlsx";
const SOURCE_PATH = process.env.GHG_FLAT_FILE_PATH;

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const normalizeHeader = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const inferCategory = ({ level1, level2, level3, columnText }) => {
  const text = [level1, level2, level3, columnText]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(flight|aviation|air travel|aircraft)/.test(text)) return "flights";
  if (/(electricity|grid|kwh|power)/.test(text)) return "electricity";
  if (/(fuel|combustion|diesel|petrol|gas oil|lpg|biofuel)/.test(text))
    return "fuels";
  if (
    /(road|car|van|bus|hgv|lorry|vehicle|freight|truck)/.test(text)
  )
    return "road_travel";
  if (/(forestry|woodland|forest)/.test(text)) return "forestry";
  if (/(agriculture|agricultural|farming|livestock)/.test(text))
    return "agriculture";
  if (/(population|percapita|per person)/.test(text)) return "population";
  return "other";
};

const fetchWorkbook = async () => {
  if (SOURCE_PATH) {
    const resolved = path.resolve(SOURCE_PATH);
    const buffer = fs.readFileSync(resolved);
    return xlsx.read(buffer, { type: "buffer" });
  }

  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to download flat file: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return xlsx.read(buffer, { type: "array" });
};

const HEADER_TOKENS = [
  "id",
  "scope",
  "level1",
  "level2",
  "level3",
  "level4",
  "level5",
  "level6",
  "columntext",
  "uom",
  "unit",
  "ghgunit",
  "ghgconversionfactor",
  "ghgconversionfactor2025",
  "ghgconversionfactor2024",
  "ghgconversionfactor2023",
];

const detectHeaderRow = (sheet) => {
  const preview = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    range: 0,
    blankrows: false,
  });

  let best = null;
  preview.slice(0, 50).forEach((row, index) => {
    const normalized = (row ?? []).map(normalizeHeader).filter(Boolean);
    if (!normalized.length) return;
    const hits = normalized.filter((value) =>
      HEADER_TOKENS.some((token) => value === token || value.includes(token))
    ).length;
    const score = hits;
    if (!best || score > best.score) {
      best = { index, score };
    }
  });

  if (!best || best.score < 4) {
    return null;
  }

  return best;
};

const selectSheet = (book) => {
  const candidates = book.SheetNames ?? [];
  if (!candidates.length) return null;

  let best = null;
  for (const name of candidates) {
    const sheet = book.Sheets[name];
    const headerInfo = detectHeaderRow(sheet);
    if (!headerInfo) continue;
    if (!best || headerInfo.score > best.score) {
      best = { name, headerIndex: headerInfo.index, score: headerInfo.score };
    }
  }

  return best;
};

const workbook = await fetchWorkbook();
console.log(`Sheets found: ${workbook.SheetNames.join(", ")}`);
const preferredSheet = process.env.GHG_SHEET_NAME;
const headerOverrideRaw = process.env.GHG_HEADER_ROW;
const headerOverride = headerOverrideRaw ? Number(headerOverrideRaw) : null;

const selectedSheet =
  preferredSheet && workbook.SheetNames.includes(preferredSheet)
    ? {
        name: preferredSheet,
        headerIndex:
          headerOverride ??
          detectHeaderRow(workbook.Sheets[preferredSheet])?.index ??
          0,
        score: 999,
      }
    : selectSheet(workbook);
if (!selectedSheet) {
  console.error("No worksheets found in the flat file.");
  process.exit(1);
}

console.log(`Using worksheet: ${selectedSheet.name}`);
const sheet = workbook.Sheets[selectedSheet.name];
if (headerOverride !== null) {
  console.log(`Header row override: ${headerOverride}`);
}
let rows = xlsx.utils.sheet_to_json(sheet, {
  defval: null,
  range: selectedSheet.headerIndex ?? 0,
});

const headerPreview = xlsx.utils.sheet_to_json(sheet, {
  header: 1,
  range: selectedSheet.headerIndex ?? 0,
  blankrows: false,
});
console.log(
  `Header row (${selectedSheet.headerIndex ?? 0}):`,
  (headerPreview[0] ?? []).join(", ")
);

if (!rows.length) {
  console.error("No rows found in the flat file.");
  process.exit(1);
}

const headerTokens = [
  "id",
  "scope",
  "level1",
  "level2",
  "level3",
  "level4",
  "level5",
  "level6",
  "columntext",
  "uom",
  "unit",
  "ghgunit",
  "ghgconversionfactor",
  "ghgconversionfactor2025",
];

const initialHeaders = Object.keys(rows[0] ?? {});
const normalizedHeaders = initialHeaders.map(normalizeHeader);
const headerHits = normalizedHeaders.filter((value) =>
  headerTokens.some((token) => value === token || value.includes(token))
).length;

if (headerHits < 3) {
  const range = xlsx.utils.decode_range(sheet["!ref"]);
  const columnCount = range.e.c + 1;
  let fallbackHeaders;

  if (columnCount <= 10) {
    fallbackHeaders = [
      "id",
      "scope",
      "level1",
      "level2",
      "level3",
      "level4",
      "column_text",
      "uom",
      "ghg_unit",
      "factor",
    ];
  } else if (columnCount === 11) {
    fallbackHeaders = [
      "id",
      "scope",
      "level1",
      "level2",
      "level3",
      "level4",
      "level5",
      "column_text",
      "uom",
      "ghg_unit",
      "factor",
    ];
  } else {
    fallbackHeaders = [
      "id",
      "scope",
      "level1",
      "level2",
      "level3",
      "level4",
      "level5",
      "level6",
      "column_text",
      "uom",
      "ghg_unit",
      "factor",
    ];
  }

  while (fallbackHeaders.length < columnCount) {
    fallbackHeaders.push(`extra_${fallbackHeaders.length}`);
  }

  rows = xlsx.utils.sheet_to_json(sheet, {
    defval: null,
    range: selectedSheet.headerIndex ?? 0,
    header: fallbackHeaders.slice(0, columnCount),
  });

  console.log("Header row did not match expected tokens. Using fallback columns.");
}

const headers = Object.keys(rows[0] ?? {});
const headerLookup = headers.reduce((acc, header) => {
  acc[normalizeHeader(header)] = header;
  return acc;
}, {});

const pick = (...keys) => {
  for (const key of keys) {
    if (headerLookup[key]) return headerLookup[key];
  }
  return null;
};

const columnMap = {
  level1: pick("level1"),
  level2: pick("level2"),
  level3: pick("level3"),
  level4: pick("level4"),
  level5: pick("level5"),
  level6: pick("level6"),
  columnText: pick("columntext", "columntextdescription", "columndescription"),
  uom: pick("uom", "unit", "units", "unitofmeasure", "unitofmeasurement"),
  ghgUnit: pick("ghgunit", "ghgunitper", "ghgperunit"),
  factor: pick(
    "kgco2eperunit",
    "ghgconversionfactor",
    "conversionfactor",
    "kgco2eper",
    "kgco2e",
    "factor",
    "ghgconversionfactor2025",
    "ghgconversionfactor2024",
    "ghgconversionfactor2023",
    "totalghg"
  ),
  co2: pick("co2", "co2kg"),
  ch4: pick("ch4", "ch4kg"),
  n2o: pick("n2o", "n2okg"),
  scope: pick("scope", "scopetag"),
  source: pick("source", "datasource"),
};

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const records = [];
for (const row of rows) {
  const level1 = columnMap.level1 ? row[columnMap.level1] : null;
  const level2 = columnMap.level2 ? row[columnMap.level2] : null;
  const level3 = columnMap.level3 ? row[columnMap.level3] : null;
  const level4 = columnMap.level4 ? row[columnMap.level4] : null;
  const level5 = columnMap.level5 ? row[columnMap.level5] : null;
  const level6 = columnMap.level6 ? row[columnMap.level6] : null;
  const columnText = columnMap.columnText ? row[columnMap.columnText] : null;
  const unit = columnMap.uom ? row[columnMap.uom] : null;
  const ghgUnit = columnMap.ghgUnit ? row[columnMap.ghgUnit] : null;
  const factor = columnMap.factor ? toNumber(row[columnMap.factor]) : null;

  if (factor === null || unit === null) {
    continue;
  }

  const categoryKey = inferCategory({
    level1,
    level2,
    level3,
    columnText,
  });

  records.push({
    year: YEAR,
    category_key: categoryKey,
    level1,
    level2,
    level3,
    level4,
    level5,
    level6,
    column_text: columnText,
    unit,
    ghg_unit: ghgUnit,
    factor,
    co2: columnMap.co2 ? toNumber(row[columnMap.co2]) : null,
    ch4: columnMap.ch4 ? toNumber(row[columnMap.ch4]) : null,
    n2o: columnMap.n2o ? toNumber(row[columnMap.n2o]) : null,
    scope: columnMap.scope ? row[columnMap.scope] : null,
    source:
      (columnMap.source ? row[columnMap.source] : null) ??
      "UK Government GHG Conversion Factors 2025",
    raw: row,
    is_active: true,
  });
}

console.log(`Parsed ${records.length} factor rows for ${YEAR}.`);

if (!records.length) {
  console.error(
    "No factor rows extracted. The flat file headers may have changed."
  );
  console.error("Detected headers:", headers.join(", "));
  process.exit(1);
}

const { error: deleteError } = await supabase
  .from("ghg_factors")
  .delete()
  .eq("year", YEAR);

if (deleteError) {
  console.error("Failed to clear existing rows:", deleteError.message);
  process.exit(1);
}

const chunkSize = 500;
for (let i = 0; i < records.length; i += chunkSize) {
  const chunk = records.slice(i, i + chunkSize);
  const { error } = await supabase.from("ghg_factors").insert(chunk);
  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }
  console.log(`Inserted ${Math.min(i + chunkSize, records.length)} rows...`);
}

console.log("Import complete.");
