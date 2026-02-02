"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type CreateSchemeState = {
  error?: string;
  success?: boolean;
};

async function applyDefaultInstallationItems(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  schemeId: string
) {
  const { data: setups } = await supabase
    .from("installation_setups")
    .select(
      "id, plant_name, category, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e_per_km, litres_per_t, litres_na, kgco2e, kgco2e_na, one_way, is_default"
    )
    .eq("is_default", true);

  const defaultFuel = (setups ?? []).find(
    (row) => (row.category ?? "").toLowerCase() === "fuel"
  );
  const defaultItems = (setups ?? []).filter((row) => {
    const category = (row.category ?? "").toLowerCase();
    return category === "plant" || category === "transport";
  });

  if (!defaultFuel || !defaultItems.length) return;

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

  if (records.length) {
    await supabase.from("scheme_installation_items").insert(records);
  }
}

async function applyDefaultMaterialItems(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  schemeId: string
) {
  const { data: setups } = await supabase
    .from("installation_setups")
    .select(
      "id, plant_name, category, spread_rate_t_per_m2, kgco2_per_t, kgco2_per_ltr, kgco2e_per_km, litres_per_t, litres_na, kgco2e, kgco2e_na, one_way, is_default"
    )
    .eq("is_default", true);

  const defaultMaterials = (setups ?? []).filter(
    (row) => (row.category ?? "").toLowerCase() === "material"
  );

  if (!defaultMaterials.length) return;

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

  if (records.length) {
    await supabase.from("scheme_installation_items").insert(records);
  }
}

export async function createScheme(
  _prevState: CreateSchemeState,
  formData: FormData
): Promise<CreateSchemeState> {
  const name = (formData.get("name") as string | null)?.trim();
  const rawArea = (formData.get("area_m2") as string | null)?.trim() ?? "";
  const area_m2 = rawArea === "" ? null : Number(rawArea);
  const site_postcode = (formData.get("site_postcode") as string | null)?.trim() ?? "";
  const base_postcode = (formData.get("base_postcode") as string | null)?.trim() ?? "";

  if (!name) {
    return { error: "Please enter a scheme name." };
  }

  if (area_m2 !== null && (Number.isNaN(area_m2) || area_m2 < 0)) {
    return { error: "Please enter a valid area in m2." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in to create a scheme." };
  }

  const { data: createdScheme, error } = await supabase
    .from("schemes")
    .insert({
    name,
    plant_id: null,
    area_m2,
    installation_mode: "auto",
    materials_mode: "auto",
    a5_fuel_mode: "auto",
    distance_unit: "km",
    site_postcode: site_postcode || null,
    base_postcode: base_postcode || null,
  })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (createdScheme?.id) {
    await applyDefaultInstallationItems(supabase, createdScheme.id);
    await applyDefaultMaterialItems(supabase, createdScheme.id);
  }

  revalidatePath("/schemes");
  return { success: true };
}

export async function deleteScheme(schemeId: string): Promise<CreateSchemeState> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in to delete a scheme." };
  }

  const { error } = await supabase.from("schemes").delete().eq("id", schemeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/schemes");
  return { success: true };
}
