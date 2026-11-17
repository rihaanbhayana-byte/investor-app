"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// The landing page and login show the top menu; every other page shows the app sidebar.
// (app/layout.js has the same list in a tiny script that runs before the first paint.)
export const MARKETING_PATHS = ["/", "/login"];

// Keeps it right as the person moves between pages.
export function LayoutMode() {
  const path = usePathname() || "/";
  useEffect(() => {
    const clean = path.replace(/\/+$/, "") || "/";
    if (MARKETING_PATHS.includes(clean)) document.documentElement.dataset.layout = "marketing";
    else delete document.documentElement.dataset.layout;
  }, [path]);
  return null;
}
