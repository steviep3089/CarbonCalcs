import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type ExportType =
  | "plants"
  | "materials"
  | "installation-setups"
  | "report-metrics";

const FILE_NAMES: Record<ExportType, string> = {
  plants: "plants-data.csv",
  materials: "materials-data.csv",
  "installation-setups": "installation-setups-data.csv",
  "report-metrics": "report-metrics-data.csv",
};

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>) {
  const headerLine = headers.join(",");
  const rowLines = rows.map((row) =>
    headers.map((header) => escapeCsvValue(row[header])).join(",")
  );
  return [headerLine, ...rowLines].join("\n");
}

function boolText(value: boolean | null | undefined) {
  return value ? "true" : "false";
}

function relationName(value: unknown) {
  if (Array.isArray(value)) {
    const first = value[0] as { name?: string | null } | undefined;
    return first?.name ?? "";
  }
  const single = value as { name?: string | null } | null | undefined;
  return single?.name ?? "";
}

async function exportPlants(supabase: SupabaseClient) {
  const headers = ["name", "location", "description", "is_default"];
  const { data, error } = await supabase
    .from("plants")
    .select("name, location, description, is_default")
    .order("name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const rows = (data ?? []).map((row) => ({
    name: row.name ?? "",
    location: row.location ?? "",
    description: row.description ?? "",
    is_default: boolText(row.is_default ?? false),
  }));

  return { csv: toCsv(headers, rows) };
}

async function exportMaterials(supabase: SupabaseClient) {
  const headers = [
    "plant_id",
    "plant_name",
    "mix_type_id",
    "mix_type",
    "product_id",
    "product_name",
    "kgco2e_per_tonne",
    "valid_from",
    "valid_to",
    "source",
    "a1_includes_raw_materials",
  ];

  const { data, error } = await supabase
    .from("plant_mix_carbon_factors")
    .select(
      `
      plant_id,
      mix_type_id,
      product_id,
      kgco2e_per_tonne,
      valid_from,
      valid_to,
      source,
      a1_includes_raw_materials,
      plants(name),
      mix_types(name),
      products(name)
    `
    )
    .order("valid_from", { ascending: false });

  if (error) {
    return { error: error.message };
  }

  const rows = (data ?? []).map((row) => {
    const plantName = relationName(row.plants);
    const mixTypeName = relationName(row.mix_types);
    const productName = relationName(row.products);

    return {
      plant_id: row.plant_id ?? "",
      plant_name: plantName,
      mix_type_id: row.mix_type_id ?? "",
      mix_type: mixTypeName,
      product_id: row.product_id ?? "",
      product_name: productName,
      kgco2e_per_tonne: row.kgco2e_per_tonne ?? "",
      valid_from: row.valid_from ?? "",
      valid_to: row.valid_to ?? "",
      source: row.source ?? "",
      a1_includes_raw_materials: boolText(row.a1_includes_raw_materials ?? false),
    };
  });

  return { csv: toCsv(headers, rows) };
}

async function exportInstallationSetups(
  supabase: SupabaseClient
) {
  const headers = [
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
  ];

  const { data, error } = await supabase
    .from("installation_setups")
    .select(
      "plant_name, category, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e, kgco2e_per_km, kgco2e_unit, litres_per_t, is_default"
    )
    .order("plant_name", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const rows = (data ?? []).map((row) => ({
    plant_name: row.plant_name ?? "",
    category: row.category ?? "",
    spread_rate_t_per_m2: row.spread_rate_t_per_m2 ?? "",
    kgco2_per_t: row.kgco2_per_t ?? "",
    kgco2_per_ltr: row.kgco2_per_ltr ?? "",
    kgco2e: row.kgco2e ?? "",
    kgco2e_per_km: row.kgco2e_per_km ?? "",
    kgco2e_unit: row.kgco2e_unit ?? "km",
    litres_per_t: row.litres_per_t ?? "",
    is_default: boolText(row.is_default ?? false),
  }));

  return { csv: toCsv(headers, rows) };
}

async function exportReportMetrics(supabase: SupabaseClient) {
  const headers = [
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
  ];

  const { data, error } = await supabase
    .from("report_metrics")
    .select(
      "kind, label, unit, value, calc_op, calc_factor, source, source_url, sort_order, is_active"
    )
    .order("sort_order", { ascending: true });

  if (error) {
    return { error: error.message };
  }

  const rows = (data ?? []).map((row) => ({
    kind: row.kind ?? "",
    label: row.label ?? "",
    unit: row.unit ?? "",
    value: row.value ?? "",
    calc_op: row.calc_op ?? "",
    calc_factor: row.calc_factor ?? "",
    source: row.source ?? "",
    source_url: row.source_url ?? "",
    sort_order: row.sort_order ?? "",
    is_active: boolText(row.is_active ?? true),
  }));

  return { csv: toCsv(headers, rows) };
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as ExportType | null;

  if (!type || !(type in FILE_NAMES)) {
    return NextResponse.json(
      { error: "Invalid type. Use plants, materials, installation-setups, or report-metrics." },
      { status: 400 }
    );
  }

  let result: { csv?: string; error?: string };

  if (type === "plants") {
    result = await exportPlants(supabase);
  } else if (type === "materials") {
    result = await exportMaterials(supabase);
  } else if (type === "installation-setups") {
    result = await exportInstallationSetups(supabase);
  } else {
    result = await exportReportMetrics(supabase);
  }

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return new NextResponse(result.csv ?? "", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${FILE_NAMES[type]}"`,
      "Cache-Control": "no-store",
    },
  });
}
