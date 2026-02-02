import { AuthGate } from "@/components/AuthGate";
import { CO2SavingsView } from "@/components/CO2SavingsView";
import { CO2SavingsTitleValue } from "@/components/CO2SavingsTitleValue";
import { BackButton } from "@/components/BackButton";
import { createSupabaseServerClient } from "@/lib/supabase-server";

type PageProps = {
  searchParams?: Promise<{ t?: string }>;
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

export default async function CO2SavingsPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const hasQuery = Boolean(params.t);
  const parseTonnes = (value?: string) => {
    if (!value) return 0;
    const normalized = value.replace(/,/g, "").replace(/[^0-9.-]/g, "");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const initialTonnes = parseTonnes(params.t);

  const supabase = await createSupabaseServerClient();
  const { data: equivalencies } = await supabase
    .from("report_metrics")
    .select("id, label, unit, value, source, calc_op, calc_factor")
    .eq("kind", "equivalency")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: savings } = await supabase
    .from("report_metrics")
    .select("id, label, unit, value, source")
    .eq("kind", "savings")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const { data: layouts } = await supabase
    .from("report_equivalency_layouts")
    .select("key, x, y, scale");

  return (
    <AuthGate>
      <main className="admin-page reports-page">
        <header className="admin-header">
          <div className="admin-header-row">
            <div>
              <p className="scheme-kicker">Reports</p>
              <div className="reports-title-row">
                <h1>CO2 Savings</h1>
                <CO2SavingsTitleValue
                  initialTonnes={Number.isFinite(initialTonnes) ? initialTonnes : 0}
                  hasQuery={hasQuery}
                />
              </div>
              <p className="schemes-subtitle">
                Visualise environmental savings and equivalency metrics.
              </p>
            </div>
            <div className="admin-header-actions">
              <BackButton label="Back to comparison" />
              <a className="btn-secondary" href="/admin?tab=reports">
                Edit metrics
              </a>
            </div>
          </div>
        </header>

        <CO2SavingsView
          initialTonnes={Number.isFinite(initialTonnes) ? initialTonnes : 0}
          hasQuery={hasQuery}
          equivalencies={(equivalencies ?? []) as ReportMetric[]}
          savings={(savings ?? []) as ReportMetric[]}
          layouts={(layouts ?? []) as ReportLayout[]}
        />
      </main>
    </AuthGate>
  );
}
