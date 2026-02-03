import fs from "node:fs";
import path from "node:path";
import xlsx from "xlsx";

const outputDir = path.resolve("public", "templates");
fs.mkdirSync(outputDir, { recursive: true });

const writeTemplate = (fileName, sheetName, headers, exampleRow, columnWidths) => {
  const data = [headers, exampleRow];
  const worksheet = xlsx.utils.aoa_to_sheet(data);
  worksheet["!cols"] = columnWidths.map((wch) => ({ wch }));
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  const filePath = path.join(outputDir, fileName);
  xlsx.writeFile(workbook, filePath, { compression: true });
};

writeTemplate(
  "plants-template.xlsx",
  "Plants",
  ["name", "location", "description", "is_default"],
  ["Example Plant", "cv09 02rs", "Main asphalt plant", "false"],
  [24, 18, 32, 12]
);

writeTemplate(
  "materials-template.xlsx",
  "Materials",
  [
    "plant_name",
    "mix_type",
    "product_name",
    "kgco2e_per_tonne",
    "valid_from",
    "valid_to",
    "source",
    "a1_includes_raw_materials",
  ],
  ["Moorcroft", "HOT", "TSCS", "55", "2026-01-03", "", "manual", "false"],
  [20, 12, 18, 18, 14, 14, 18, 24]
);

writeTemplate(
  "installation-setups-template.xlsx",
  "Installation",
  [
    "plant_name",
    "category",
    "spread_rate_t_per_m2",
    "kgco2_per_t",
    "kgco2_per_ltr",
    "kgco2e",
    "kgco2e_per_km",
    "kgco2e_unit",
    "litres_per_t",
    "is_default",
  ],
  ["Example Plant", "Plant", "0.03", "5.2", "0.45", "4.2", "0.9", "km", "12.5", "false"],
  [20, 14, 20, 14, 14, 10, 14, 12, 14, 12]
);

writeTemplate(
  "report-metrics-template.xlsx",
  "Reports",
  [
    "kind",
    "label",
    "unit",
    "value",
    "calc_op",
    "calc_factor",
    "source",
    "source_url",
    "sort_order",
    "is_active",
  ],
  [
    "equivalency",
    "Return Flight to Sydney",
    "flight",
    "1.5779",
    "x",
    "1",
    "ICAO",
    "https://www.icao.int",
    "10",
    "true",
  ],
  [14, 32, 14, 12, 10, 12, 16, 32, 12, 12]
);

console.log("Templates generated in public/templates");
