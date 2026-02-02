"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return password.length >= 8 && password === confirm;
  }, [password, confirm]);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setMessage("Missing or invalid reset link.");
      setReady(true);
      return;
    }

    supabaseBrowser.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setMessage(error.message);
      }
      setReady(true);
    });
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setMessage(null);

    const { error } = await supabaseBrowser.auth.updateUser({ password });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Password updated. Redirecting...");
      setTimeout(() => router.push("/"), 1200);
    }

    setLoading(false);
  };

  return (
    <main className="login-page">
      <div className="login-bg" aria-hidden="true" />
      <div className="login-shell">
        <section className="login-card">
          <div>
            <h2 className="display-text" style={{ margin: 0 }}>
              Set a new password
            </h2>
            <p className="login-meta">
              Choose a strong password (8+ characters).
            </p>
          </div>

          {!ready ? (
            <p className="login-meta">Verifying reset link…</p>
          ) : (
            <form style={{ display: "grid", gap: 12 }} onSubmit={handleSubmit}>
              <label>
                New password
                <input
                  type="password"
                  name="password"
                  placeholder="********"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              <label>
                Confirm password
                <input
                  type="password"
                  name="confirm"
                  placeholder="********"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
              </label>
              <div className="login-actions">
                <button
                  className="btn-primary"
                  type="submit"
                  disabled={!canSubmit || loading}
                >
                  {loading ? "Saving..." : "Update password"}
                </button>
              </div>
            </form>
          )}

          <div className="login-meta">{message ? message : null}</div>
        </section>
      </div>
    </main>
  );
}
