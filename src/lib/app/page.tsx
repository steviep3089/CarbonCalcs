import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("schemes")
    .select("id, name")
    .limit(5);

  return (
    <main style={{ padding: 24 }}>
      <h1>Supabase connection test</h1>

      {error && (
        <pre style={{ color: "red" }}>
          {JSON.stringify(error, null, 2)}
        </pre>
      )}

      {data && (
        <pre>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </main>
  );
}
