export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import {
  recalculateSchemeCarbon,
  addSchemeProduct,
  deleteSchemeProduct,
  addSchemeInstallationItemsBulk,
  deleteSchemeInstallationItem,
  enableAutoInstallationItems,
  enableManualInstallationItems,
  enableAutoMaterials,
  enableManualMaterials,
  updateSchemeMaterialUsage,
  setSchemeDistanceUnitKm,
  setSchemeDistanceUnitMi,
  createSchemeScenario,
  applySchemeScenario,
  updateSchemeScenarioLabel,
  updateSchemeScenarioSnapshot,
  deleteSchemeScenario,
} from "./actions";
import { AuthGate } from "@/components/AuthGate";
import { SignOutButton } from "@/components/SignOutButton";
import { SchemeA5Usage } from "@/components/SchemeA5Usage";
import { SchemeModeToggle } from "@/components/SchemeModeToggle";
import { SchemeA5ModeControls } from "@/components/SchemeA5ModeControls";
import { MaterialAutoGenerate } from "@/components/MaterialAutoGenerate";
import { SchemeLockButton } from "@/components/SchemeLockButton";
import { SchemeMaterialForm } from "@/components/SchemeMaterialForm";
import { ScenarioCompareLauncher } from "@/components/ScenarioCompareLauncher";

interface PageProps {
  params: Promise<{
    schemeId: string;
  }>;
}

