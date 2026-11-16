import { Suspense } from "react";

export default function StockLayout({ children }) {
  return <Suspense fallback={<p className="text-slate-600">Loading...</p>}>{children}</Suspense>;
}
