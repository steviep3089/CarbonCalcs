"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const MILES_TO_KM = 1.60934;

const normalizeDistanceUnit = (unit: string | null | undefined) =>
  (unit ?? "km").toLowerCase() === "mi" ? "mi" : "km";

const convertToKm = (value: number, unit: string) =>
  unit === "mi" ? value * MILES_TO_KM : value;

const normalizePostcode = (value: string | null | undefined) =>
  (value ?? "").trim().replace(/\s+/g, "").toUpperCase();

const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
};

async function geocodePostcode(postcode: string) {
  const url = `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Unable to geocode postcode: ${postcode}`);
  }
  const data = await response.json();
  if (!data?.result) {
    throw new Error(`Invalid postcode: ${postcode}`);
  }
  return {
    lat: Number(data.result.latitude),
    lon: Number(data.result.longitude),
  };
}

async function getRoadDistanceKm(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number }
) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  const meters = data?.routes?.[0]?.distance;
  if (typeof meters !== "number") {
    return null;
  }
  return meters / 1000;
}

async function getPostcodeDistanceKm(fromPostcode: string, toPostcode: string) {
  const from = await geocodePostcode(fromPostcode);
  const to = await geocodePostcode(toPostcode);
  const road = await getRoadDistanceKm(from, to);
  if (road !== null) {
    return road;
  }
  return haversineKm(from.lat, from.lon, to.lat, to.lon);
}

async function getSchemeDistanceUnit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schemeId: string
) {
  const { data } = await supabase
    .from("schemes")
    .select("distance_unit")
    .eq("id", schemeId)
    .single();
  return normalizeDistanceUnit(data?.distance_unit);
}

type ScenarioSnapshot = {
  version: number;
  scheme_products: Array<{
    id?: string;
    product_id: string | null;
    plant_id: string | null;
    plant_postcode: string | null;
    transport_mode_id: string | null;
    mix_type_id: string | null;
    delivery_type: string | null;
    tonnage: number | null;
    distance_km: number | null;
    distance_unit: string | null;
  }>;
  scheme_installation_items: Array<{
    id?: string;
    installation_setup_id: string | null;
    plant_name: string | null;
    category: string | null;
    quantity: number | null;
    litres_per_t: number | null;
    litres_na: boolean | null;
    kgco2e: number | null;
    kgco2e_na: boolean | null;
    spread_rate_t_per_m2: number | null;
    material_tonnage_override: number | null;
    kgco2_per_t: number | null;
    kgco2_per_ltr: number | null;
    kgco2e_per_km: number | null;
    one_way: boolean | null;
    fuel_type_id: string | null;
    fuel_kgco2_per_ltr: number | null;
  }>;
  scheme_a5_usage_entries: Array<{
    id?: string;
    scheme_installation_item_id: string | null;
    period_start: string | null;
    period_end: string | null;
    litres_used: number | null;
    distance_km_each_way: number | null;
    one_way: boolean | null;
    auto_generated?: boolean | null;
  }>;
  scheme_carbon_results: Array<{
    lifecycle_stage: string;
    total_kgco2e: number | null;
    kgco2e_per_tonne: number | null;
    detail_label: string | null;
    product_id: string | null;
    mix_type_id: string | null;
  }>;
  scheme_carbon_summary: {
    total_kgco2e: number | null;
    kgco2e_per_tonne: number | null;
  } | null;
};

async function buildScenarioSnapshot(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schemeId: string
): Promise<ScenarioSnapshot> {
  const { data: schemeProducts } = await supabase
    .from("scheme_products")
    .select(
      "id, product_id, plant_id, plant_postcode, transport_mode_id, mix_type_id, delivery_type, tonnage, distance_km, distance_unit"
    )
    .eq("scheme_id", schemeId)
    .order("created_at");

  const { data: installationItems } = await supabase
    .from("scheme_installation_items")
    .select(
      `id,
      installation_setup_id,
      plant_name,
      category,
      quantity,
      litres_per_t,
      litres_na,
      kgco2e,
      kgco2e_na,
      spread_rate_t_per_m2,
      material_tonnage_override,
      kgco2_per_t,
      kgco2_per_ltr,
      kgco2e_per_km,
      one_way,
      fuel_type_id,
      fuel_kgco2_per_ltr`
    )
    .eq("scheme_id", schemeId)
    .order("created_at");

  const { data: usageEntries } = await supabase
    .from("scheme_a5_usage_entries")
    .select(
      "id, scheme_installation_item_id, period_start, period_end, litres_used, distance_km_each_way, one_way, auto_generated"
    )
    .eq("scheme_id", schemeId)
    .order("created_at");

  const { data: carbonResults } = await supabase
    .from("scheme_carbon_results")
    .select(
      "lifecycle_stage, total_kgco2e, kgco2e_per_tonne, detail_label, product_id, mix_type_id"
    )
    .eq("scheme_id", schemeId)
    .order("lifecycle_stage");

  const { data: carbonSummary } = await supabase
    .from("scheme_carbon_summaries")
    .select("total_kgco2e, kgco2e_per_tonne")
    .eq("scheme_id", schemeId)
    .maybeSingle();

  return {
    version: 1,
    scheme_products: schemeProducts ?? [],
    scheme_installation_items: installationItems ?? [],
    scheme_a5_usage_entries: usageEntries ?? [],
    scheme_carbon_results: carbonResults ?? [],
    scheme_carbon_summary: carbonSummary ?? null,
  };
}

