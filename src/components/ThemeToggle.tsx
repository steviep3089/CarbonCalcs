"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const THEMES = ["dark", "mid", "light"] as const;
type Theme = (typeof THEMES)[number];

const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
    document.cookie = `theme=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    // ignore storage errors
  }
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as Theme | null;
      if (stored && THEMES.includes(stored)) {
        setTheme(stored);
        applyTheme(stored);
        return;
      }
      const cookieMatch = document.cookie.match(/(?:^|; )theme=([^;]+)/);
      const cookieTheme = cookieMatch
        ? (decodeURIComponent(cookieMatch[1]) as Theme)
        : null;
      if (cookieTheme && THEMES.includes(cookieTheme)) {
        setTheme(cookieTheme);
        applyTheme(cookieTheme);
        return;
      }
    } catch {
      // ignore storage errors
    }
    applyTheme("dark");
  }, []);

  return (
    <div className="mode-toggle theme-toggle" aria-label="Theme selector">
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          className={`mode-toggle-button ${theme === option ? "is-active" : ""}`}
          onClick={() => {
            setTheme(option);
            applyTheme(option);
            supabaseBrowser.auth.updateUser({ data: { theme: option } });
          }}
        >
          {option === "mid" ? "Mid" : option[0].toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}
