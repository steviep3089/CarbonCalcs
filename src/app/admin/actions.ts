"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

const MILES_TO_KM = 1.60934;

type ActionState = {
  error?: string;
  success?: boolean;
  count?: number;
  message?: string;
  matches?: Array<{
    id: string;
    plant_id: string;
    mix_type_id: string;
    product_id: string | null;
    kgco2e_per_tonne: number | null;
    valid_from: string | null;
    valid_to: string | null;
    plants?: { name: string | null } | { name: string | null }[] | null;
    products?: { name: string | null } | { name: string | null }[] | null;
  }>;
  proposed?: {
    kgco2e_per_tonne: number;
    valid_from: string | null;
    valid_to: string | null;
    mix_type_id: string;
    product_id: string;
  };
};

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return supabase;
}

async function getBaseUrl() {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return "http://localhost:3000";
  return `${proto}://${host}`;
}

export async function inviteUser(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) {
    return { error: "Email address is required." };
  }

  await requireUser();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !url) {
    return { error: "Missing service role configuration." };
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const baseUrl = await getBaseUrl();
  const { error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${baseUrl}/reset`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: "Invitation sent." };
}

export async function createPlant(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = (formData.get("name") as string | null)?.trim();
  const location = (formData.get("location") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const is_default = formData.get("is_default") === "on";

  if (!name) {
    return { error: "Plant name is required." };
  }

  const supabase = await requireUser();
  if (is_default) {
    await supabase.from("plants").update({ is_default: false }).eq("is_default", true);
  }

  const { error } = await supabase.from("plants").insert({
    name,
    location: location || null,
    description: description || null,
    is_default,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updatePlant(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string | null)?.trim();
  const location = (formData.get("location") as string | null)?.trim();
  const description = (formData.get("description") as string | null)?.trim();
  const is_default = formData.get("is_default") === "on";

  if (!id || !name) {
    return;
  }

  const supabase = await requireUser();
  if (is_default) {
    await supabase.from("plants").update({ is_default: false }).neq("id", id);
  }

  const { error } = await supabase
    .from("plants")
    .update({
      name,
      location: location || null,
      description: description || null,
      is_default,
    })
    .eq("id", id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function createPlantMixFactor(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const plant_id = formData.get("plant_id") as string;
  const mix_type_id = formData.get("mix_type_id") as string;
  const product_id = formData.get("product_id") as string;
  const kgco2e_per_tonne = Number(formData.get("kgco2e_per_tonne"));
  const valid_from = formData.get("valid_from") as string;
  const valid_to = formData.get("valid_to") as string;
  const source = (formData.get("source") as string | null)?.trim();
  const source_url = (formData.get("source_url") as string | null)?.trim();

  if (!plant_id || !mix_type_id || Number.isNaN(kgco2e_per_tonne)) {
    return { error: "Plant, mix type, and kgCO2e are required." };
  }

  const supabase = await requireUser();
  const { error } = await supabase.from("plant_mix_carbon_factors").insert({
    plant_id,
    mix_type_id,
    product_id: product_id || null,
    kgco2e_per_tonne,
    valid_from: valid_from || null,
    valid_to: valid_to || null,
    source: source || null,
    source_url: source_url || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updatePlantMixFactor(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const plant_id = formData.get("plant_id") as string;
  const mix_type_id = formData.get("mix_type_id") as string;
  const product_id = formData.get("product_id") as string;
  const kgco2e_per_tonne = Number(formData.get("kgco2e_per_tonne"));
  const valid_from = formData.get("valid_from") as string;
  const valid_to = formData.get("valid_to") as string;
  const source = (formData.get("source") as string | null)?.trim();

  if (!id || !plant_id || !mix_type_id || Number.isNaN(kgco2e_per_tonne)) {
    return;
  }

  const supabase = await requireUser();
  const { error } = await supabase
    .from("plant_mix_carbon_factors")
    .update({
      plant_id,
      mix_type_id,
      product_id: product_id || null,
      kgco2e_per_tonne,
      valid_from: valid_from || null,
      valid_to: valid_to || null,
      source: source || null,
    })
    .eq("id", id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function setPlantMixDefault(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const plant_id = formData.get("plant_id") as string;

  if (!id || !plant_id) {
    return;
  }

  const supabase = await requireUser();
  const { error: clearError } = await supabase
    .from("plant_mix_carbon_factors")
    .update({ is_default: false })
    .eq("plant_id", plant_id);

  if (clearError) return;

  const { error } = await supabase
    .from("plant_mix_carbon_factors")
    .update({ is_default: true })
    .eq("id", id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function createTransportMode(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim();
  const kgco2eRaw = Number(formData.get("kgco2e_per_km"));
  const unit = ((formData.get("kgco2e_unit") as string | null) ?? "km").toLowerCase();
  const kgco2e_per_km = unit === "mi" ? kgco2eRaw / MILES_TO_KM : kgco2eRaw;
  const is_default = formData.get("is_default") === "on";

  if (!id || !name || Number.isNaN(kgco2e_per_km)) {
    return { error: "Id, name, and kgCO2e value are required." };
  }

  const supabase = await requireUser();
  if (is_default) {
    await supabase
    .from("transport_modes")
    .update({ is_default: false })
    .eq("is_default", true);
  }
  const { error } = await supabase.from("transport_modes").insert({
    id,
    name,
    kgco2e_per_km,
    kgco2e_unit: unit,
    is_default,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updateTransportMode(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim();
  const original_id = (formData.get("original_id") as string | null)?.trim() || null;
  const name = (formData.get("name") as string | null)?.trim();
  const kgco2eRaw = Number(formData.get("kgco2e_per_km"));
  const unit = ((formData.get("kgco2e_unit") as string | null) ?? "km").toLowerCase();
  const kgco2e_per_km = unit === "mi" ? kgco2eRaw / MILES_TO_KM : kgco2eRaw;
  const is_default = formData.get("is_default") === "on";

  if (!id || !name || Number.isNaN(kgco2e_per_km)) {
    return;
  }

  const supabase = await requireUser();
  if (is_default) {
    await supabase
      .from("transport_modes")
      .update({ is_default: false })
      .neq("id", original_id ?? id);
  }
  const { error } = await supabase
    .from("transport_modes")
    .update({ id, name, kgco2e_per_km, kgco2e_unit: unit, is_default })
    .eq("id", original_id ?? id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function deleteTransportMode(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await requireUser();
  const { error } = await supabase.from("transport_modes").delete().eq("id", id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function createMixType(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = (formData.get("id") as string | null)?.trim();
  const name = (formData.get("name") as string | null)?.trim();

  if (!id || !name) {
    return { error: "Id and name are required." };
  }

  const supabase = await requireUser();
  const { error } = await supabase.from("mix_types").insert({ id, name });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updateMixType(formData: FormData): Promise<ActionState> {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string | null)?.trim();

  if (!id || !name) {
    return { error: "Id and name are required." };
  }

  const supabase = await requireUser();
  const { error } = await supabase.from("mix_types").update({ name }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function createMaterialMapping(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const plantIdsRaw = formData.get("plant_ids") as string | null;
  const mix_type_id = (formData.get("mix_type_id") as string | null)?.trim() || null;
  const mix_type_name = (formData.get("mix_type_name") as string | null)?.trim() || null;
  const product_id = (formData.get("product_id") as string | null)?.trim() || null;
  const product_name = (formData.get("product_name") as string | null)?.trim() || null;
  const kgco2e_per_tonne = Number(formData.get("kgco2e_per_tonne"));
  const valid_from = (formData.get("valid_from") as string | null)?.trim() || null;
  const valid_to_raw = (formData.get("valid_to") as string | null)?.trim() || null;
  const valid_to_na = formData.get("valid_to_na") === "on";
  const valid_to = valid_to_na ? null : valid_to_raw;
  const a1_includes_raw_materials = formData.get("a1_includes_raw_materials") === "on";
  const mode = (formData.get("mode") as string | null) ?? "";
  const overwriteIdsRaw = formData.get("overwrite_ids") as string | null;

  if (!plantIdsRaw) return { error: "Select at least one plant." };
  if (Number.isNaN(kgco2e_per_tonne)) return { error: "kgCO2e / t is required." };
  if (!valid_from) return { error: "Valid from is required." };
  if (!valid_to_na && !valid_to_raw) {
    return { error: "Valid to is required unless N/A is checked." };
  }

  let plant_ids: string[] = [];
  try {
    plant_ids = JSON.parse(plantIdsRaw);
  } catch {
    return { error: "Invalid plant selection." };
  }

  if (!plant_ids.length) return { error: "Select at least one plant." };

  const supabase = await requireUser();

  let resolvedMixTypeId = mix_type_name ? null : mix_type_id;
  if (!resolvedMixTypeId) {
    if (!mix_type_name) return { error: "Mix type is required." };
    const desiredMixId = mix_type_name.toUpperCase();
    const { data: existingMix } = await supabase
      .from("mix_types")
      .select("id")
      .or(`id.eq.${desiredMixId},name.eq.${mix_type_name}`)
      .limit(1)
      .maybeSingle();

    if (existingMix?.id) {
      resolvedMixTypeId = existingMix.id;
    } else {
      const { data: mixInserted, error: mixError } = await supabase
        .from("mix_types")
        .insert({ id: desiredMixId, name: mix_type_name })
        .select("id")
        .single();

      if (mixError) return { error: mixError.message };
      resolvedMixTypeId = mixInserted.id;
    }
  }

  let resolvedProductId = product_name ? null : product_id;
  if (!resolvedProductId) {
    if (!product_name) return { error: "Product is required." };
    const { data: existingProduct } = await supabase
      .from("products")
      .select("id")
      .eq("name", product_name)
      .limit(1)
      .maybeSingle();

    if (existingProduct?.id) {
      resolvedProductId = existingProduct.id;
    } else {
      const { data: productInserted, error: productError } = await supabase
        .from("products")
        .insert({ name: product_name })
        .select("id")
        .single();

      if (productError) return { error: productError.message };
      resolvedProductId = productInserted.id;
    }
  }

  const { data: matches } = await supabase
    .from("plant_mix_carbon_factors")
    .select(
      `
      id,
      plant_id,
      mix_type_id,
      product_id,
      kgco2e_per_tonne,
      valid_from,
      valid_to,
      plants ( name ),
      products ( name )
    `
    )
    .in("plant_id", plant_ids)
    .eq("mix_type_id", resolvedMixTypeId)
    .eq("product_id", resolvedProductId)
    ;

  if (matches && matches.length && mode !== "overwrite") {
    return {
      success: false,
      error: "Matches found.",
      count: matches.length,
      matches,
      proposed: {
        kgco2e_per_tonne,
        valid_from,
        valid_to,
        mix_type_id: resolvedMixTypeId,
        product_id: resolvedProductId,
        a1_includes_raw_materials,
      },
    } as ActionState;
  }

  if (mode === "overwrite") {
    if (!overwriteIdsRaw) return { error: "No rows selected to overwrite." };
    let overwriteIds: string[] = [];
    try {
      overwriteIds = JSON.parse(overwriteIdsRaw);
    } catch {
      return { error: "Invalid overwrite selection." };
    }
    if (!overwriteIds.length) return { error: "Select at least one row to overwrite." };

    const { error: updateError } = await supabase
      .from("plant_mix_carbon_factors")
      .update({
        kgco2e_per_tonne,
        valid_from,
        valid_to,
        a1_includes_raw_materials,
      })
      .in("id", overwriteIds);

    if (updateError) return { error: updateError.message };

    revalidatePath("/admin");
    return { success: true, count: overwriteIds.length };
  }

  const records = plant_ids.map((plant_id) => ({
    plant_id,
    mix_type_id: resolvedMixTypeId,
    product_id: resolvedProductId,
    kgco2e_per_tonne,
    valid_from,
    valid_to,
    a1_includes_raw_materials,
  }));

  const { error } = await supabase.from("plant_mix_carbon_factors").insert(records);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true, count: records.length };
}

export async function createInstallationSetup(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const plant_name = (formData.get("plant_name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim();
  const toNumberOrZero = (value: FormDataEntryValue | null) => {
    if (value === null) return 0;
    const trimmed = String(value).trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const spread_rate_t_per_m2 = toNumberOrZero(formData.get("spread_rate_t_per_m2"));
  const kgco2_per_t = toNumberOrZero(formData.get("kgco2_per_t"));
  const kgco2_per_ltr = toNumberOrZero(formData.get("kgco2_per_ltr"));
  const kgco2e = toNumberOrZero(formData.get("kgco2e"));
  const kmUnitRaw = (formData.get("kgco2e_unit") as string | null) ?? "km";
  const kgco2e_unit = kmUnitRaw.toLowerCase() === "mi" ? "mi" : "km";
  const kgco2eRaw = toNumberOrZero(formData.get("kgco2e_per_km"));
  const kgco2e_per_km = kgco2e_unit === "mi" ? kgco2eRaw / MILES_TO_KM : kgco2eRaw;
  const litres_per_t = toNumberOrZero(formData.get("litres_per_t"));
  const one_way = false;
  const is_default = formData.get("is_default") === "on";

  if (!plant_name) {
    return { error: "Plant name is required." };
  }

  if (!category) {
    return { error: "Category is required." };
  }

  const supabase = await requireUser();
  if (is_default && (category ?? "").toLowerCase() === "fuel") {
    await supabase
      .from("installation_setups")
      .update({ is_default: false })
      .ilike("category", "fuel")
      .eq("is_default", true);
  }
  const { error } = await supabase.from("installation_setups").insert({
    plant_name,
    category,
    spread_rate_t_per_m2,
    kgco2_per_t,
    kgco2_per_ltr,
    kgco2e,
    kgco2e_per_km,
    kgco2e_unit,
    litres_per_t,
    litres_na: false,
    one_way,
    is_default,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updateInstallationSetup(formData: FormData): Promise<void> {
  const id = formData.get("id") as string;
  const plant_name = (formData.get("plant_name") as string | null)?.trim();
  const category = (formData.get("category") as string | null)?.trim();
  const toNumberOrZero = (value: FormDataEntryValue | null) => {
    if (value === null) return 0;
    const trimmed = String(value).trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const spread_rate_t_per_m2 = toNumberOrZero(formData.get("spread_rate_t_per_m2"));
  const kgco2_per_t = toNumberOrZero(formData.get("kgco2_per_t"));
  const kgco2_per_ltr = toNumberOrZero(formData.get("kgco2_per_ltr"));
  const kgco2e = toNumberOrZero(formData.get("kgco2e"));
  const kmUnitRaw = (formData.get("kgco2e_unit") as string | null) ?? "km";
  const kgco2e_unit = kmUnitRaw.toLowerCase() === "mi" ? "mi" : "km";
  const kgco2eRaw = toNumberOrZero(formData.get("kgco2e_per_km"));
  const kgco2e_per_km = kgco2e_unit === "mi" ? kgco2eRaw / MILES_TO_KM : kgco2eRaw;
  const litres_per_t = toNumberOrZero(formData.get("litres_per_t"));
  const one_way = false;
  const is_default = formData.get("is_default") === "on";

  if (!id || !plant_name) {
    return;
  }

  if (!category) {
    return;
  }

  const supabase = await requireUser();
  if (is_default && (category ?? "").toLowerCase() === "fuel") {
    await supabase
      .from("installation_setups")
      .update({ is_default: false })
      .ilike("category", "fuel")
      .neq("id", id);
  }
  const { error } = await supabase
    .from("installation_setups")
    .update({
      plant_name,
      category,
      spread_rate_t_per_m2,
      kgco2_per_t,
      kgco2_per_ltr,
      kgco2e,
      kgco2e_per_km,
      kgco2e_unit,
      litres_per_t,
      litres_na: false,
      one_way,
      is_default,
    })
    .eq("id", id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function updateInstallationSetupsBulk(
  formData: FormData
): Promise<ActionState> {
  const payload = formData.get("payload") as string | null;
  if (!payload) {
    return { error: "Missing update payload." };
  }

  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = JSON.parse(payload) as Array<Record<string, unknown>>;
  } catch (error) {
    return { error: "Invalid payload format." };
  }

  if (!Array.isArray(rows) || !rows.length) {
    return { error: "No rows to update." };
  }

  const toNumberOrZero = (value: unknown) => {
    if (value === null || value === undefined) return 0;
    const trimmed = String(value).trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const sanitized = rows
    .map((row) => {
      const id = String(row.id ?? "").trim();
      const plant_name = String(row.plant_name ?? "").trim();
      const category = String(row.category ?? "").trim();
      if (!id || !plant_name || !category) {
        return null;
      }
      const unitRaw = String(row.kgco2e_unit ?? "km").trim().toLowerCase();
      const kgco2e_unit = unitRaw === "mi" ? "mi" : "km";
      const kgco2eRaw = toNumberOrZero(row.kgco2e_per_km);
      return {
        id,
        plant_name,
        category,
        spread_rate_t_per_m2: toNumberOrZero(row.spread_rate_t_per_m2),
        kgco2_per_t: toNumberOrZero(row.kgco2_per_t),
        kgco2_per_ltr: toNumberOrZero(row.kgco2_per_ltr),
        kgco2e: toNumberOrZero(row.kgco2e),
        kgco2e_per_km: kgco2e_unit === "mi" ? kgco2eRaw / MILES_TO_KM : kgco2eRaw,
        kgco2e_unit,
        litres_per_t: toNumberOrZero(row.litres_per_t),
        litres_na: false,
        one_way: false,
        is_default: Boolean(row.is_default),
      };
    })
    .filter(Boolean) as Array<{
    id: string;
    plant_name: string;
    category: string;
    spread_rate_t_per_m2: number;
    kgco2_per_t: number;
    kgco2_per_ltr: number;
    kgco2e: number;
    kgco2e_per_km: number;
    kgco2e_unit: string;
    litres_per_t: number;
    litres_na: boolean;
    one_way: boolean;
    is_default: boolean;
  }>;

  if (!sanitized.length) {
    return { error: "No valid rows to update." };
  }

  const supabase = await requireUser();

  const fuelDefaults = sanitized.filter(
    (row) => row.is_default && row.category.toLowerCase() === "fuel"
  );

  if (fuelDefaults.length) {
    const keepId = fuelDefaults[fuelDefaults.length - 1].id;
    sanitized.forEach((row) => {
      if (
        row.category.toLowerCase() === "fuel" &&
        row.id !== keepId &&
        row.is_default
      ) {
        row.is_default = false;
      }
    });

    await supabase
      .from("installation_setups")
      .update({ is_default: false })
      .ilike("category", "fuel")
      .neq("id", keepId);
  }

  for (const row of sanitized) {
    const { error } = await supabase
      .from("installation_setups")
      .update({
        plant_name: row.plant_name,
        category: row.category,
        spread_rate_t_per_m2: row.spread_rate_t_per_m2,
        kgco2_per_t: row.kgco2_per_t,
        kgco2_per_ltr: row.kgco2_per_ltr,
        kgco2e: row.kgco2e,
        kgco2e_per_km: row.kgco2e_per_km,
        kgco2e_unit: row.kgco2e_unit,
        litres_per_t: row.litres_per_t,
        litres_na: row.litres_na,
        one_way: row.one_way,
        is_default: row.is_default,
      })
      .eq("id", row.id);

    if (error) {
      return { error: error.message };
    }
  }

  revalidatePath("/admin");
  return { success: true };
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });

  return { headers, rows };
}

export async function uploadInstallationSetups(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "Please attach a CSV file." };

  const text = await file.text();
  const { rows } = parseCsv(text);

  if (!rows.length) {
    return { error: "CSV file is empty." };
  }

  const records = rows.map((row) => {
    const plant_name = row.plant_name?.trim();
    const category = row.category?.trim();
    const toNumberOrZero = (value?: string) => {
      if (!value) return 0;
      const trimmed = value.trim();
      if (!trimmed) return 0;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? 0 : parsed;
    };
    const spread_rate_t_per_m2 = toNumberOrZero(row.spread_rate_t_per_m2);
    const kgco2_per_t = toNumberOrZero(row.kgco2_per_t);
    const kgco2_per_ltr = toNumberOrZero(row.kgco2_per_ltr);
    const kgco2e = toNumberOrZero(row.kgco2e);
    const unitRaw = String(row.kgco2e_unit ?? "km").trim().toLowerCase();
    const kgco2e_unit = unitRaw === "mi" ? "mi" : "km";
    const kgco2eRaw = toNumberOrZero(row.kgco2e_per_km);
    const kgco2e_per_km = kgco2e_unit === "mi" ? kgco2eRaw / MILES_TO_KM : kgco2eRaw;
    const litres_per_t = toNumberOrZero(row.litres_per_t);
    const one_way = false;
    const is_default =
      String(row.is_default ?? "")
        .trim()
        .toLowerCase() === "true" ||
      String(row.is_default ?? "")
        .trim()
        .toLowerCase() === "yes" ||
      String(row.is_default ?? "")
        .trim() === "1";

    if (!plant_name) {
      throw new Error("Missing plant_name in CSV.");
    }

    if (!category) {
      throw new Error("Missing category in CSV.");
    }

    return {
      plant_name,
      category,
      spread_rate_t_per_m2,
      kgco2_per_t,
      kgco2_per_ltr,
      kgco2e,
      kgco2e_per_km,
      kgco2e_unit,
      litres_per_t,
      litres_na: false,
      one_way,
      is_default,
    };
  });

  const supabase = await requireUser();
  const { error } = await supabase.from("installation_setups").insert(records);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true, count: records.length };
}

export async function deleteInstallationSetup(
  formData: FormData
): Promise<ActionState> {
  const id = formData.get("id") as string;
  if (!id) return { error: "Missing id." };

  const supabase = await requireUser();
  const { error } = await supabase.from("installation_setups").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function uploadPlants(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "Please attach a CSV file." };

  const text = await file.text();
  const { rows } = parseCsv(text);

  if (!rows.length) {
    return { error: "CSV file is empty." };
  }

  const records = rows.map((row) => {
    const name = row.name?.trim();
    const location = row.location?.trim() || null;
    const description = row.description?.trim() || null;
    const is_default =
      String(row.is_default ?? "")
        .trim()
        .toLowerCase() === "true" ||
      String(row.is_default ?? "")
        .trim()
        .toLowerCase() === "yes" ||
      String(row.is_default ?? "")
        .trim() === "1";

    if (!name) {
      throw new Error("Missing name in CSV.");
    }

    return { name, location, description, is_default };
  });

  const supabase = await requireUser();
  const { error } = await supabase.from("plants").insert(records);

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true, count: records.length };
}

export async function uploadMaterialMappings(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const file = formData.get("file") as File | null;
  if (!file) return { error: "Please attach a CSV file." };

  const text = await file.text();
  const { rows } = parseCsv(text);

  if (!rows.length) {
    return { error: "CSV file is empty." };
  }

  const supabase = await requireUser();

  const { data: plants, error: plantsError } = await supabase
    .from("plants")
    .select("id, name");
  if (plantsError) return { error: plantsError.message };

  const { data: mixTypes, error: mixError } = await supabase
    .from("mix_types")
    .select("id, name");
  if (mixError) return { error: mixError.message };

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name");
  if (productsError) return { error: productsError.message };

  const plantByName = new Map(
    (plants ?? []).map((plant) => [plant.name.toLowerCase(), plant.id])
  );
  const mixById = new Map((mixTypes ?? []).map((mix) => [mix.id, mix.id]));
  const mixByName = new Map(
    (mixTypes ?? []).map((mix) => [mix.name.toLowerCase(), mix.id])
  );
  const productByName = new Map(
    (products ?? []).map((product) => [product.name.toLowerCase(), product.id])
  );
  const productById = new Set((products ?? []).map((product) => product.id));

  const records = [];

  for (const row of rows) {
    const plant_id = row.plant_id?.trim() || null;
    const plant_name = row.plant_name?.trim() || null;

    let resolvedPlantId = plant_id;
    if (!resolvedPlantId) {
      if (!plant_name) {
        return { error: "Missing plant_name or plant_id in CSV." };
      }
      resolvedPlantId = plantByName.get(plant_name.toLowerCase()) ?? null;
      if (!resolvedPlantId) {
        return { error: `Unknown plant name: ${plant_name}` };
      }
    }

    const mixValue =
      row.mix_type?.trim() ||
      row.mix_type_id?.trim() ||
      row.mix_type_name?.trim() ||
      "";
    if (!mixValue) return { error: "Missing mix_type in CSV." };

    let resolvedMixId =
      mixById.get(mixValue) ?? mixByName.get(mixValue.toLowerCase()) ?? null;
    if (!resolvedMixId) {
      const desiredMixId = mixValue.toUpperCase();
      const { data: mixInserted, error: createMixError } = await supabase
        .from("mix_types")
        .insert({ id: desiredMixId, name: mixValue })
        .select("id")
        .single();

      if (createMixError) return { error: createMixError.message };
      resolvedMixId = mixInserted.id;
      mixById.set(resolvedMixId, resolvedMixId);
      mixByName.set(mixValue.toLowerCase(), resolvedMixId);
    }

    const product_id = row.product_id?.trim() || null;
    const product_name =
      row.product_name?.trim() || row.product?.trim() || null;

    let resolvedProductId = product_id;
    if (!resolvedProductId) {
      if (!product_name) {
        return { error: "Missing product_name or product_id in CSV." };
      }
      resolvedProductId = productByName.get(product_name.toLowerCase()) ?? null;
      if (!resolvedProductId) {
        const { data: productInserted, error: createProductError } = await supabase
          .from("products")
          .insert({ name: product_name })
          .select("id")
          .single();

        if (createProductError) return { error: createProductError.message };
        resolvedProductId = productInserted.id;
        productByName.set(product_name.toLowerCase(), resolvedProductId);
        productById.add(resolvedProductId);
      }
    } else if (!productById.has(resolvedProductId)) {
      return { error: `Unknown product_id: ${resolvedProductId}` };
    }

    const kgValueRaw = row.kgco2e_per_tonne?.trim() || row.kgco2e?.trim() || "";
    const kgco2e_per_tonne = Number(kgValueRaw);
    if (Number.isNaN(kgco2e_per_tonne)) {
      return { error: "Missing kgco2e_per_tonne in CSV." };
    }

    const valid_from = row.valid_from?.trim() || null;
    if (!valid_from) return { error: "Missing valid_from in CSV." };

    const valid_to = row.valid_to?.trim() || null;
    const source = row.source?.trim() || null;
    const a1_raw_value =
      row.a1_includes_raw_materials ??
      row.a1_includes_raw ??
      row.a1_includes ??
      row.a1_raw_included ??
      "";
    const a1_includes_raw_materials =
      typeof a1_raw_value === "string" &&
      ["true", "yes", "1", "y"].includes(a1_raw_value.trim().toLowerCase());

    records.push({
      plant_id: resolvedPlantId,
      mix_type_id: resolvedMixId,
      product_id: resolvedProductId,
      kgco2e_per_tonne,
      valid_from,
      valid_to,
      source,
      a1_includes_raw_materials,
    });
  }

  const { error } = await supabase
    .from("plant_mix_carbon_factors")
    .upsert(records, { onConflict: "plant_id,mix_type_id,product_id" });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true, count: records.length };
}

export async function uploadReportMetrics(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Please choose a CSV file." };
  }

  const text = await file.text();
  const { rows } = parseCsv(text);
  if (!rows.length) return { error: "No rows found in CSV." };

  const supabase = await requireUser();
  const { data: existing } = await supabase
    .from("report_metrics")
    .select("id, kind, label");

  const existingMap = new Map(
    (existing ?? []).map((row) => [
      `${row.kind}::${row.label.toLowerCase()}`,
      row,
    ])
  );

  const inserts: Array<{
    kind: "equivalency" | "savings";
    label: string;
    unit: string | null;
    value: number | null;
    calc_op: string | null;
    calc_factor: number | null;
    source: string | null;
    source_url: string | null;
    sort_order: number;
    is_active: boolean;
  }> = [];

  const updates: Array<{
    id: string;
    kind: "equivalency" | "savings";
    label: string;
    unit: string | null;
    value: number | null;
    calc_op: string | null;
    calc_factor: number | null;
    source: string | null;
    source_url: string | null;
    sort_order: number;
    is_active: boolean;
  }> = [];

  const parseBool = (value: unknown, fallback = true) => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return fallback;
    return ["true", "yes", "1", "y"].includes(trimmed);
  };

  for (const row of rows) {
    const kindRaw = (row.kind ?? "").toString().trim().toLowerCase();
    if (kindRaw !== "equivalency" && kindRaw !== "savings") {
      return { error: "kind must be equivalency or savings." };
    }
    const label = (row.label ?? "").toString().trim();
    if (!label) return { error: "label is required." };

    const unit = (row.unit ?? "").toString().trim() || null;
    const valueRaw = (row.value ?? "").toString().trim();
    const value = valueRaw ? Number(valueRaw) : null;
    if (valueRaw && Number.isNaN(value)) {
      return { error: `Invalid value for ${label}.` };
    }
    const calc_op = (row.calc_op ?? "").toString().trim() || null;
    const calcFactorRaw = (row.calc_factor ?? "").toString().trim();
    const calc_factor = calcFactorRaw ? Number(calcFactorRaw) : null;
    if (calcFactorRaw && Number.isNaN(calc_factor)) {
      return { error: `Invalid factor for ${label}.` };
    }
    const source = (row.source ?? "").toString().trim() || null;
    const source_url =
      (row.source_url ?? row.url ?? "").toString().trim() || null;
    const sortRaw = (row.sort_order ?? "").toString().trim();
    const sort_order = sortRaw ? Number(sortRaw) : 0;
    const is_active = parseBool(row.is_active, true);

    const key = `${kindRaw}::${label.toLowerCase()}`;
    const existingRow = existingMap.get(key);
    if (existingRow) {
      updates.push({
        id: existingRow.id,
        kind: kindRaw,
        label,
        unit,
        value,
        calc_op,
        calc_factor,
        source,
        source_url,
        sort_order,
        is_active,
      });
    } else {
      inserts.push({
        kind: kindRaw,
        label,
        unit,
        value,
        calc_op,
        calc_factor,
        source,
        source_url,
        sort_order,
        is_active,
      });
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from("report_metrics").insert(inserts);
    if (error) return { error: error.message };
  }

  if (updates.length) {
    const results = await Promise.all(
      updates.map((update) =>
        supabase
          .from("report_metrics")
          .update({
            kind: update.kind,
            label: update.label,
            unit: update.unit,
            value: update.value,
            calc_op: update.calc_op,
            calc_factor: update.calc_factor,
            source: update.source,
            source_url: update.source_url,
            sort_order: update.sort_order,
            is_active: update.is_active,
          })
          .eq("id", update.id)
      )
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) return { error: failed.error.message };
  }

  revalidatePath("/admin");
  return {
    success: true,
    count: inserts.length + updates.length,
    message: `Uploaded ${inserts.length + updates.length} rows.`,
  };
}

export async function createReportMetric(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const kind = (formData.get("kind") as string | null)?.trim() as
    | "equivalency"
    | "savings"
    | null;
  const label = (formData.get("label") as string | null)?.trim();
  const unit = (formData.get("unit") as string | null)?.trim();
  const valueRaw = (formData.get("value") as string | null)?.trim() ?? "";
  const calcOp = (formData.get("calc_op") as string | null)?.trim() || null;
  const calcFactorRaw =
    (formData.get("calc_factor") as string | null)?.trim() ?? "";
  const source = (formData.get("source") as string | null)?.trim();
  const sourceUrl = (formData.get("source_url") as string | null)?.trim();
  const sortRaw = (formData.get("sort_order") as string | null)?.trim() ?? "";
  const is_active = formData.get("is_active") === "on";

  if (!kind || !label) {
    return { error: "Kind and label are required." };
  }

  const value = valueRaw ? Number(valueRaw) : null;
  if (valueRaw && Number.isNaN(value)) {
    return { error: "Value must be a number." };
  }

  const calc_factor = calcFactorRaw ? Number(calcFactorRaw) : null;
  if (calcFactorRaw && Number.isNaN(calc_factor)) {
    return { error: "Factor must be a number." };
  }

  const sort_order = sortRaw ? Number(sortRaw) : 0;

  const supabase = await requireUser();
  const { error } = await supabase.from("report_metrics").insert({
    kind,
    label,
    unit: unit || null,
    value,
    calc_op: calcOp,
    calc_factor,
    source: source || null,
    source_url: sourceUrl || null,
    sort_order,
    is_active,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function updateReportMetric(formData: FormData): Promise<void> {
  const id = formData.get("id") as string | null;
  const kind = (formData.get("kind") as string | null)?.trim() as
    | "equivalency"
    | "savings"
    | null;
  const label = (formData.get("label") as string | null)?.trim();
  const unit = (formData.get("unit") as string | null)?.trim();
  const valueRaw = (formData.get("value") as string | null)?.trim() ?? "";
  const calcOp = (formData.get("calc_op") as string | null)?.trim() || null;
  const calcFactorRaw =
    (formData.get("calc_factor") as string | null)?.trim() ?? "";
  const source = (formData.get("source") as string | null)?.trim();
  const sourceUrl = (formData.get("source_url") as string | null)?.trim();
  const sortRaw = (formData.get("sort_order") as string | null)?.trim() ?? "";
  const is_active = formData.get("is_active") === "on";

  if (!id || !kind || !label) {
    return;
  }

  const value = valueRaw ? Number(valueRaw) : null;
  if (valueRaw && Number.isNaN(value)) {
    return;
  }

  const calc_factor = calcFactorRaw ? Number(calcFactorRaw) : null;
  if (calcFactorRaw && Number.isNaN(calc_factor)) {
    return;
  }

  const sort_order = sortRaw ? Number(sortRaw) : 0;

  const supabase = await requireUser();
  const { error } = await supabase
    .from("report_metrics")
    .update({
      kind,
      label,
      unit: unit || null,
      value,
      calc_op: calcOp,
      calc_factor,
      source: source || null,
      source_url: sourceUrl || null,
      sort_order,
      is_active,
    })
    .eq("id", id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function deleteReportMetric(formData: FormData): Promise<void> {
  const id = formData.get("id") as string | null;
  if (!id) return;

  const supabase = await requireUser();
  const { error } = await supabase.from("report_metrics").delete().eq("id", id);
  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function updateGhgCategory(formData: FormData): Promise<void> {
  const key = formData.get("key") as string | null;
  if (!key) return;

  const is_active = formData.get("is_active") === "on";

  const supabase = await requireUser();
  const { error } = await supabase
    .from("ghg_factor_categories")
    .update({ is_active })
    .eq("key", key);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function updateGhgFactorFilter(formData: FormData): Promise<void> {
  const id = formData.get("id") as string | null;
  if (!id) return;

  const is_active = formData.get("is_active") === "on";

  const supabase = await requireUser();
  const { error } = await supabase
    .from("ghg_factor_filters")
    .update({ is_active })
    .eq("id", id);

  if (error) return;

  revalidatePath("/admin");
  return;
}

export async function setGhgFactorFiltersActive(formData: FormData): Promise<void> {
  const categoryKey = (formData.get("category_key") as string | null)?.trim();
  const value = (formData.get("value") as string | null)?.trim();
  if (!categoryKey) return;

  const is_active = value === "on";

  const supabase = await requireUser();
  const { error } = await supabase
    .from("ghg_factor_filters")
    .update({ is_active })
    .eq("category_key", categoryKey);

  if (error) return;

  revalidatePath("/admin");
  return;
}
