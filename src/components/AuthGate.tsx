"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type AuthGateProps = {
  children: ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data, error } = await supabaseBrowser.auth.getSession();
      if (!isMounted) return;

      if (error || !data.session) {
        router.replace(`/?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        const { data: userData } = await supabaseBrowser.auth.getUser();
        const theme = userData?.user?.user_metadata?.theme;
        if (theme === "dark" || theme === "mid" || theme === "light") {
          document.documentElement.dataset.theme = theme;
          localStorage.setItem("theme", theme);
          document.cookie = `theme=${encodeURIComponent(theme)}; path=/; max-age=31536000; samesite=lax`;
        }
      } catch {
        // ignore theme sync errors
      }

      setReady(true);
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [router, pathname]);

  if (!ready) {
    return null;
  }

  return <>{children}</>;
}