export default async function SchemeDetailPage({ params }: PageProps) {
  // =========================
  // Unwrap params
  // =========================
  const { schemeId } = await params;

  if (!schemeId) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Invalid scheme</h1>
        <p>No scheme ID was provided.</p>
      </main>
    );
  }

  // =========================
  // Fetch scheme header
  // =========================
  const supabase = await createSupabaseServerClient();
  const { data: scheme, error: schemeError } = await supabase
    .from("schemes")
    .select(
      `
      id,
      name,
      created_at,
      a5_fuel_mode,
      installation_mode,
      materials_mode,
      distance_unit,
      area_m2,
      site_postcode,
      base_postcode,
      is_locked,
      active_scenario_id,
      plants (
        name
      )
    `
    )
    .eq("id", schemeId)
    .single();

  // =========================
  // Fetch summary totals
  // =========================
  const { data: summary, error: summaryError } = await supabase
    .from("scheme_carbon_summaries")
    .select("total_kgco2e, kgco2e_per_tonne")
    .eq("scheme_id", schemeId)
    .maybeSingle();

  // =========================
  // Fetch lifecycle breakdown
  // =========================
  const { data: results, error: resultsError } = await supabase
    .from("scheme_carbon_results")
    .select(
      `
      id,
      lifecycle_stage,
      total_kgco2e,
      kgco2e_per_tonne,
      detail_label,
      product_id,
      mix_type_id,
      products (
        name
      ),
      mix_types (
        name
      ),
      lifecycle_stages (
        description
      )
    `
    )
    .eq("scheme_id", schemeId)
    .order("lifecycle_stage");

  // =========================
  // Fetch scheme product inputs
  // =========================
  const { data: schemeProducts, error: productsError } = await supabase
    .from("scheme_products")
    .select(
      `
      id,
      delivery_type,
      tonnage,
      mix_type_id,
      distance_km,
      distance_unit,
      products (
        name
      ),
      plants (
        name,
        location
      ),
      transport_modes (
        id,
        name
      ),
      mix_types (
        id,
        name
      )
    `
    )
    .eq("scheme_id", schemeId)
    .order("created_at");

  // =========================
  // Fetch scenario snapshots
  // =========================
  const { data: scenarios, error: scenariosError } = await supabase
    .from("scheme_scenarios")
    .select("id, label, label_locked, created_at, updated_at")
    .eq("scheme_id", schemeId)
    .order("created_at");

  // =========================
  // Fetch installation setup reference data
  // =========================
  const { data: installationSetups, error: installationSetupsError } = await supabase
    .from("installation_setups")
    .select(
      "id, plant_name, category, is_default, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e, kgco2e_per_km, litres_per_t, litres_na, one_way"
    )
    .order("plant_name");

  // =========================
  // Fetch scheme installation configuration
  // =========================
  const { data: schemeInstallationItems, error: installationItemsError } = await supabase
    .from("scheme_installation_items")
    .select(
      `
      id,
      installation_setup_id,
      plant_name,
      category,
      quantity,
      litres_per_t,
      litres_na,
      kgco2e,
      kgco2e_na
      ,spread_rate_t_per_m2,
      material_tonnage_override,
      kgco2_per_t,
      kgco2_per_ltr,
      kgco2e_per_km,
      one_way,
      fuel_type_id,
      fuel_kgco2_per_ltr
    `
    )
    .eq("scheme_id", schemeId)
    .order("created_at");
  const deliveredTonnage = (schemeProducts ?? []).reduce((sum, row) => {
    const deliveryType = (row.delivery_type ?? "delivery").toLowerCase();
    if (deliveryType === "delivery") {
      return sum + (row.tonnage ?? 0);
    }
    return sum;
  }, 0);
  const hasTipDelivery = (schemeProducts ?? []).some(
    (row) => (row.delivery_type ?? "").toLowerCase() === "tip"
  );
  const totalTonnage = (schemeProducts ?? []).reduce(
    (sum, row) => sum + (row.tonnage ?? 0),
    0
  );

  const installationMode = (scheme?.installation_mode ?? "auto").toLowerCase();
  const materialsMode = (scheme?.materials_mode ?? "auto").toLowerCase();
  const isInstallationAuto = installationMode !== "manual";
  const isMaterialsAuto = materialsMode !== "manual";
  const hasSitePostcode = Boolean((scheme?.site_postcode ?? "").trim());
  const hasBasePostcode = Boolean((scheme?.base_postcode ?? "").trim());
  const isLocked = Boolean(scheme?.is_locked);
  const hasA5Postcodes = hasSitePostcode && hasBasePostcode;
  const distanceUnit =
    (scheme?.distance_unit ?? "km").toLowerCase() === "mi" ? "mi" : "km";
  const distanceLabel = distanceUnit === "mi" ? "mi" : "km";
  const distanceDivisor = distanceUnit === "mi" ? 1.60934 : 1;
  const scenarioList = scenarios ?? [];
  const activeScenarioId = scheme?.active_scenario_id ?? null;
  const activeScenario =
    scenarioList.find((scenario) => scenario.id === activeScenarioId) ?? null;
  const scenarioLabel = (label: string | null | undefined, index: number) =>
    label && label.trim() ? label : `Scenario ${index + 1}`;

  // =========================
  // Fetch A5 usage entries
  // =========================
  const { data: schemeA5Usage, error: a5UsageError } = await supabase
    .from("scheme_a5_usage_entries")
    .select(
      `
      id,
      period_start,
      period_end,
      litres_used,
      distance_km_each_way,
      one_way,
      scheme_installation_items (
        id,
        plant_name,
        category,
        quantity,
        one_way,
        fuel_type_id
      )
    `
    )
    .eq("scheme_id", schemeId)
    .order("created_at", { ascending: false });

  const formatNumber = (value: number | null, digits = 2) => {
    if (value === null || Number.isNaN(value)) return "-";
    return new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  };

  const lifecycleResults = results ?? [];
  type LifecycleRow = (typeof lifecycleResults)[number];

  const stageGroups = lifecycleResults.reduce((acc, row) => {
    const stage = row.lifecycle_stage;
    if (!acc.has(stage)) {
      const lifecycleStage = Array.isArray(row.lifecycle_stages)
        ? row.lifecycle_stages[0]
        : row.lifecycle_stages;
      acc.set(stage, {
        stage,
        description: lifecycleStage?.description ?? null,
        summary: null as LifecycleRow | null,
        details: [] as LifecycleRow[],
      });
    }
    const group = acc.get(stage);
    if (!group) return acc;
    if (!row.product_id && !row.mix_type_id && !row.detail_label) {
      group.summary = row;
    } else {
      group.details.push(row);
    }
    return acc;
  }, new Map<string, { stage: string; description: string | null; summary: LifecycleRow | null; details: LifecycleRow[] }>());

  const lifecycleRows = Array.from(stageGroups.values()).sort((a, b) =>
    a.stage.localeCompare(b.stage)
  );

  const fuelOptions = (installationSetups ?? []).filter(
    (row) => (row.category ?? "").toLowerCase() === "fuel"
  );
  const installationOptions = (installationSetups ?? []).filter((row) => {
    const category = (row.category ?? "").toLowerCase();
    return category === "plant" || category === "transport";
  });
  const materialOptions = (installationSetups ?? []).filter(
    (row) => (row.category ?? "").toLowerCase() === "material"
  );
  const materialItems = (schemeInstallationItems ?? []).filter(
    (row) => (row.category ?? "").toLowerCase() === "material"
  );
  const fuelNameById = new Map(
    fuelOptions.map((row) => [row.id, row.plant_name])
  );
  const fuelNameEntries = fuelOptions.map((row) => [row.id, row.plant_name] as [string, string]);
  const a5UsageItems = (schemeInstallationItems ?? []).filter((row) => {
    const category = (row.category ?? "").trim().toLowerCase();
    return category === "plant" || category === "transport";
  });
  const installationSummary = (schemeInstallationItems ?? []).reduce(
    (acc, row) => {
      const category = (row.category ?? "").trim().toLowerCase();
      const quantity = row.quantity ?? 0;
      if (category === "plant") {
        acc.plantTotal += quantity;
      }
      if (category === "transport") {
        acc.transportTotal += quantity;
      }
      if (row.fuel_type_id) {
        const current = acc.fuels.get(row.fuel_type_id) ?? { count: 0, total: 0 };
        acc.fuels.set(row.fuel_type_id, {
          count: current.count + 1,
          total: current.total + quantity,
        });
      }
      return acc;
    },
    {
      plantTotal: 0,
      transportTotal: 0,
      fuels: new Map<string, { count: number; total: number }>(),
    }
  );
  const fuelSummary = Array.from(installationSummary.fuels.entries()).map(
    ([fuelId, data]) => `${fuelNameById.get(fuelId) ?? "Fuel"} (${data.count})`
  );
  const normalizeA5Category = (value: string | null | undefined) => {
    const raw = (value ?? "").trim();
    if (!raw) return "Other";
    const normalized = raw.toLowerCase();
    if (normalized.includes("plant")) return "Plant";
    if (normalized.includes("transport")) return "Transport";
    if (normalized.includes("material")) return "Material";
    if (normalized.includes("fuel")) return "Fuel";
    return raw;
  };
  const a5CategoryByLabel = new Map(
    (schemeInstallationItems ?? [])
      .filter((row) => row.plant_name)
      .map((row) => [
        row.plant_name as string,
        normalizeA5Category(row.category ?? "Uncategorized"),
      ])
  );
  ["Plant", "Transport", "Material", "Fuel", "Materials", "Plant fuel usage"].forEach(
    (label) => {
      a5CategoryByLabel.set(label, normalizeA5Category(label));
    }
  );

  // =========================
  // Fetch dropdown reference data
  // =========================
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .order("name");

  const { data: plants } = await supabase
    .from("plants")
    .select("id, name, location, is_default")
    .order("name");

  const { data: transportModes } = await supabase
    .from("transport_modes")
    .select("id, name, is_default")
    .order("name");

  const { data: mixTypes } = await supabase
    .from("mix_types")
    .select("id, name")
    .order("name");

  const { data: plantMixOptions } = await supabase
    .from("plant_mix_carbon_factors")
    .select("plant_id, product_id, mix_type_id");

  const { data: defaultMixFactors } = await supabase
    .from("plant_mix_carbon_factors")
    .select("plant_id, product_id, mix_type_id")
    .eq("is_default", true);

  const defaultPlant = (plants ?? []).find((plant) => plant.is_default) ?? null;
  const defaultTransportMode =
    (transportModes ?? []).find((mode) => mode.is_default) ?? null;
  const defaultMixFactor = defaultPlant
    ? (defaultMixFactors ?? []).find(
        (row) => row.plant_id === defaultPlant.id
      )
    : null;

  // =========================
  // Error handling
  // =========================
  if (
    schemeError ||
    summaryError ||
    resultsError ||
    productsError ||
    scenariosError ||
    installationSetupsError ||
    installationItemsError ||
    a5UsageError
  ) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Error loading scheme</h1>
        <pre style={{ color: "red" }}>
          {JSON.stringify(
            {
              schemeError,
              summaryError,
              resultsError,
              productsError,
              scenariosError,
              installationSetupsError,
              installationItemsError,
              a5UsageError,
            },
            null,
            2
          )}
        </pre>
      </main>
    );
  }

  // =========================
  // Render
  // =========================
  return (
    <AuthGate>
    <main className="scheme-detail-page">
      <header className="scheme-detail-header">
        <div>
          <p className="scheme-kicker">Scheme detail</p>
          <h1>{scheme?.name}</h1>
          <div className="scheme-meta">
            <span>Created {new Date(scheme?.created_at).toLocaleString()}</span>
            {(() => {
              const plant = Array.isArray(scheme?.plants)
                ? scheme?.plants?.[0]
                : scheme?.plants;
              return plant?.name ? <span>• Plant {plant.name}</span> : null;
            })()}
            <SchemeLockButton schemeId={schemeId} locked={isLocked} />
          </div>
          {isLocked ? (
            <p className="scheme-lock-note">
              This scheme is locked. Editing has been disabled.
            </p>
          ) : null}
        </div>
      </header>

      <div className="scheme-top-row">
        <div className="scheme-scenario-stack">
          <div className="scheme-scenario-tabs">
            {scenarioList.length ? (
              scenarioList.map((scenario, index) => {
                const label = scenarioLabel(scenario.label, index);
                const isActive = scenario.id === activeScenarioId;
                return (
                  <div key={scenario.id} className="scheme-scenario-tab-wrap">
                    <form action={applySchemeScenario.bind(null, schemeId)}>
                      <input type="hidden" name="scenario_id" value={scenario.id} />
                      <button
                        type="submit"
                        className={`scheme-scenario-tab ${isActive ? "is-active" : ""}`}
                        title="Switch to this scenario"
                      >
                        {label}
                      </button>
                    </form>
                    <form action={deleteSchemeScenario.bind(null, schemeId)}>
                      <input type="hidden" name="scenario_id" value={scenario.id} />
                      <button
                        type="submit"
                        className="scheme-scenario-delete"
                        title="Delete scenario"
                      >
                        X
                      </button>
                    </form>
                  </div>
                );
              })
            ) : (
              <span className="scheme-muted">No scenarios saved yet.</span>
            )}
          </div>
          <form className="scheme-scenario-actions">
            <input
              type="hidden"
              name="scenario_id"
              value={activeScenario?.id ?? ""}
            />
            <button
              className="btn-secondary"
              type="submit"
              formAction={createSchemeScenario.bind(null, schemeId)}
            >
              Create scenario
            </button>
            <button
              className="btn-secondary"
              type="submit"
              disabled={!activeScenario}
              formAction={updateSchemeScenarioSnapshot.bind(null, schemeId)}
            >
              Update scenario
            </button>
            <ScenarioCompareLauncher schemeId={schemeId} scenarios={scenarioList} />
          </form>
          {scenarioList.length ? (
            <p className="scheme-muted">
              Select a scenario to update its snapshot or run a comparison.
            </p>
          ) : (
            <p className="scheme-muted">
              Use “Create scenario” to save a snapshot of this scheme.
            </p>
          )}
          {activeScenario && !activeScenario.label_locked ? (
            <form
              action={updateSchemeScenarioLabel.bind(null, schemeId)}
              className="scheme-scenario-form"
            >
              <input type="hidden" name="scenario_id" value={activeScenario.id} />
              <input
                name="label"
                placeholder="Scenario label"
                defaultValue={activeScenario.label ?? ""}
              />
              <button className="btn-secondary" type="submit">
                Save label
              </button>
            </form>
          ) : null}
        </div>
        <div className="scheme-actions">
          <div className="scheme-distance-toggle">
            <span className="scheme-muted">Distance unit</span>
            <SchemeModeToggle
              mode={distanceUnit === "mi" ? "manual" : "auto"}
              autoLabel="km"
              manualLabel="mi"
              onAuto={setSchemeDistanceUnitKm.bind(null, schemeId)}
              onManual={setSchemeDistanceUnitMi.bind(null, schemeId)}
              showMessages={false}
            />
          </div>
          <a className="btn-secondary" href="/admin">
            Admin
          </a>
          <a className="btn-secondary" href="/schemes">
            Back to schemes
          </a>
          <SignOutButton className="btn-secondary" />
        </div>
      </div>

      <section className={`scheme-card scheme-editable ${isLocked ? "is-locked" : ""}`}>
        <div className="scheme-card-header">
          <h2>Material configuration</h2>
          <p className="scheme-card-subtitle">
            Review all materials currently included in this scheme.
          </p>
        </div>

        <table className="scheme-table">
          <thead>
            <tr>
              <th align="left">Product</th>
              <th align="left">Mix</th>
              <th align="left">Plant</th>
              <th align="right">Tonnes</th>
              <th align="right">Distance</th>
              <th align="left">Transport</th>
              <th align="left">Delivery type</th>
              <th align="right">Action</th>
            </tr>
          </thead>
          <tbody>
            {schemeProducts?.length ? (
              schemeProducts.map((row) => (
                <tr key={row.id}>
                  <td>{row.products?.name}</td>
                  <td>{row.mix_types?.name ?? row.mix_type_id}</td>
                  <td>{row.plants?.name}</td>
                  <td align="right">{row.tonnage}</td>
                  <td align="right">
                    {(() => {
                      const unit =
                        (row.distance_unit ?? distanceUnit).toLowerCase() === "mi"
                          ? "mi"
                          : "km";
                      const divisor = unit === "mi" ? 1.60934 : 1;
                      const value =
                        row.distance_km !== null && row.distance_km !== undefined
                          ? row.distance_km / divisor
                          : null;
                      return value !== null ? `${formatNumber(value, 1)} ${unit}` : "-";
                    })()}
                  </td>
                  <td>{row.transport_modes?.name ?? "-"}</td>
                  <td>
                    {row.delivery_type === "return"
                      ? "Return"
                      : row.delivery_type === "tip"
                        ? "Tip (landfill)"
                        : "Delivery"}
                  </td>
                  <td align="right">
                    <form action={deleteSchemeProduct.bind(null, schemeId)}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="delete-button" type="submit" title="Delete material">
                        X
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="scheme-empty">
                  No materials added yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className={`scheme-grid scheme-editable ${isLocked ? "is-locked" : ""}`}>
        <div className="scheme-column">
          <details className="scheme-card scheme-collapsible">
            <summary className="scheme-collapse-summary">
              <div className="scheme-card-header">
                <h2>Add material line</h2>
                <p className="scheme-card-subtitle">
                  Capture a new material configuration for this scheme.
                </p>
              </div>
              <span className="scheme-collapse-indicator" aria-hidden="true">
                v
              </span>
            </summary>
            <div className="scheme-collapse-body">
              <SchemeMaterialForm
                schemeId={schemeId}
                action={addSchemeProduct.bind(null, schemeId)}
                products={products ?? []}
                plants={plants ?? []}
                mixTypes={mixTypes ?? []}
                transportModes={transportModes ?? []}
                plantMixOptions={plantMixOptions ?? []}
                defaultPlantId={defaultPlant?.id ?? null}
                defaultProductId={defaultMixFactor?.product_id ?? null}
                defaultMixTypeId={defaultMixFactor?.mix_type_id ?? null}
                defaultTransportModeId={defaultTransportMode?.id ?? null}
                hasSitePostcode={hasSitePostcode}
                distanceLabel={distanceLabel}
              />
            </div>
          </details>

          <details className="scheme-card scheme-collapsible">
            <summary className="scheme-collapse-summary">
              <div className="scheme-card-header">
                <h2>Installation items</h2>
                <p className="scheme-card-subtitle">
                  Review plant items already added for installation activities.
                </p>
                <div className="scheme-summary-line">
                  <span>Plant total: {formatNumber(installationSummary.plantTotal, 2)}</span>
                  <span>Transport total: {formatNumber(installationSummary.transportTotal, 2)}</span>
                  <span>
                    Fuels: {fuelSummary.length ? fuelSummary.join(", ") : "None"}
                  </span>
                </div>
              </div>
              <div className="scheme-summary-actions">
                <SchemeModeToggle
                  mode={installationMode}
                  onAuto={enableAutoInstallationItems.bind(null, schemeId)}
                  onManual={enableManualInstallationItems.bind(null, schemeId)}
                  showMessages={false}
                />
                <span className="scheme-collapse-indicator" aria-hidden="true">
                  v
                </span>
              </div>
            </summary>
            <div className="scheme-collapse-body">
              <div className="scheme-table-scroll">
                <table className="scheme-table">
                  <thead>
                    <tr>
                      <th align="left">Item</th>
                      <th align="right">Qty</th>
                      <th align="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemeInstallationItems?.length ? (
                      schemeInstallationItems.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div>{row.plant_name}</div>
                            <div className="scheme-muted">
                              {row.category ?? "Uncategorized"}
                              {row.fuel_type_id ? ` • Fuel: ${fuelNameById.get(row.fuel_type_id) ?? "Fuel"}` : ""}
                            </div>
                          </td>
                          <td align="right">{row.quantity}</td>
                          <td align="right">
                            <form action={deleteSchemeInstallationItem.bind(null, schemeId)}>
                              <input type="hidden" name="id" value={row.id} />
                              <button className="delete-button" type="submit" title="Delete item">
                                X
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="scheme-empty">
                          No installation items added yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </details>

          <details className="scheme-card scheme-collapsible">
            <summary className="scheme-collapse-summary">
              <div className="scheme-card-header">
                <h2>Bulk add plant & transport items</h2>
                <p className="scheme-card-subtitle">
                  Enter quantities and fuels, then add all at once.
                </p>
              </div>
              <span className="scheme-collapse-indicator" aria-hidden="true">
                v
              </span>
            </summary>
            <div className="scheme-collapse-body">
              {isInstallationAuto ? (
                <div className="scheme-empty">
                  Items automatically assigned by default.
                </div>
              ) : (
                <form
                  action={addSchemeInstallationItemsBulk.bind(null, schemeId)}
                  className="installation-bulk-form"
                >
                  <div className="installation-bulk-header">
                    <h3>Bulk add items</h3>
                    <p>Enter quantities and fuels, then add all at once.</p>
                  </div>
                  <div className="installation-bulk-list">
                    {installationOptions.length ? (
                      installationOptions.map((setup) => {
                        const category = (setup.category ?? "").toLowerCase();
                        const requiresFuel =
                          category === "plant" || category === "transport";
                        return (
                          <div key={setup.id} className="installation-bulk-row">
                            <div className="installation-bulk-info">
                              <input type="hidden" name="setup_ids" value={setup.id} />
                              <div className="installation-bulk-text">
                                <span>{setup.plant_name}</span>
                                <span className="scheme-muted">
                                  {setup.category ?? "Item"}
                                </span>
                              </div>
                            </div>
                            {requiresFuel ? (
                              <select
                                name={`fuel_type_id_${setup.id}`}
                                className="installation-bulk-select"
                                defaultValue=""
                              >
                                <option value="">Select fuel</option>
                                {fuelOptions.map((fuel) => (
                                  <option key={fuel.id} value={fuel.id}>
                                    {fuel.plant_name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="installation-bulk-placeholder">—</span>
                            )}
                            <input
                              type="number"
                              name={`quantity_${setup.id}`}
                              step="0.01"
                              min="0"
                              placeholder="Qty"
                              aria-label={`Quantity for ${setup.plant_name}`}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <div className="scheme-empty">No installation setup items found.</div>
                    )}
                  </div>
                  <button className="btn-primary" type="submit">
                    Add selected items
                  </button>
                </form>
              )}
            </div>
          </details>

          <details className="scheme-card scheme-collapsible">
            <summary className="scheme-collapse-summary">
              <div className="scheme-card-header">
                <h2>Add site materials</h2>
                <p className="scheme-card-subtitle">
                  Select installation materials and quantities for this scheme.
                </p>
              </div>
              <div className="scheme-summary-actions">
                <SchemeModeToggle
                  mode={materialsMode}
                  onAuto={enableAutoMaterials.bind(null, schemeId)}
                  onManual={enableManualMaterials.bind(null, schemeId)}
                  showMessages={false}
                />
                <span className="scheme-collapse-indicator" aria-hidden="true">
                  v
                </span>
              </div>
            </summary>
            <div className="scheme-collapse-body">
              <div className="scheme-card-header">
                <h3>Material usage</h3>
                <p className="scheme-card-subtitle">
                  Enter manual tonnes to override the auto calculation.
                </p>
              </div>
              <MaterialAutoGenerate schemeId={schemeId} />
              <div className="scheme-table-scroll">
                <table className="scheme-table">
                  <thead>
                    <tr>
                      <th align="left">Material</th>
                      <th align="right">Qty</th>
                      <th align="right">Spread rate</th>
                      <th align="right">Auto tonnes</th>
                      <th align="right">Manual tonnes</th>
                      <th align="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materialItems.length ? (
                      materialItems.map((row) => {
                        const area = scheme?.area_m2 ?? 0;
                        const autoTonnes =
                          area *
                          (row.spread_rate_t_per_m2 ?? 0) *
                          (row.quantity ?? 1) /
                          1000;
                        return (
                          <tr key={row.id}>
                            <td>
                              <div>{row.plant_name}</div>
                              <div className="scheme-muted">Material</div>
                            </td>
                            <td align="right">{row.quantity ?? 1}</td>
                            <td align="right">
                              {formatNumber(row.spread_rate_t_per_m2 ?? null, 4)}
                            </td>
                            <td align="right">{formatNumber(autoTonnes, 2)}</td>
                            <td align="right">
                              <form
                                action={updateSchemeMaterialUsage.bind(null, schemeId)}
                                className="scheme-inline-form"
                              >
                                <input type="hidden" name="id" value={row.id} />
                                <input
                                  name="material_tonnage_override"
                                  type="number"
                                  step="0.01"
                                  defaultValue={row.material_tonnage_override ?? ""}
                                  placeholder="Override"
                                />
                                <button className="btn-secondary" type="submit">
                                  Update
                                </button>
                              </form>
                            </td>
                            <td align="right">
                              <form action={deleteSchemeInstallationItem.bind(null, schemeId)}>
                                <input type="hidden" name="id" value={row.id} />
                                <button className="delete-button" type="submit" title="Delete item">
                                  X
                                </button>
                              </form>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="scheme-empty">
                          No materials assigned to this scheme.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {isMaterialsAuto ? (
                <div className="scheme-empty">
                  Items automatically assigned by default.
                </div>
              ) : (
                <form
                  action={addSchemeInstallationItemsBulk.bind(null, schemeId)}
                  className="installation-bulk-form"
                >
                  <div className="installation-bulk-header">
                    <h3>Materials</h3>
                    <p>Enter quantities to add materials to the scheme.</p>
                  </div>
                  <div className="installation-bulk-list">
                    {materialOptions.length ? (
                      materialOptions.map((setup) => (
                        <div key={setup.id} className="installation-bulk-row">
                          <div className="installation-bulk-info">
                            <input type="hidden" name="setup_ids" value={setup.id} />
                            <div className="installation-bulk-text">
                              <span>{setup.plant_name}</span>
                              <span className="scheme-muted">
                                {setup.category ?? "Material"}
                              </span>
                            </div>
                          </div>
                          <span className="installation-bulk-placeholder">—</span>
                          <input
                            type="number"
                            name={`quantity_${setup.id}`}
                            step="0.01"
                            min="0"
                            placeholder="Qty (default 1)"
                            aria-label={`Quantity for ${setup.plant_name}`}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="scheme-empty">No material setup items found.</div>
                    )}
                  </div>
                  <button className="btn-primary" type="submit">
                    Add materials
                  </button>
                </form>
              )}
            </div>
          </details>

          <details className="scheme-card scheme-collapsible">
            <summary className="scheme-collapse-summary">
              <div className="scheme-card-header">
                <h2>Log A5 usage</h2>
                <p className="scheme-card-subtitle">
                  Record plant fuel usage and transport travel for this scheme.
                </p>
              </div>
              <div className="scheme-summary-actions">
                <SchemeA5ModeControls
                  schemeId={schemeId}
                  fuelMode={(scheme?.a5_fuel_mode ?? "auto").toLowerCase()}
                  distanceUnit={distanceUnit}
                  hasA5Postcodes={hasA5Postcodes}
                  hasUsageEntries={(schemeA5Usage ?? []).length > 0}
                />
                <span className="scheme-collapse-indicator" aria-hidden="true">
                  v
                </span>
              </div>
            </summary>
            <SchemeA5Usage
              schemeId={schemeId}
              entries={schemeA5Usage ?? []}
              items={a5UsageItems}
              fuelNameEntries={fuelNameEntries}
              fuelMode={(scheme?.a5_fuel_mode ?? "auto").toLowerCase()}
              distanceUnit={distanceUnit}
              hasA5Postcodes={hasA5Postcodes}
            />
          </details>
        </div>

        <div className="scheme-card">
          <div className="scheme-card-header">
            <h2>Lifecycle breakdown</h2>
            <p className="scheme-card-subtitle">
              Emissions per lifecycle module (A1-A5).
            </p>
          </div>

          {lifecycleRows.length ? (
            <div className="lifecycle-grid">
              <div className="lifecycle-header">
                <span>Stage</span>
                <span>Description</span>
                <span className="lifecycle-right">kgCO2e</span>
                <span className="lifecycle-right">kgCO2e / t</span>
              </div>
              {(() => {
                const stageTotals = new Map(
                  lifecycleRows.map((row) => {
                    const total =
                      row.summary?.total_kgco2e ??
                      row.details.reduce((sum, r) => sum + (r.total_kgco2e ?? 0), 0);
                    return [row.stage, total];
                  })
                );
                const denom = totalTonnage > 0 ? totalTonnage : null;
                const stageById = new Map(
                  lifecycleRows.map((row) => [row.stage, row])
                );

                const renderStage = (group: typeof lifecycleRows[number]) => {
                  const totalFromDetails = group.details.reduce(
                    (sum, row) => sum + (row.total_kgco2e ?? 0),
                    0
                  );
                  const displayDetails = group.details.filter((detail) => {
                    const total = detail.total_kgco2e ?? null;
                    const per = detail.kgco2e_per_tonne ?? null;
                    const hasTotal = total !== null && total !== 0;
                    const hasPer = per !== null && per !== 0;
                    return hasTotal || hasPer;
                  });
                  const summaryTotal = group.summary?.total_kgco2e ?? totalFromDetails;
                  const summaryPer = group.summary?.kgco2e_per_tonne ?? null;
                  const description =
                    group.stage === "A4" && hasTipDelivery
                      ? "Transport to site/Landfill"
                      : group.description ?? "-";
                  const hideTotal = false;
                  const hidePer = group.stage === "A1";
                  const isA5 = group.stage === "A5";
                  const groupedDetails = !isA5
                    ? Array.from(
                        displayDetails.reduce((acc, detail) => {
                          const productLabel =
                            detail.detail_label ?? detail.products?.name ?? "Product";
                          const mixLabel =
                            detail.detail_label
                              ? "?"
                              : detail.mix_types?.name ?? detail.mix_type_id ?? "Mix";
                          const key = `${productLabel}||${mixLabel}`;
                          const existing = acc.get(key) ?? {
                            key,
                            productLabel,
                            mixLabel,
                            totalKg: 0,
                            totalTonnage: 0,
                            items: [] as typeof displayDetails,
                          };
                          const totalKg = detail.total_kgco2e ?? 0;
                          const perTonne = detail.kgco2e_per_tonne ?? 0;
                          existing.totalKg += totalKg;
                          if (perTonne > 0) {
                            existing.totalTonnage += totalKg / perTonne;
                          }
                          existing.items.push(detail);
                          acc.set(key, existing);
                          return acc;
                        }, new Map<string, {
                          key: string;
                          productLabel: string;
                          mixLabel: string;
                          totalKg: number;
                          totalTonnage: number;
                          items: typeof displayDetails;
                        }>()).values()
                      ).sort((a, b) => a.productLabel.localeCompare(b.productLabel))
                    : [];
                  const a5Groups = isA5
                    ? Array.from(
                        displayDetails
                          .reduce((acc, detail) => {
                            const label = detail.detail_label ?? detail.products?.name ?? "Item";
                            const category = normalizeA5Category(
                              a5CategoryByLabel.get(label) ?? label
                            );
                            const groupKey = category || "Other";
                            const existing = acc.get(groupKey) ?? {
                              category: groupKey,
                              total: 0,
                              items: [] as typeof displayDetails,
                            };
                            existing.items.push({ ...detail, detail_label: label });
                            existing.total += detail.total_kgco2e ?? 0;
                            acc.set(groupKey, existing);
                            return acc;
                          }, new Map<string, { category: string; total: number; items: typeof displayDetails }>())
                          .values()
                      )
                    : [];
                  const a5Order = ["Plant", "Transport", "Material", "Fuel", "Other"];
                  const expectedA5Categories = isA5
                    ? Array.from(
                        new Set(
                          [
                            "Plant",
                            "Transport",
                            "Material",
                            ...((schemeInstallationItems ?? []).map((row) =>
                              normalizeA5Category(row.category)
                            )),
                          ].filter(Boolean)
                        )
                      )
                    : [];
                  const mergedA5Groups = isA5
                    ? expectedA5Categories.map((category) => {
                        const match = a5Groups.find((group) => group.category === category);
                        return (
                          match ?? {
                            category,
                            total: 0,
                            items: [] as typeof displayDetails,
                          }
                        );
                      })
                    : [];
                  const sortedA5Groups = isA5
                    ? mergedA5Groups.sort(
                        (a, b) =>
                          a5Order.indexOf(a.category) - a5Order.indexOf(b.category)
                      )
                    : [];

                  return (
                    <details key={group.stage} className="lifecycle-card">
                      <summary className="lifecycle-summary">
                        <span className="lifecycle-stage">
                          <span className="lifecycle-badge">{group.stage}</span>
                        </span>
                        <span className="lifecycle-desc">{description}</span>
                        <span className="lifecycle-right">
                          {formatNumber(hideTotal ? null : summaryTotal ?? null, 2)}
                        </span>
                        <span className="lifecycle-right">
                          {formatNumber(hidePer ? null : summaryPer, 2)}
                        </span>
                      </summary>
                      {displayDetails.length ? (
                        <div className="lifecycle-details">
                          {isA5 ? (
                            <div className="a5-category-table">
                              <div className="lifecycle-detail-head">
                                <span>Category</span>
                                <span>Items</span>
                                <span className="lifecycle-right">kgCO2e</span>
                                <span className="lifecycle-right">kgCO2e / t</span>
                              </div>
                              {sortedA5Groups.map((categoryGroup) => (
                                <details
                                  key={`a5-${categoryGroup.category}`}
                                  className="lifecycle-detail-group"
                                >
                                  {(() => {
                                    const categoryPer =
                                      deliveredTonnage > 0
                                        ? categoryGroup.total / deliveredTonnage
                                        : null;
                                    return (
                                      <summary className="lifecycle-detail-row lifecycle-detail-summary">
                                        <span>{categoryGroup.category}</span>
                                        <span>{categoryGroup.items.length} items</span>
                                        <span className="lifecycle-right">
                                          {formatNumber(categoryGroup.total ?? null, 2)}
                                        </span>
                                        <span className="lifecycle-right">
                                          {formatNumber(categoryPer, 2)}
                                        </span>
                                      </summary>
                                    );
                                  })()}
                                  <div className="lifecycle-subdetails">
                                    <div className="lifecycle-detail-head a5-detail-head">
                                      <span>Item</span>
                                      <span className="lifecycle-right">kgCO2e</span>
                                      <span className="lifecycle-right">kgCO2e / t</span>
                                    </div>
                                    {categoryGroup.items.map((detail, detailIndex) => {
                                      const perTonne =
                                        detail.kgco2e_per_tonne ??
                                        (deliveredTonnage > 0
                                          ? (detail.total_kgco2e ?? 0) /
                                            deliveredTonnage
                                          : null);
                                      return (
                                        <div
                                          key={
                                            detail.id ??
                                            `a5-${categoryGroup.category}-${detail.detail_label}-${detail.total_kgco2e}-${detailIndex}`
                                          }
                                          className="lifecycle-detail-row a5-detail-row"
                                        >
                                          <span>{detail.detail_label ?? "-"}</span>
                                          <span className="lifecycle-right">
                                            {formatNumber(detail.total_kgco2e ?? null, 2)}
                                          </span>
                                          <span className="lifecycle-right">
                                            {formatNumber(perTonne, 2)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              ))}
                            </div>
                          ) : (
                            <>
                              <div className="lifecycle-detail-head">
                                <span>Product</span>
                                <span>Mix</span>
                                <span className="lifecycle-right">kgCO2e</span>
                                <span className="lifecycle-right">kgCO2e / t</span>
                              </div>
                              {groupedDetails.map((grouped) => {
                                const groupedPer =
                                  grouped.totalTonnage > 0
                                    ? grouped.totalKg / grouped.totalTonnage
                                    : null;
                                return (
                                  <details
                                    key={`${group.stage}-${grouped.key}`}
                                    className="lifecycle-detail-group"
                                  >
                                    <summary className="lifecycle-detail-row lifecycle-detail-summary">
                                      <span>{grouped.productLabel}</span>
                                      <span>{grouped.mixLabel}</span>
                                      <span className="lifecycle-right">
                                        {formatNumber(
                                          hideTotal ? null : grouped.totalKg,
                                          2
                                        )}
                                      </span>
                                      <span className="lifecycle-right">
                                        {formatNumber(hidePer ? null : groupedPer, 2)}
                                      </span>
                                    </summary>
                                    <div className="lifecycle-subdetails">
                                      <div className="lifecycle-detail-head">
                                        <span>Item</span>
                                        <span>Mix</span>
                                        <span className="lifecycle-right">kgCO2e</span>
                                        <span className="lifecycle-right">kgCO2e / t</span>
                                      </div>
                                      {grouped.items.map((detail, detailIndex) => (
                                        <div
                                          key={
                                            detail.id ??
                                            `${group.stage}-${detail.product_id ?? "detail"}-${detail.mix_type_id ?? "mix"}-${detail.total_kgco2e}-${detailIndex}`
                                          }
                                          className="lifecycle-detail-row"
                                        >
                                          <span>{detail.products?.name ?? "-"}</span>
                                          <span>{detail.mix_types?.name ?? detail.mix_type_id ?? "-"}</span>
                                          <span className="lifecycle-right">
                                            {formatNumber(
                                              hideTotal ? null : detail.total_kgco2e ?? null,
                                              2
                                            )}
                                          </span>
                                          <span className="lifecycle-right">
                                            {formatNumber(
                                              hidePer ? null : detail.kgco2e_per_tonne ?? null,
                                              2
                                            )}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                );
                              })}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="lifecycle-empty">No breakdown rows.</div>
                      )}
                    </details>
                  );
                };

                const aggregates = [
                  { label: "A1-A3", stages: ["A2", "A3"] },
                  { label: "A1-A4", stages: ["A2", "A3", "A4"] },
                  { label: "A1-A5", stages: ["A2", "A3", "A4", "A5"] },
                ];

                return aggregates.map((aggregate) => {
                  const total = aggregate.stages.reduce(
                    (sum, stage) => sum + (stageTotals.get(stage) ?? 0),
                    0
                  );
                  const per = denom ? total / denom : null;
                  return (
                    <details
                      key={aggregate.label}
                      className="lifecycle-card lifecycle-aggregate-card"
                    >
                      <summary className="lifecycle-summary">
                        <span className="lifecycle-stage">
                          <span className="lifecycle-badge">{aggregate.label}</span>
                        </span>
                        <span className="lifecycle-desc"></span>
                        <span className="lifecycle-right">
                          {formatNumber(total, 2)}
                        </span>
                        <span className="lifecycle-right">
                          {formatNumber(per, 2)}
                        </span>
                      </summary>
                      <div className="lifecycle-details lifecycle-nested">
                        {aggregate.stages
                          .map((stage) => stageById.get(stage))
                          .filter(Boolean)
                          .map((stage) => renderStage(stage as typeof lifecycleRows[number]))}
                      </div>
                    </details>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="scheme-empty">No lifecycle results yet</div>
          )}

          <div className="scheme-totals">
            <div className="scheme-totals-metrics">
              <div>
                <span>Total kgCO2e</span>
                <strong>{formatNumber(summary?.total_kgco2e ?? null, 2)}</strong>
              </div>
              <div>
                <span>kgCO2e / tonne</span>
                <strong>{formatNumber(summary?.kgco2e_per_tonne ?? null, 2)}</strong>
              </div>
            </div>
            <div className="scheme-totals-actions">
              <form
                action={async () => {
                  "use server";
                  await recalculateSchemeCarbon(schemeId);
                }}
                className="scheme-totals-action"
              >
                <button className="btn-primary" type="submit">
                  Recalculate CO2
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
    </AuthGate>
  );
}