async function buildScenarioLabel(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schemeId: string,
  fallback: string
) {
  const { data } = await supabase
    .from("scheme_products")
    .select(
      `
      mix_types ( name )
    `
    )
    .eq("scheme_id", schemeId);

  const names = new Set<string>();
  (data ?? []).forEach((row) => {
    if (row.mix_types?.name) names.add(row.mix_types.name);
  });

  const label = Array.from(names).join(", ").trim();
  if (!label) return fallback;
  if (label.length > 72) return `${label.slice(0, 69)}...`;
  return label;
}

async function applyScenarioSnapshot(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schemeId: string,
  snapshot: ScenarioSnapshot
) {
  await supabase.from("scheme_a5_usage_entries").delete().eq("scheme_id", schemeId);
  await supabase.from("scheme_installation_items").delete().eq("scheme_id", schemeId);
  await supabase.from("scheme_products").delete().eq("scheme_id", schemeId);

  const products = Array.isArray(snapshot?.scheme_products)
    ? snapshot.scheme_products
    : [];
  const installations = Array.isArray(snapshot?.scheme_installation_items)
    ? snapshot.scheme_installation_items
    : [];
  const usages = Array.isArray(snapshot?.scheme_a5_usage_entries)
    ? snapshot.scheme_a5_usage_entries
    : [];

  if (products.length) {
    const { error } = await supabase.from("scheme_products").insert(
      products.map((row) => ({
        ...row,
        scheme_id: schemeId,
      }))
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (installations.length) {
    const { error } = await supabase.from("scheme_installation_items").insert(
      installations.map((row) => ({
        ...row,
        scheme_id: schemeId,
      }))
    );
    if (error) {
      throw new Error(error.message);
    }
  }

  if (usages.length) {
    const { error } = await supabase.from("scheme_a5_usage_entries").insert(
      usages.map((row) => ({
        ...row,
        scheme_id: schemeId,
      }))
    );
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function setSchemeDistanceUnitKm(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("schemes")
    .update({ distance_unit: "km" })
    .eq("id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function setSchemeDistanceUnitMi(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("schemes")
    .update({ distance_unit: "mi" })
    .eq("id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function updateSchemeSitePostcode(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const site_postcode = (formData.get("site_postcode") as string | null)?.trim() ?? "";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("schemes")
    .update({ site_postcode: site_postcode || null })
    .eq("id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function recalculateSchemeCarbon(schemeId: string) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (error) {
    console.error("Edge function error:", error);
    throw new Error(error.message || "Failed to recalculate scheme carbon");
  }

  revalidatePath(`/schemes/${schemeId}`);
  return data;
}
export async function addSchemeProduct(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const product_id = formData.get("product_id") as string;
  const plant_id = formData.get("plant_id") as string;
  const transport_mode_id = formData.get("transport_mode_id") as string;
  const mix_type_id = formData.get("mix_type_id") as string;
  const delivery_type = (formData.get("delivery_type") as string) || "delivery";
  const tonnage = Number(formData.get("tonnage"));
  const distanceValue = (formData.get("distance_km") as string | null) ?? "";
  const distanceUnitOverride = (formData.get("distance_unit") as string | null) ?? "";
  const distanceInput =
    distanceValue.trim() === "" ? null : Number(distanceValue);

  if (!product_id || !plant_id || !mix_type_id || Number.isNaN(tonnage)) {
    throw new Error("Missing required fields");
  }
  if (tonnage <= 0) {
    throw new Error("Tonnage must be greater than 0");
  }

  if (distanceInput !== null && Number.isNaN(distanceInput)) {
    throw new Error("Invalid distance");
  }

  if (!["delivery", "return", "tip"].includes(delivery_type)) {
    throw new Error("Invalid delivery type");
  }

  // Fetch plant postcode (stored as location) and scheme site postcode
  const { data: plant, error: plantError } = await supabase
    .from("plants")
    .select("location")
    .eq("id", plant_id)
    .single();

  if (plantError || !plant) {
    throw new Error("Unable to fetch plant location");
  }

  const { data: schemeRow, error: schemeRowError } = await supabase
    .from("schemes")
    .select("site_postcode")
    .eq("id", schemeId)
    .single();

  if (schemeRowError) {
    throw new Error("Unable to fetch scheme site postcode");
  }

  const schemeDistanceUnit = await getSchemeDistanceUnit(supabase, schemeId);
  const distanceUnit = distanceUnitOverride
    ? normalizeDistanceUnit(distanceUnitOverride)
    : schemeDistanceUnit;
  const plantPostcode = normalizePostcode(plant.location);
  const sitePostcode = normalizePostcode(schemeRow?.site_postcode);
  let distance_km: number | null = null;

  if (distanceInput !== null) {
    distance_km = convertToKm(distanceInput, distanceUnit);
  } else if (plantPostcode && sitePostcode) {
    distance_km = await getPostcodeDistanceKm(sitePostcode, plantPostcode);
  }

  if (distance_km === null) {
    throw new Error(
      "Enter a distance or set both the scheme site postcode and plant postcode."
    );
  }

  const { error } = await supabase.from("scheme_products").insert({
    scheme_id: schemeId,
    product_id,
    plant_id,
    plant_postcode: plant.location,
    transport_mode_id: transport_mode_id || null,
    mix_type_id,
    delivery_type,
    tonnage,
    distance_km,
    distance_unit: distanceUnit,
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data: schemeMode } = await supabase
    .from("schemes")
    .select("a5_fuel_mode")
    .eq("id", schemeId)
    .single();

  if ((schemeMode?.a5_fuel_mode ?? "auto").toLowerCase() === "auto") {
    await autoCalculateA5PlantUsage(schemeId);
  }

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    throw new Error(recalcError.message);
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function deleteSchemeProduct(schemeId: string, formData: FormData) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const id = formData.get("id") as string;
  if (!id) {
    throw new Error("No scheme product id provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("scheme_products")
    .delete()
    .eq("id", id)
    .eq("scheme_id", schemeId);

  if (error) {
    throw new Error(error.message);
  }

  const { count, error: countError } = await supabase
    .from("scheme_products")
    .select("id", { count: "exact", head: true })
    .eq("scheme_id", schemeId);

  if (countError) {
    throw new Error(countError.message);
  }

  if ((count ?? 0) === 0) {
    const { error: clearResultsError } = await supabase
      .from("scheme_carbon_results")
      .delete()
      .eq("scheme_id", schemeId);

    if (clearResultsError) {
      throw new Error(clearResultsError.message);
    }

    const { error: clearSummaryError } = await supabase
      .from("scheme_carbon_summaries")
      .delete()
      .eq("scheme_id", schemeId);

    if (clearSummaryError) {
      throw new Error(clearSummaryError.message);
    }
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function addSchemeInstallationItem(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const installation_setup_id = formData.get("installation_setup_id") as string;
  const quantity = Number(formData.get("quantity"));
  const fuel_type_id = (formData.get("fuel_type_id") as string | null) ?? null;

  if (!installation_setup_id || Number.isNaN(quantity) || quantity <= 0) {
    throw new Error("Missing required fields");
  }

  const { data: setup, error: setupError } = await supabase
    .from("installation_setups")
    .select(
      "plant_name, category, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e_per_km, litres_per_t, litres_na, kgco2e, kgco2e_na, one_way"
    )
    .eq("id", installation_setup_id)
    .single();

  if (setupError || !setup) {
    throw new Error(setupError?.message || "Installation setup not found");
  }

  const category = (setup.category ?? "").toLowerCase();
  const requiresFuel = category === "plant" || category === "transport";
  if (requiresFuel && !fuel_type_id) {
    throw new Error("Fuel type is required for plant and transport items");
  }

  let fuel_kgco2_per_ltr: number | null = null;
  if (fuel_type_id) {
    const { data: fuel, error: fuelError } = await supabase
      .from("installation_setups")
      .select("kgco2_per_ltr")
      .eq("id", fuel_type_id)
      .single();
    if (fuelError || !fuel) {
      throw new Error(fuelError?.message || "Fuel type not found");
    }
    fuel_kgco2_per_ltr = fuel.kgco2_per_ltr ?? null;
  }

  const { error } = await supabase.from("scheme_installation_items").insert({
    scheme_id: schemeId,
    installation_setup_id,
    plant_name: setup.plant_name,
    category: setup.category,
    spread_rate_t_per_m2: setup.spread_rate_t_per_m2,
    kgco2_per_t: setup.kgco2_per_t,
    kgco2_per_ltr: setup.kgco2_per_ltr,
    kgco2e_per_km: setup.kgco2e_per_km,
    litres_per_t: setup.litres_per_t,
    litres_na: setup.litres_na ?? false,
    kgco2e: setup.kgco2e,
    kgco2e_na: setup.kgco2e_na ?? false,
    one_way: setup.one_way ?? false,
    fuel_type_id,
    fuel_kgco2_per_ltr,
    quantity,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function addSchemeInstallationItemsBulk(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const setupIds = formData.getAll("setup_ids") as string[];
  if (!setupIds.length) {
    throw new Error("No installation items available");
  }

  const { data: setups, error: setupsError } = await supabase
    .from("installation_setups")
    .select(
      "id, plant_name, category, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e_per_km, litres_per_t, litres_na, kgco2e, kgco2e_na, one_way"
    )
    .in("id", setupIds);

  if (setupsError || !setups) {
    throw new Error(setupsError?.message || "Unable to load installation setups");
  }

  const fuelTypeIds = Array.from(
    new Set(
      setupIds
        .map((id) => (formData.get(`fuel_type_id_${id}`) as string | null) ?? "")
        .filter(Boolean)
    )
  );

  const fuelMap = new Map<string, number | null>();
  if (fuelTypeIds.length) {
    const { data: fuels, error: fuelError } = await supabase
      .from("installation_setups")
      .select("id, kgco2_per_ltr")
      .in("id", fuelTypeIds);
    if (fuelError) {
      throw new Error(fuelError.message);
    }
    fuels?.forEach((fuel) => {
      fuelMap.set(fuel.id, fuel.kgco2_per_ltr ?? null);
    });
  }

  const setupMap = new Map(setups.map((setup) => [setup.id, setup]));
  const records = setupIds
    .map((id) => {
      const setup = setupMap.get(id);
      if (!setup) return null;
      let fuelKgco2: number | null = null;
      const category = (setup.category ?? "").toLowerCase();
      const quantityValue = formData.get(`quantity_${id}`);
      const rawQuantity = quantityValue === null ? "" : String(quantityValue).trim();
      const quantity =
        rawQuantity === "" && category === "material" ? 1 : Number(rawQuantity || "0");
      if (Number.isNaN(quantity) || quantity <= 0) {
        return null;
      }
      const requiresFuel = category === "plant" || category === "transport";
      const fuelTypeId =
        (formData.get(`fuel_type_id_${id}`) as string | null) ?? null;
      if (requiresFuel && !fuelTypeId) {
        throw new Error(`Fuel type is required for ${setup.plant_name}`);
      }
      if (fuelTypeId) {
        fuelKgco2 = fuelMap.get(fuelTypeId) ?? null;
        if (!fuelMap.has(fuelTypeId)) {
          throw new Error("Fuel type not found");
        }
      }
      return {
        scheme_id: schemeId,
        installation_setup_id: setup.id,
        plant_name: setup.plant_name,
        category: setup.category,
        spread_rate_t_per_m2: setup.spread_rate_t_per_m2,
        kgco2_per_t: setup.kgco2_per_t,
        kgco2_per_ltr: setup.kgco2_per_ltr,
        kgco2e_per_km: setup.kgco2e_per_km,
        litres_per_t: setup.litres_per_t,
        litres_na: setup.litres_na ?? false,
        kgco2e: setup.kgco2e,
        kgco2e_na: setup.kgco2e_na ?? false,
        one_way: setup.one_way ?? false,
        fuel_type_id: fuelTypeId,
        fuel_kgco2_per_ltr: fuelKgco2,
        quantity,
      };
    })
    .filter(Boolean);

  if (!records.length) {
    throw new Error("No valid items selected");
  }

  const { error } = await supabase.from("scheme_installation_items").insert(records);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function enableAutoInstallationItems(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: setups, error: setupError } = await supabase
    .from("installation_setups")
    .select(
      "id, plant_name, category, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e_per_km, litres_per_t, litres_na, kgco2e, kgco2e_na, one_way, is_default"
    )
    .eq("is_default", true);

  if (setupError) {
    return { ok: false, error: setupError.message };
  }

  const defaultFuel = (setups ?? []).find(
    (row) => (row.category ?? "").toLowerCase() === "fuel"
  );
  if (!defaultFuel) {
    return { ok: false, error: "Set a default fuel in Installation Setup." };
  }

  const defaultItems = (setups ?? []).filter((row) => {
    const category = (row.category ?? "").toLowerCase();
    return category === "plant" || category === "transport";
  });

  if (!defaultItems.length) {
    return { ok: false, error: "No default plant or transport items found." };
  }

  const { error: clearError } = await supabase
    .from("scheme_installation_items")
    .delete()
    .eq("scheme_id", schemeId)
    .or("category.ilike.plant,category.ilike.transport");

  if (clearError) {
    return { ok: false, error: clearError.message };
  }

  const records = defaultItems.map((setup) => ({
    scheme_id: schemeId,
    installation_setup_id: setup.id,
    plant_name: setup.plant_name,
    category: setup.category,
    spread_rate_t_per_m2: setup.spread_rate_t_per_m2,
    kgco2_per_t: setup.kgco2_per_t,
    kgco2_per_ltr: setup.kgco2_per_ltr,
    kgco2e_per_km: setup.kgco2e_per_km,
    litres_per_t: setup.litres_per_t,
    litres_na: setup.litres_na ?? false,
    kgco2e: setup.kgco2e,
    kgco2e_na: setup.kgco2e_na ?? false,
    one_way: setup.one_way ?? false,
    fuel_type_id: defaultFuel.id,
    fuel_kgco2_per_ltr: defaultFuel.kgco2_per_ltr ?? null,
    quantity: 1,
  }));

  const { error: insertError } = await supabase
    .from("scheme_installation_items")
    .insert(records);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { error: modeError } = await supabase
    .from("schemes")
    .update({ installation_mode: "auto" })
    .eq("id", schemeId);

  if (modeError) {
    return { ok: false, error: modeError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function enableManualInstallationItems(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("schemes")
    .update({ installation_mode: "manual" })
    .eq("id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function enableAutoMaterials(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: setups, error: setupError } = await supabase
    .from("installation_setups")
    .select(
      "id, plant_name, category, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e_per_km, litres_per_t, litres_na, kgco2e, kgco2e_na, one_way, is_default"
    )
    .eq("is_default", true);

  if (setupError) {
    return { ok: false, error: setupError.message };
  }

  const defaultMaterials = (setups ?? []).filter(
    (row) => (row.category ?? "").toLowerCase() === "material"
  );

  if (!defaultMaterials.length) {
    return { ok: false, error: "No default materials found." };
  }

  const { error: clearError } = await supabase
    .from("scheme_installation_items")
    .delete()
    .eq("scheme_id", schemeId)
    .ilike("category", "material");

  if (clearError) {
    return { ok: false, error: clearError.message };
  }

  const records = defaultMaterials.map((setup) => ({
    scheme_id: schemeId,
    installation_setup_id: setup.id,
    plant_name: setup.plant_name,
    category: setup.category,
    spread_rate_t_per_m2: setup.spread_rate_t_per_m2,
    kgco2_per_t: setup.kgco2_per_t,
    kgco2_per_ltr: setup.kgco2_per_ltr,
    kgco2e_per_km: setup.kgco2e_per_km,
    litres_per_t: setup.litres_per_t,
    litres_na: setup.litres_na ?? false,
    kgco2e: setup.kgco2e,
    kgco2e_na: setup.kgco2e_na ?? false,
    one_way: setup.one_way ?? false,
    quantity: 1,
  }));

  const { error: insertError } = await supabase
    .from("scheme_installation_items")
    .insert(records);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { error: modeError } = await supabase
    .from("schemes")
    .update({ materials_mode: "auto" })
    .eq("id", schemeId);

  if (modeError) {
    return { ok: false, error: modeError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function enableManualMaterials(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("schemes")
    .update({ materials_mode: "manual" })
    .eq("id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function deleteSchemeInstallationItem(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const id = formData.get("id") as string;
  if (!id) {
    throw new Error("No installation item id provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("scheme_installation_items")
    .delete()
    .eq("id", id)
    .eq("scheme_id", schemeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function updateSchemeMaterialUsage(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const id = formData.get("id") as string;
  if (!id) {
    return { ok: false, error: "Missing material id" };
  }

  const rawValue = (formData.get("material_tonnage_override") as string | null) ?? "";
  const trimmed = rawValue.trim();
  const material_tonnage_override = trimmed === "" ? null : Number(trimmed);

  if (material_tonnage_override !== null && Number.isNaN(material_tonnage_override)) {
    return { ok: false, error: "Invalid tonnage value" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("scheme_installation_items")
    .update({ material_tonnage_override })
    .eq("id", id)
    .eq("scheme_id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    return { ok: false, error: recalcError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function autoGenerateMaterialTonnage(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: scheme, error: schemeError } = await supabase
    .from("schemes")
    .select("area_m2")
    .eq("id", schemeId)
    .single();

  if (schemeError) {
    return { ok: false, error: schemeError.message };
  }

  const area_m2 = scheme?.area_m2 ?? 0;

  const { data: items, error: itemsError } = await supabase
    .from("scheme_installation_items")
    .select("id, spread_rate_t_per_m2, quantity, category")
    .eq("scheme_id", schemeId);

  if (itemsError || !items) {
    return { ok: false, error: itemsError?.message || "No materials found" };
  }

  const materials = items.filter(
    (item) => (item.category ?? "").toLowerCase() === "material"
  );

  if (!materials.length) {
    return { ok: false, error: "Add at least one material before auto generating." };
  }

  for (const item of materials) {
    const spread = item.spread_rate_t_per_m2 ?? 0;
    const qty = item.quantity ?? 1;
    const autoTonnage = (area_m2 * spread * qty) / 1000;
    const { error } = await supabase
      .from("scheme_installation_items")
      .update({ material_tonnage_override: autoTonnage })
      .eq("id", item.id)
      .eq("scheme_id", schemeId);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    return { ok: false, error: recalcError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function addSchemeA5Usage(
  schemeId: string,
  formData: FormData
) {
  try {
    if (!schemeId) {
      return { ok: false, error: "No schemeId provided" };
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { ok: false, error: "Unauthorized" };
    }

    const { data: schemeMode } = await supabase
      .from("schemes")
      .select("a5_fuel_mode")
      .eq("id", schemeId)
      .single();
    const fuelMode = (schemeMode?.a5_fuel_mode ?? "manual").toLowerCase();

    const period_start = (formData.get("period_start") as string | null) ?? "";
    const period_end = (formData.get("period_end") as string | null) ?? "";
    const distanceUnit = await getSchemeDistanceUnit(supabase, schemeId);

    if (!period_start) {
      return { ok: false, error: "Start date is required" };
    }

    const itemIds = formData.getAll("usage_item_ids") as string[];
    if (!itemIds.length) {
      return { ok: false, error: "No plant or transport items available" };
    }

    const { data: items, error: itemsError } = await supabase
      .from("scheme_installation_items")
      .select("id, category")
      .in("id", itemIds)
      .eq("scheme_id", schemeId);

    if (itemsError || !items) {
      return {
        ok: false,
        error: itemsError?.message || "Unable to load installation items",
      };
    }

    const records = items
      .map((item) => {
        const category = (item.category ?? "").trim().toLowerCase();
        if (category === "plant") {
          if (fuelMode === "auto") {
            return null;
          }
          const litresValue = formData.get(`litres_used_${item.id}`);
          const litres_used =
            litresValue === null || litresValue === ""
              ? NaN
              : Number(litresValue);
          if (Number.isNaN(litres_used)) {
            return null;
          }
          if (litres_used <= 0) {
            throw new Error("Litres used must be greater than 0");
          }
          return {
            scheme_id: schemeId,
            scheme_installation_item_id: item.id,
            period_start,
            period_end: period_end || null,
            litres_used,
            distance_km_each_way: null,
          };
        }

        if (category === "transport") {
          const distanceValue = formData.get(`distance_km_${item.id}`);
          const distanceInput =
            distanceValue === null || distanceValue === ""
              ? NaN
              : Number(distanceValue);
          const one_way = formData.get(`one_way_${item.id}`) === "on";
          if (Number.isNaN(distanceInput)) {
            return null;
          }
          if (distanceInput <= 0) {
            throw new Error("Distance must be greater than 0");
          }
          const distance_km_each_way = convertToKm(distanceInput, distanceUnit);
          return {
            scheme_id: schemeId,
            scheme_installation_item_id: item.id,
            period_start,
            period_end: period_end || null,
            litres_used: null,
            distance_km_each_way,
            one_way,
          };
        }
        return null;
      })
      .filter(Boolean);

    if (!records.length) {
      return {
        ok: false,
        error:
          fuelMode === "auto"
            ? "Auto plant fuel is enabled. Enter distance for transport items only."
            : "Enter litres or distance for at least one item",
      };
    }

    const { error } = await supabase
      .from("scheme_a5_usage_entries")
      .insert(records);

    if (error) {
      return { ok: false, error: error.message };
    }

    const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
      p_scheme_id: schemeId,
    });

    if (recalcError) {
      return { ok: false, error: recalcError.message };
    }

    revalidatePath(`/schemes/${schemeId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to add usage",
    };
  }
}

export async function deleteSchemeA5Usage(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const id = formData.get("id") as string;
  if (!id) {
    throw new Error("No usage entry id provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("scheme_a5_usage_entries")
    .delete()
    .eq("id", id)
    .eq("scheme_id", schemeId);

  if (error) {
    throw new Error(error.message);
  }

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    throw new Error(recalcError.message);
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function updateSchemeA5Usage(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const id = formData.get("id") as string;
  if (!id) {
    return { ok: false, error: "No usage entry id provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const distanceUnit = await getSchemeDistanceUnit(supabase, schemeId);

  const period_start = (formData.get("period_start") as string | null) ?? "";
  const period_end = (formData.get("period_end") as string | null) ?? "";
  const litresValue = (formData.get("litres_used") as string | null) ?? "";
  const distanceValue = (formData.get("distance_km_each_way") as string | null) ?? "";
  const oneWayPresent = formData.get("one_way_present") === "1";

  const litres_used = litresValue.trim() === "" ? null : Number(litresValue);
  const distance_km_each_way =
    distanceValue.trim() === "" ? null : Number(distanceValue);

  if (litres_used !== null && Number.isNaN(litres_used)) {
    return { ok: false, error: "Invalid litres value" };
  }
  if (distance_km_each_way !== null && Number.isNaN(distance_km_each_way)) {
    return { ok: false, error: "Invalid distance value" };
  }
  if (litres_used === null && distance_km_each_way === null && !oneWayPresent) {
    return { ok: false, error: "Enter litres or distance" };
  }

  const updateData: Record<string, unknown> = {};
  if (litres_used !== null) updateData.litres_used = litres_used;
  if (distance_km_each_way !== null) {
    updateData.distance_km_each_way = convertToKm(
      distance_km_each_way,
      distanceUnit
    );
  }
  if (oneWayPresent) {
    updateData.one_way = formData.get("one_way") === "on";
  }
  if (period_start.trim() !== "") updateData.period_start = period_start;
  if (formData.has("period_end")) {
    updateData.period_end = period_end.trim() === "" ? null : period_end;
  }

  const { error } = await supabase
    .from("scheme_a5_usage_entries")
    .update(updateData)
    .eq("id", id)
    .eq("scheme_id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    return { ok: false, error: recalcError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function autoCalculateA5PlantUsage(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: tonnageRow, error: tonnageError } = await supabase
    .from("scheme_products")
    .select("tonnage, delivery_type")
    .eq("scheme_id", schemeId);

  if (tonnageError) {
    return { ok: false, error: tonnageError.message };
  }

  const deliveredTonnage = (tonnageRow ?? []).reduce((sum, row) => {
    const deliveryType = (row.delivery_type ?? "delivery").toLowerCase();
    if (deliveryType === "delivery") {
      return sum + (row.tonnage ?? 0);
    }
    return sum;
  }, 0);

  if (!deliveredTonnage || deliveredTonnage <= 0) {
    return { ok: true };
  }

  const { data: plantItems, error: plantError } = await supabase
    .from("scheme_installation_items")
    .select("id, litres_per_t, quantity")
    .eq("scheme_id", schemeId)
    .ilike("category", "plant");

  if (plantError) {
    return { ok: false, error: plantError.message };
  }

  const rows = (plantItems ?? []).map((item) => {
    const litresPerT = item.litres_per_t ?? 0;
    const qty = item.quantity ?? 1;
    return {
      scheme_id: schemeId,
      scheme_installation_item_id: item.id,
      period_start: new Date().toISOString().slice(0, 10),
      period_end: null,
      litres_used: litresPerT * deliveredTonnage * qty,
      distance_km_each_way: null,
      auto_generated: true,
    };
  });

  if (!rows.length) {
    return { ok: true };
  }

  const { error: deleteError } = await supabase
    .from("scheme_a5_usage_entries")
    .delete()
    .eq("scheme_id", schemeId)
    .in(
      "scheme_installation_item_id",
      (plantItems ?? []).map((item) => item.id)
    );

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  const { error: insertError } = await supabase
    .from("scheme_a5_usage_entries")
    .insert(rows);

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  const { error: modeError } = await supabase
    .from("schemes")
    .update({ a5_fuel_mode: "auto" })
    .eq("id", schemeId);

  if (modeError) {
    return { ok: false, error: modeError.message };
  }

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    return { ok: false, error: recalcError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function applyA5AutoUsage(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const distanceValue =
    (formData.get("distance_km_each_way") as string | null) ?? "";
  const distanceTrimmed = distanceValue.trim();
  const distanceInput =
    distanceTrimmed === "" ? null : Number(distanceTrimmed);

  if (
    distanceInput !== null &&
    (Number.isNaN(distanceInput) || distanceInput <= 0)
  ) {
    return { ok: false, error: "Enter a valid distance for transport items." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const distanceUnit = await getSchemeDistanceUnit(supabase, schemeId);
  let distance_km_each_way: number;

  if (distanceInput !== null) {
    distance_km_each_way = convertToKm(distanceInput, distanceUnit);
  } else {
    const { data: schemeRow, error: schemeError } = await supabase
      .from("schemes")
      .select("base_postcode, site_postcode")
      .eq("id", schemeId)
      .single();

    if (schemeError) {
      return { ok: false, error: schemeError.message };
    }

    const basePostcode = normalizePostcode(schemeRow?.base_postcode);
    const sitePostcode = normalizePostcode(schemeRow?.site_postcode);

    if (!basePostcode || !sitePostcode) {
      return {
        ok: false,
        error: "Enter a distance or set both the base and site postcodes.",
      };
    }

    try {
      distance_km_each_way = await getPostcodeDistanceKm(
        basePostcode,
        sitePostcode
      );
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to calculate distance from postcodes.",
      };
    }
  }

  const { data: transportItems, error: transportError } = await supabase
    .from("scheme_installation_items")
    .select("id")
    .eq("scheme_id", schemeId)
    .ilike("category", "transport");

  if (transportError) {
    return { ok: false, error: transportError.message };
  }

  const today = new Date().toISOString().slice(0, 10);

  if (transportItems?.length) {
    const transportIds = transportItems.map((item) => item.id);
    const { error: deleteError } = await supabase
      .from("scheme_a5_usage_entries")
      .delete()
      .eq("scheme_id", schemeId)
      .in("scheme_installation_item_id", transportIds);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    const transportRows = transportIds.map((id) => ({
      scheme_id: schemeId,
      scheme_installation_item_id: id,
      period_start: today,
      period_end: null,
      litres_used: null,
      distance_km_each_way,
      one_way: false,
      auto_generated: true,
    }));

    const { error: insertError } = await supabase
      .from("scheme_a5_usage_entries")
      .insert(transportRows);

    if (insertError) {
      return { ok: false, error: insertError.message };
    }
  }

  const { error: modeError } = await supabase
    .from("schemes")
    .update({ a5_fuel_mode: "auto" })
    .eq("id", schemeId);

  if (modeError) {
    return { ok: false, error: modeError.message };
  }

  const fuelResult = await autoCalculateA5PlantUsage(schemeId);
  if (fuelResult && fuelResult.ok === false) {
    return fuelResult;
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function enableManualA5Usage(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: plantItems } = await supabase
    .from("scheme_installation_items")
    .select("id")
    .eq("scheme_id", schemeId)
    .ilike("category", "plant");

  if (plantItems?.length) {
    const { error: deleteError } = await supabase
      .from("scheme_a5_usage_entries")
      .delete()
      .eq("scheme_id", schemeId)
      .eq("auto_generated", true)
      .in(
        "scheme_installation_item_id",
        plantItems.map((item) => item.id)
      );
    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }
  }

  const { error: modeError } = await supabase
    .from("schemes")
    .update({ a5_fuel_mode: "manual" })
    .eq("id", schemeId);

  if (modeError) {
    return { ok: false, error: modeError.message };
  }

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    return { ok: false, error: recalcError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function updateSchemeArea(schemeId: string, formData: FormData) {
  if (!schemeId) {
    throw new Error("No schemeId provided");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized");
  }

  const rawValue = (formData.get("area_m2") as string | null) ?? "";
  const trimmed = rawValue.trim();
  const area_m2 = trimmed === "" ? null : Number(trimmed);

  if (area_m2 !== null && (Number.isNaN(area_m2) || area_m2 < 0)) {
    throw new Error("Invalid area");
  }

  const { error } = await supabase
    .from("schemes")
    .update({ area_m2 })
    .eq("id", schemeId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/schemes/${schemeId}`);
  revalidatePath("/schemes");
  return { ok: true };
}

export async function lockScheme(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: existing, error: existingError } = await supabase
    .from("schemes")
    .select("is_locked")
    .eq("id", schemeId)
    .single();

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  if (existing?.is_locked) {
    return { ok: true };
  }

  const { error } = await supabase
    .from("schemes")
    .update({ is_locked: true })
    .eq("id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  revalidatePath("/schemes");
  return { ok: true };
}

export async function createSchemeScenario(schemeId: string) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { count, error: countError } = await supabase
    .from("scheme_scenarios")
    .select("id", { count: "exact", head: true })
    .eq("scheme_id", schemeId);

  if (countError) {
    return { ok: false, error: countError.message };
  }

  if ((count ?? 0) >= 5) {
    return { ok: false, error: "You can only store up to 5 scenarios." };
  }

  const snapshot = await buildScenarioSnapshot(supabase, schemeId);
  const label = await buildScenarioLabel(
    supabase,
    schemeId,
    `Scenario ${(count ?? 0) + 1}`
  );

  const { data: scenario, error } = await supabase
    .from("scheme_scenarios")
    .insert({
      scheme_id: schemeId,
      label,
      label_locked: false,
      snapshot,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !scenario) {
    return { ok: false, error: error?.message ?? "Unable to create scenario" };
  }

  await supabase
    .from("schemes")
    .update({ active_scenario_id: scenario.id })
    .eq("id", schemeId);

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function applySchemeScenario(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const scenario_id = formData.get("scenario_id") as string;
  if (!scenario_id) {
    return { ok: false, error: "Missing scenario id." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: scenario, error } = await supabase
    .from("scheme_scenarios")
    .select("snapshot")
    .eq("id", scenario_id)
    .eq("scheme_id", schemeId)
    .single();

  if (error || !scenario) {
    return { ok: false, error: error?.message ?? "Scenario not found" };
  }

  await applyScenarioSnapshot(supabase, schemeId, scenario.snapshot as ScenarioSnapshot);

  await supabase
    .from("schemes")
    .update({ active_scenario_id: scenario_id })
    .eq("id", schemeId);

  const { error: recalcError } = await supabase.rpc("calculate_scheme_carbon", {
    p_scheme_id: schemeId,
  });

  if (recalcError) {
    return { ok: false, error: recalcError.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function updateSchemeScenarioLabel(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const scenario_id = formData.get("scenario_id") as string;
  const label = (formData.get("label") as string | null)?.trim() ?? "";

  if (!scenario_id) {
    return { ok: false, error: "Missing scenario id." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("scheme_scenarios")
    .update({
      label: label || null,
      label_locked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scenario_id)
    .eq("scheme_id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function updateSchemeScenarioSnapshot(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const scenario_id = formData.get("scenario_id") as string;
  if (!scenario_id) {
    return { ok: false, error: "Missing scenario id." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const snapshot = await buildScenarioSnapshot(supabase, schemeId);

  const { error } = await supabase
    .from("scheme_scenarios")
    .update({ snapshot, updated_at: new Date().toISOString() })
    .eq("id", scenario_id)
    .eq("scheme_id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}

export async function deleteSchemeScenario(
  schemeId: string,
  formData: FormData
) {
  if (!schemeId) {
    return { ok: false, error: "No schemeId provided" };
  }

  const scenario_id = formData.get("scenario_id") as string;
  if (!scenario_id) {
    return { ok: false, error: "Missing scenario id." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "Unauthorized" };
  }

  const { data: current, error: currentError } = await supabase
    .from("schemes")
    .select("active_scenario_id")
    .eq("id", schemeId)
    .single();

  if (currentError) {
    return { ok: false, error: currentError.message };
  }

  const { error } = await supabase
    .from("scheme_scenarios")
    .delete()
    .eq("id", scenario_id)
    .eq("scheme_id", schemeId);

  if (error) {
    return { ok: false, error: error.message };
  }

  if (current?.active_scenario_id === scenario_id) {
    await supabase
      .from("schemes")
      .update({ active_scenario_id: null })
      .eq("id", schemeId);
  }

  revalidatePath(`/schemes/${schemeId}`);
  return { ok: true };
}
