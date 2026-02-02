"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";

type SignOutButtonProps = {
  className?: string;
  label?: string;
};

export function SignOutButton({ className, label = "Sign out" }: SignOutButtonProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabaseBrowser.auth.signOut();
    router.replace("/");
    router.refresh();
  };

  return (
    <button type="button" className={className} onClick={handleSignOut}>
      {label}
    </button>
  );
}
