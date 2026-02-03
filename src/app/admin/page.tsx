import { AuthGate } from "@/components/AuthGate";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AdminTabs } from "@/components/AdminTabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  createInstallationSetup,
  createMaterialMapping,
  createMixType,
  createPlant,
  createPlantMixFactor,
  createReportMetric,
  createTransportMode,
  deleteTransportMode,
  deleteInstallationSetup,
  deleteReportMetric,
  inviteUser,
  setPlantMixDefault,
  updateGhgCategory,
  updateGhgFactorFilter,
  setGhgFactorFiltersActive,
  uploadMaterialMappings,
  uploadPlants,
  uploadInstallationSetups,
  updateInstallationSetup,
  updateInstallationSetupsBulk,
  updateMixType,
  updatePlant,
  updatePlantMixFactor,
  updateReportMetric,
  updateTransportMode,
  uploadReportMetrics,
} from "./actions";

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const { data: plants } = await supabase
    .from("plants")
    .select("id, name, location, description, is_default")
    .order("name");

  const { data: mixTypes } = await supabase
    .from("mix_types")
    .select("id, name")
    .order("name");

  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .order("name");

  const { data: transportModes } = await supabase
    .from("transport_modes")
    .select("id, name, kgco2e_per_km, kgco2e_unit, is_default")
    .order("name");

  const { data: plantMixFactors } = await supabase
    .from("plant_mix_carbon_factors")
    .select(
      `
      id,
      plant_id,
      mix_type_id,
      product_id,
      kgco2e_per_tonne,
      is_default,
      valid_from,
      valid_to,
      source,
      plants (
        name
      ),
      products (
        name
      )
    `
    )
    .order("valid_from", { ascending: false });

  const { data: installationSetups } = await supabase
    .from("installation_setups")
    .select(
      `
      id,
      plant_name,
      category,
      is_default,
      spread_rate_t_per_m2,
      kgco2_per_t,
      kgco2_per_ltr,
      kgco2e,
      kgco2e_per_km,
      kgco2e_unit,
      litres_per_t,
      litres_na,
      one_way
    `
    )
    .order("created_at", { ascending: false });

  const { data: reportMetrics } = await supabase
    .from("report_metrics")
    .select(
      "id, kind, label, unit, value, source, source_url, sort_order, is_active, calc_op, calc_factor"
    )
    .order("sort_order", { ascending: true });

  const { data: ghgCategories } = await supabase
    .from("ghg_factor_categories")
    .select("key, label, description, color, icon, sort_order, is_active")
    .order("sort_order", { ascending: true });

  const { data: ghgFilters } = await supabase
    .from("ghg_factor_filters")
    .select(
      "id, year, category_key, level1, level2, level3, level4, column_text, unit, ghg_unit, factor, is_active"
    )
    .eq("year", 2025)
    .order("level1", { ascending: true })
    .order("level2", { ascending: true })
    .order("level3", { ascending: true })
    .order("level4", { ascending: true });

  return (
    <AuthGate>
      <main className="admin-page">
        <header className="admin-header">
          <div className="admin-header-row">
            <div>
              <p className="scheme-kicker">Admin</p>
              <h1>Reference data</h1>
              <p className="schemes-subtitle">
                Maintain plants, materials, logistics, and installation setup data.
              </p>
            </div>
            <div className="admin-header-actions">
              <ThemeToggle />
              <a className="btn-secondary" href="/schemes">
                Back to schemes
              </a>
            </div>
          </div>
        </header>

        <AdminTabs
          plants={plants ?? []}
          mixTypes={mixTypes ?? []}
          products={products ?? []}
          transportModes={transportModes ?? []}
          plantMixFactors={plantMixFactors ?? []}
          installationSetups={installationSetups ?? []}
          reportMetrics={reportMetrics ?? []}
          ghgCategories={ghgCategories ?? []}
          ghgFilters={ghgFilters ?? []}
          actions={{
            createPlant,
            updatePlant,
            createPlantMixFactor,
            updatePlantMixFactor,
            setPlantMixDefault,
            createTransportMode,
            updateTransportMode,
            deleteTransportMode,
            createMixType,
            updateMixType,
            createInstallationSetup,
            updateInstallationSetup,
            updateInstallationSetupsBulk,
            uploadInstallationSetups,
            deleteInstallationSetup,
            uploadPlants,
            createMaterialMapping,
            uploadMaterialMappings,
            inviteUser,
            createReportMetric,
            updateReportMetric,
            deleteReportMetric,
            uploadReportMetrics,
            updateGhgCategory,
            updateGhgFactorFilter,
            setGhgFactorFiltersActive,
          }}
        />
      </main>
    </AuthGate>
  );
}
