import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthGate } from "@/components/AuthGate";
import { ScenarioCompareGrid, type CompareItem } from "@/components/ScenarioCompareGrid";
import { ScenarioCompareCharts } from "@/components/ScenarioCompareCharts";

type PageProps = {
  params: Promise<{ schemeId: string }>;
  searchParams?: Promise<{ items?: string }>;
};

type Snapshot = {
  scheme_products?: Array<{
    product_id: string | null;
    mix_type_id: string | null;
    delivery_type: string | null;
    tonnage: number | null;
    distance_km: number | null;
    distance_unit: string | null;
  }>;
  scheme_installation_items?: Array<{
    category: string | null;
  }>;
  scheme_a5_usage_entries?: Array<{
    id?: string;
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

const toDistance = (km: number, unit: string) =>
  unit === "mi" ? km / 1.60934 : km;

export default async function ComparePage({ params, searchParams }: PageProps) {
  const { schemeId } = await params;
  const { items } = (await searchParams) ?? {};
  const selected = (items ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const supabase = await createSupabaseServerClient();
  const { data: scheme } = await supabase
    .from("schemes")
    .select("id, name, distance_unit")
    .eq("id", schemeId)
    .single();

  const { data: mixTypes } = await supabase
    .from("mix_types")
    .select("id, name");

  const { data: products } = await supabase
    .from("products")
    .select("id, name");

  const mixNameById = new Map((mixTypes ?? []).map((mix) => [mix.id, mix.name]));
  const productNameById = new Map(
    (products ?? []).map((product) => [product.id, product.name])
  );

  const scenarioIds = selected.filter((item) => item !== "live");
  const { data: scenarioRows } = await supabase
    .from("scheme_scenarios")
    .select("id, label, snapshot")
    .eq("scheme_id", schemeId)
    .in("id", scenarioIds);

  const scenarioById = new Map(
    (scenarioRows ?? []).map((row) => [row.id, row])
  );

  const buildNarrative = (
    title: string,
    products: Snapshot["scheme_products"] = [],
    installationItems: Snapshot["scheme_installation_items"] = [],
    distanceUnit: string
  ) => {
    const delivery = products.filter(
      (row) => (row.delivery_type ?? "delivery").toLowerCase() === "delivery"
    );
    const returned = products.filter(
      (row) => (row.delivery_type ?? "").toLowerCase() === "return"
    );
    const tipped = products.filter(
      (row) => (row.delivery_type ?? "").toLowerCase() === "tip"
    );
    const totalDelivered = delivery.reduce(
      (sum, row) => sum + (row.tonnage ?? 0),
      0
    );
    const totalReturned = returned.reduce(
      (sum, row) => sum + (row.tonnage ?? 0),
      0
    );
    const totalTipped = tipped.reduce(
      (sum, row) => sum + (row.tonnage ?? 0),
      0
    );

    const allMixes = new Set<string>();
    products.forEach((row) => {
      if (row.mix_type_id && mixNameById.has(row.mix_type_id)) {
        allMixes.add(mixNameById.get(row.mix_type_id)!);
      }
    });

    const deliveryDistances = delivery
      .map((row) =>
        row.distance_km ? toDistance(row.distance_km, distanceUnit) : null
      )
      .filter((value): value is number => value !== null);

    const avgDistance =
      deliveryDistances.length > 0
        ? deliveryDistances.reduce((sum, value) => sum + value, 0) /
          deliveryDistances.length
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
    )} t, ${totalReturned.toFixed(1)} t returned, and ${totalTipped.toFixed(
      1
    )} t sent to tip. ${mixText} ${distanceText} ${installText}`;
  };

  const buildBullets = (
    products: Snapshot["scheme_products"] = [],
    installationItems: Snapshot["scheme_installation_items"] = [],
    distanceUnit: string
  ) => {
    const delivery = products.filter(
      (row) => (row.delivery_type ?? "delivery").toLowerCase() === "delivery"
    );
    const returned = products.filter(
      (row) => (row.delivery_type ?? "").toLowerCase() === "return"
    );
    const tipped = products.filter(
      (row) => (row.delivery_type ?? "").toLowerCase() === "tip"
    );
    const totalDelivered = delivery.reduce(
      (sum, row) => sum + (row.tonnage ?? 0),
      0
    );
    const totalReturned = returned.reduce(
      (sum, row) => sum + (row.tonnage ?? 0),
      0
    );
    const totalTipped = tipped.reduce(
      (sum, row) => sum + (row.tonnage ?? 0),
      0
    );

    const deliveryDistances = delivery
      .map((row) =>
        row.distance_km ? toDistance(row.distance_km, distanceUnit) : null
      )
      .filter((value): value is number => value !== null);

    const avgDistance =
      deliveryDistances.length > 0
        ? deliveryDistances.reduce((sum, value) => sum + value, 0) /
          deliveryDistances.length
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

  const buildLifecycle = (
    results: Snapshot["scheme_carbon_results"] = []
  ) => {
    const groups = new Map<
      string,
      {
        stage: string;
        description: string;
        total_kgco2e: number | null;
        kgco2e_per_tonne: number | null;
        details: {
          label: string;
          mix: string;
          total_kgco2e: number | null;
          kgco2e_per_tonne: number | null;
        }[];
      }
    >();

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
          mix: row.mix_type_id
            ? mixNameById.get(row.mix_type_id) ?? row.mix_type_id
            : "-",
          total_kgco2e: row.total_kgco2e,
          kgco2e_per_tonne: row.kgco2e_per_tonne,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) =>
      a.stage.localeCompare(b.stage)
    );
  };

  const compareItems: CompareItem[] = [];

  if (selected.includes("live")) {
    const { data: liveProducts } = await supabase
      .from("scheme_products")
      .select("product_id, mix_type_id, delivery_type, tonnage, distance_km, distance_unit")
      .eq("scheme_id", schemeId);

    const { data: liveInstall } = await supabase
      .from("scheme_installation_items")
      .select("category")
      .eq("scheme_id", schemeId);

    const { data: liveResults } = await supabase
      .from("scheme_carbon_results")
      .select(
        "lifecycle_stage, total_kgco2e, kgco2e_per_tonne, detail_label, product_id, mix_type_id"
      )
      .eq("scheme_id", schemeId)
      .order("lifecycle_stage");

    const { data: liveSummary } = await supabase
      .from("scheme_carbon_summaries")
      .select("total_kgco2e, kgco2e_per_tonne")
      .eq("scheme_id", schemeId)
      .maybeSingle();

    const unit = (scheme?.distance_unit ?? "km").toLowerCase() === "mi" ? "mi" : "km";

    compareItems.push({
      id: "live",
      title: "Live scheme",
      subtitle: scheme?.name ?? "Current scheme",
      summary_total: liveSummary?.total_kgco2e ?? null,
      summary_per_tonne: liveSummary?.kgco2e_per_tonne ?? null,
      narrative: buildNarrative(
        "Live scheme",
        liveProducts ?? [],
        liveInstall ?? [],
        unit
      ),
      bullets: buildBullets(liveProducts ?? [], liveInstall ?? [], unit),
      lifecycle: buildLifecycle(liveResults ?? []),
    });
  }

  scenarioIds.forEach((scenarioId, index) => {
    const scenario = scenarioById.get(scenarioId);
    if (!scenario) return;
    const snapshot = (scenario.snapshot ?? {}) as Snapshot;
    const unit = (scheme?.distance_unit ?? "km").toLowerCase() === "mi" ? "mi" : "km";
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
    });
  });

  const perTonneValues = compareItems
    .map((item) => item.summary_per_tonne)
    .filter((value): value is number => value !== null && value !== undefined)
    .filter((value) => Number.isFinite(value));

  const maxPerTonne = perTonneValues.length
    ? Math.max(...perTonneValues)
    : null;
  const minPerTonne = perTonneValues.length
    ? Math.min(...perTonneValues)
    : null;
  const deltaPerTonne =
    maxPerTonne !== null && minPerTonne !== null
      ? maxPerTonne - minPerTonne
      : null;

  const savingsHref = deltaPerTonne !== null
    ? `/reports/co2-savings?t=${deltaPerTonne.toFixed(2)}`
    : "/reports/co2-savings";

  return (
    <AuthGate>
      <main className="scheme-detail-page compare-page">
        <header className="scheme-detail-header">
          <div>
            <p className="scheme-kicker">Scenario comparison</p>
            <h1>{scheme?.name ?? "Scheme comparison"}</h1>
          </div>
          <div className="compare-header-actions">
            <a className="btn-secondary" href={savingsHref}>
              CO2 savings
            </a>
            <a className="btn-secondary" href={`/schemes/${schemeId}`}>
              Back to scheme
            </a>
          </div>
        </header>
        <ScenarioCompareGrid items={compareItems} />
        <ScenarioCompareCharts items={compareItems} />
      </main>
    </AuthGate>
  );
}
