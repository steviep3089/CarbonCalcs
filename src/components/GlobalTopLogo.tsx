"use client";

import { usePathname } from "next/navigation";

export function GlobalTopLogo() {
  const pathname = usePathname();

  if (pathname === "/") {
    return null;
  }

  return (
    <div className="global-top-logo-wrap" aria-hidden="true">
      <img
        src="/branding/holcim.png"
        alt="Holcim logo"
        className="global-top-logo"
      />
    </div>
  );
}
