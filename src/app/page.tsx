"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/schemes";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!email.trim()) return false;
    if (mode === "login") return password.trim().length > 0;
    return true;
  }, [email, password, mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setMessage(null);

    if (mode === "login") {
      const { error } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        router.push(redirectPath);
        router.refresh();
      }
    } else {
      const redirectTo = `${window.location.origin}/reset`;
      const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for a reset link.");
      }
    }

    setLoading(false);
  };

  return (
    <main className="login-page">
      <div className="login-bg" aria-hidden="true" />

      <div className="login-shell">
        <div className="login-brand-row">
          <div className="login-brand-left">
            <img
              src="/api/branding/logo"
              alt="Holcim logo"
              className="login-brand-logo"
              onLoad={() => {
                console.info("[login/logo] loaded", { src: "/api/branding/logo" });
              }}
              onError={(event) => {
                console.error("[login/logo] failed to load", {
                  src: event.currentTarget.currentSrc || event.currentTarget.src,
                });
              }}
            />
          </div>
          <h2 className="login-brand-title">Carbon Report Contracting</h2>
        </div>

        <section className="login-panel">
          <span className="login-meta">Carbon Calculator Portal</span>
          <h1>Grounded decisions for low-carbon schemes.</h1>
          <p>
            Centralize product mixes, haulage distances, and plant factors in one
            auditable place. Review every scheme with traceable CO2
            calculations.
          </p>
          <p className="login-meta">
            Need access? Speak with your system administrator to create an
            account.
          </p>
        </section>

        <section className="login-card">
          <div>
            <h2 className="display-text" style={{ margin: 0 }}>
              {mode === "login" ? "Sign in" : "Reset password"}
            </h2>
            <p className="login-meta">
              {mode === "login"
                ? "Use your company credentials to continue."
                : "We'll email you a secure reset link."}
            </p>
          </div>

          <form style={{ display: "grid", gap: 12 }} onSubmit={handleSubmit}>
            <label>
              Email
              <input
                type="email"
                name="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            {mode === "login" ? (
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
            ) : null}
            <div className="login-actions">
              <button className="btn-primary" type="submit" disabled={!canSubmit || loading}>
                {loading ? "Working..." : mode === "login" ? "Sign in" : "Send reset link"}
              </button>
            </div>
          </form>

          <div className="login-meta">
            {message ? <span>{message}</span> : null}
            {!message ? (
              <>
                {mode === "login" ? "Forgot your password? " : "Back to sign in? "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setMessage(null);
                    setMode(mode === "login" ? "reset" : "login");
                  }}
                >
                  {mode === "login" ? "Reset it" : "Sign in"}
                </button>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
