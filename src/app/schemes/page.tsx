import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AuthGate } from "@/components/AuthGate";
import { SignOutButton } from "@/components/SignOutButton";
import { CreateSchemeCard } from "@/components/CreateSchemeCard";
import { createScheme } from "./actions";
import { SchemesTable } from "@/components/SchemesTable";

export default async function SchemesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: schemes, error } = await supabase
    .from("schemes")
    .select(`
      id,
      name,
      created_at,
      area_m2,
      is_locked
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="schemes-page">
        <h1>Schemes</h1>
        <pre style={{ color: "#ff9b9b" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  const getJoinName = (
    value: { name: string | null } | { name: string | null }[] | null | undefined
  ) => (Array.isArray(value) ? value[0]?.name ?? null : value?.name ?? null);

  const schemeIds = (schemes ?? []).map((scheme) => scheme.id);
  const summaryMap = new Map<
    string,
    { total_kgco2e: number | null; kgco2e_per_tonne: number | null; created_at?: string | null }
  >();
  if (schemeIds.length) {
    const { data: summaries } = await supabase
      .from("scheme_carbon_summaries")
      .select("scheme_id, total_kgco2e, kgco2e_per_tonne, created_at")
      .in("scheme_id", schemeIds);

    summaries?.forEach((row) => {
      const current = summaryMap.get(row.scheme_id);
      if (!current) {
        summaryMap.set(row.scheme_id, row);
        return;
      }
      if (row.created_at && current.created_at) {
        if (row.created_at > current.created_at) {
          summaryMap.set(row.scheme_id, row);
        }
      }
    });
  }
  let materialSummaries = new Map<
    string,
    { label: string; tonnage: number }[]
  >();

  if (schemeIds.length) {
    const { data: schemeMaterials } = await supabase
      .from("scheme_products")
      .select(
        `
        scheme_id,
        tonnage,
        products ( name ),
        mix_types ( name ),
        plants ( name )
      `
      )
      .in("scheme_id", schemeIds);

    if (schemeMaterials) {
      const summaryMap = new Map<string, { label: string; tonnage: number }>();
      schemeMaterials.forEach((row) => {
        const plantName = getJoinName(row.plants) ?? "Plant";
        const mixName = getJoinName(row.mix_types) ?? "Mix";
        const productName = getJoinName(row.products) ?? "Product";
        const label = `${plantName} - ${mixName} - ${productName}`;
        const key = `${row.scheme_id}::${label}`;
        const prev = summaryMap.get(key);
        const tonnage = Number(row.tonnage ?? 0);
        if (prev) {
          prev.tonnage += tonnage;
        } else {
          summaryMap.set(key, { label, tonnage });
        }
      });

      summaryMap.forEach((value, key) => {
        const [schemeId] = key.split("::");
        const list = materialSummaries.get(schemeId) ?? [];
        list.push(value);
        materialSummaries.set(schemeId, list);
      });

      materialSummaries.forEach((list, schemeId) => {
        list.sort((a, b) => b.tonnage - a.tonnage);
        materialSummaries.set(schemeId, list);
      });
    }
  }

  const schemesWithSummaries = (schemes ?? []).map((scheme) => {
    const summary = summaryMap.get(scheme.id);
    return {
      ...scheme,
      total_kgco2e: summary?.total_kgco2e ?? null,
      kgco2e_per_tonne: summary?.kgco2e_per_tonne ?? null,
      materialSummaries: materialSummaries.get(scheme.id) ?? [],
    };
  });

  return (
    <AuthGate>
      <main className="schemes-page">
      <header className="schemes-header">
        <div>
          <h1>Schemes</h1>
          <p className="schemes-subtitle">
            Review embodied carbon totals and drill into each scheme.
          </p>
        </div>
        <div className="schemes-actions">
          <Link className="btn-secondary" href="/admin">
            Admin
          </Link>
          <Link className="btn-secondary" href="/">
            Back to login
          </Link>
          <SignOutButton className="btn-secondary" />
        </div>
      </header>

      <section className="schemes-card">
        <SchemesTable schemes={schemesWithSummaries} />
      </section>

      <CreateSchemeCard action={createScheme} />
      </main>
    </AuthGate>
  );
}
