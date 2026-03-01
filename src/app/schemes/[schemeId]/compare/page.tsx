import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthGate } from "@/components/AuthGate";
import { ScenarioCompareGrid, type CompareItem } from "@/components/ScenarioCompareGrid";
import {
  ScenarioCompareCharts,
  ScenarioCompareStageChart,
  type CompareChartStage,
} from "@/components/ScenarioCompareCharts";
import { ScenarioCompareMap } from "@/components/ScenarioCompareMap";
import { ScenarioCompareRecycledSection } from "@/components/ScenarioCompareRecycledSection";
import { CompareReportRunner } from "@/components/CompareReportRunner";
import { CompareReportPreviewActions } from "@/components/CompareReportPreviewActions";
import { ScenarioCompareCO2Equivalency } from "@/components/ScenarioCompareCO2Equivalency";

type PageProps = {
  params: Promise<{ schemeId: string }>;
  searchParams?: Promise<{ items?: string; report?: string; sections?: string; autoprint?: string }>;
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

type PlantMixFactor = {
  plant_id: string;
  mix_type_id: string;
  product_id: string | null;
  kgco2e_per_tonne: number | null;
  recycled_materials_pct: number | null;
  is_default?: boolean | null;
};

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

type UserReportPreferences = {
  default_report_email: string | null;
  google_drive_folder: string | null;
};

export default async function ComparePage({ params, searchParams }: PageProps) {
  const { schemeId } = await params;
  const { items, report, sections, autoprint } = (await searchParams) ?? {};
  const selected = (items ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const reportMode = report === "1";
  const selectedSections = new Set(
    (sections ?? "cards,graph-a1a3,graph-a4,graph-a5,graph-a1a5,recycled,map,co2")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  const selectedGraphSections: CompareChartStage[] = [
    { key: "graph-a1a3", stage: "A1-A3" as const },
    { key: "graph-a4", stage: "A4" as const },
    { key: "graph-a5", stage: "A5" as const },
    { key: "graph-a1a5", stage: "A1-A5" as const },
  ]
    .filter((entry) => selectedSections.has(entry.key))
    .map((entry) => entry.stage);
  const hasOverviewPage = selectedGraphSections.length > 0 || selectedSections.has("recycled");
  const hasCardsPage = selectedSections.has("cards");
  const hasMapPage = selectedSections.has("map");
  const hasCo2Page = selectedSections.has("co2");
  const reportPageOrder: string[] = [];
  if (hasOverviewPage) reportPageOrder.push("overview");
  if (hasCardsPage) reportPageOrder.push("cards");
  if (hasMapPage) reportPageOrder.push("map");
  if (hasCo2Page) reportPageOrder.push("co2");
  const lastReportPage = reportPageOrder.at(-1) ?? null;
  const disclaimerText =
    "It is the sole responsibility of the certificate holder to ensure the validity and current status of all information herein";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: scheme } = await supabase
    .from("schemes")
    .select("id, name, distance_unit, plant_id")
    .eq("id", schemeId)
    .single();
  const { data: userReportPreferences } = user
    ? await supabase
        .from("user_report_preferences")
        .select("default_report_email, google_drive_folder")
        .eq("user_id", user.id)
        .maybeSingle<UserReportPreferences>()
    : { data: null as UserReportPreferences | null };

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

  const { data: mapLayouts } = await supabase
    .from("report_equivalency_layouts")
    .select("key, x, y, scale")
    .ilike("key", "compare-map-%");

  const shouldLoadCo2 = reportMode && selectedSections.has("co2");
  const { data: co2Layouts } = shouldLoadCo2
    ? await supabase
        .from("report_equivalency_layouts")
        .select("key, x, y, scale")
    : { data: [] as ReportLayout[] };

  const { data: co2Equivalencies } = shouldLoadCo2
    ? await supabase
        .from("report_metrics")
        .select("id, label, unit, value, source, calc_op, calc_factor")
        .eq("kind", "equivalency")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
    : { data: [] as ReportMetric[] };

  const scenarioById = new Map(
    (scenarioRows ?? []).map((row) => [row.id, row])
  );

  const toNumber = (value: unknown) => {
    if (value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const collectProducts = (snapshot?: Snapshot | null) =>
    (snapshot?.scheme_products ?? []).filter((row) => row.mix_type_id);

  const scenarioProducts = (scenarioRows ?? []).flatMap((row) =>
    collectProducts(row.snapshot as Snapshot | null)
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

  const livePayload = selected.includes("live")
    ? await (async () => {
        const { data: liveProducts } = await supabase
          .from("scheme_products")
          .select(
            "product_id, plant_id, mix_type_id, delivery_type, tonnage, distance_km, distance_unit"
          )
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

        return {
          products: liveProducts ?? [],
          install: liveInstall ?? [],
          results: liveResults ?? [],
          summary: liveSummary ?? null,
        };
      })()
    : null;

  const plantIds = new Set<string>();
  if (scheme?.plant_id) {
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
  const { data: plantMixFactors } = plantIdList.length
    ? await supabase
        .from("plant_mix_carbon_factors")
        .select("plant_id, mix_type_id, product_id, kgco2e_per_tonne, recycled_materials_pct, is_default")
        .in("plant_id", plantIdList)
        .is("valid_to", null)
    : { data: [] as PlantMixFactor[] };

  const factorByKey = new Map<string, PlantMixFactor>();
  const defaultFactorByPlant = new Map<string, PlantMixFactor>();
  (plantMixFactors ?? []).forEach((row) => {
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
    const defaultRow = defaultFactorByPlant.get(plantId);
    return toNumber(defaultRow?.kgco2e_per_tonne);
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
    const defaultRow = defaultFactorByPlant.get(plantId);
    return toNumber(defaultRow?.recycled_materials_pct);
  };

  const computeA1Factor = (products: Snapshot["scheme_products"] = []) => {
    const delivered = products.filter(
      (row) => (row.delivery_type ?? "delivery").toLowerCase() === "delivery"
    );

    const factorByProduct = new Map<string, number>();
    delivered.forEach((row, index) => {
      if (!row.mix_type_id) return;
      const plantId = row.plant_id ?? scheme?.plant_id ?? null;
      const factor = resolveMixFactor(plantId, row.mix_type_id, row.product_id ?? null);
      if (factor === null) return;
      const key = row.product_id ?? `row-${index}`;
      if (!factorByProduct.has(key)) {
        factorByProduct.set(key, factor);
      }
    });

    if (!factorByProduct.size) return null;
    const total = Array.from(factorByProduct.values()).reduce(
      (sum, value) => sum + value,
      0
    );
    return total / factorByProduct.size;
  };

  const computeRecycledPct = (products: Snapshot["scheme_products"] = []) => {
    let weightedTotal = 0;
    let totalTonnage = 0;

    products.forEach((row) => {
      if (!row.mix_type_id) return;
      const plantId = row.plant_id ?? scheme?.plant_id ?? null;
      const recycledPct = resolveRecycledPct(plantId, row.mix_type_id, row.product_id ?? null);
      const tonnage = toNumber(row.tonnage) ?? 0;
      if (recycledPct === null || tonnage <= 0) return;
      weightedTotal += recycledPct * tonnage;
      totalTonnage += tonnage;
    });

    if (totalTonnage <= 0) return null;
    return weightedTotal / totalTonnage;
  };

  if (livePayload) {
    const unit = (scheme?.distance_unit ?? "km").toLowerCase() === "mi" ? "mi" : "km";
    compareItems.push({
      id: "live",
      title: "Live scheme",
      subtitle: scheme?.name ?? "Current scheme",
      summary_total: livePayload.summary?.total_kgco2e ?? null,
      summary_per_tonne: livePayload.summary?.kgco2e_per_tonne ?? null,
      narrative: buildNarrative(
        "Live scheme",
        livePayload.products,
        livePayload.install,
        unit
      ),
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
      a1Factor: computeA1Factor(snapshot.scheme_products ?? []),
      recycledPct: computeRecycledPct(snapshot.scheme_products ?? []),
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
      <main className={`scheme-detail-page compare-page ${reportMode ? "compare-report-mode" : ""}`}>
        {!reportMode ? (
          <>
            <header className="scheme-detail-header">
              <div>
                <p className="scheme-kicker">Carbon Comparison</p>
                <h1>{scheme?.name ?? "Scheme comparison"}</h1>
              </div>
              <div className="compare-header-actions">
                <CompareReportRunner
                  schemeId={schemeId}
                  schemeName={scheme?.name ?? "Scheme comparison"}
                  selectedItems={selected}
                  defaultReportEmail={userReportPreferences?.default_report_email ?? ""}
                  defaultGoogleDriveFolder={userReportPreferences?.google_drive_folder ?? ""}
                />
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
            <ScenarioCompareRecycledSection items={compareItems} />
            <ScenarioCompareMap items={compareItems} layouts={mapLayouts ?? []} />
          </>
        ) : (
          <>
            <CompareReportPreviewActions
              schemeId={schemeId}
              schemeName={scheme?.name ?? "Scheme comparison"}
              selectedItems={selected}
              selectedSections={Array.from(selectedSections)}
              defaultReportEmail={userReportPreferences?.default_report_email ?? ""}
              defaultGoogleDriveFolder={userReportPreferences?.google_drive_folder ?? ""}
            />
            <div className="compare-report-pages">
              {hasOverviewPage ? (
                <section className="compare-report-page compare-report-page-overview">
                  <header className="compare-report-header">
                    <img src="/branding/holcim.png" alt="Holcim logo" className="compare-report-logo" />
                    <p className="scheme-kicker">Carbon Comparison</p>
                    <h1>{scheme?.name ?? "Scheme comparison"}</h1>
                  </header>
                  <div className="compare-report-overview-content">
                    {selectedGraphSections.length ? (
                      <section className="compare-charts">
                        {selectedGraphSections.map((stage) => (
                          <ScenarioCompareStageChart key={stage} items={compareItems} stage={stage} />
                        ))}
                      </section>
                    ) : null}
                    {selectedSections.has("recycled") ? <ScenarioCompareRecycledSection items={compareItems} /> : null}
                  </div>
                  {lastReportPage === "overview" ? (
                    <p className="compare-report-disclaimer">{disclaimerText}</p>
                  ) : null}
                </section>
              ) : null}

              {hasCardsPage ? (
                <section className="compare-report-page">
                  <header className="compare-report-header">
                    <img src="/branding/holcim.png" alt="Holcim logo" className="compare-report-logo" />
                    <p className="scheme-kicker">Carbon Comparison</p>
                    <h2>Comparison cards</h2>
                  </header>
                  <ScenarioCompareGrid items={compareItems} />
                  {lastReportPage === "cards" ? (
                    <p className="compare-report-disclaimer">{disclaimerText}</p>
                  ) : null}
                </section>
              ) : null}

              {hasMapPage ? (
                <section className="compare-report-page compare-report-page-map">
                  <header className="compare-report-header">
                    <img src="/branding/holcim.png" alt="Holcim logo" className="compare-report-logo" />
                  </header>
                  <ScenarioCompareMap items={compareItems} layouts={mapLayouts ?? []} reportOnly />
                  {lastReportPage === "map" ? (
                    <p className="compare-report-disclaimer">{disclaimerText}</p>
                  ) : null}
                </section>
              ) : null}

              {hasCo2Page ? (
                <section className="compare-report-page compare-report-page-co2">
                  <header className="compare-report-header">
                    <img src="/branding/holcim.png" alt="Holcim logo" className="compare-report-logo" />
                  </header>
                  <ScenarioCompareCO2Equivalency
                    tonnes={deltaPerTonne ?? 0}
                    equivalencies={(co2Equivalencies ?? []) as ReportMetric[]}
                    layouts={(co2Layouts ?? []) as ReportLayout[]}
                  />
                  {lastReportPage === "co2" ? (
                    <p className="compare-report-disclaimer">{disclaimerText}</p>
                  ) : null}
                </section>
              ) : null}
            </div>
          </>
        )}

        {reportMode && autoprint === "1" ? (
          <script
            dangerouslySetInnerHTML={{
              __html: "window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});",
            }}
          />
        ) : null}
      </main>
    </AuthGate>
  );
}
