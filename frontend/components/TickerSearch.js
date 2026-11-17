"use client";

import { useRouter } from "next/navigation";
import SymbolSearch from "@/components/SymbolSearch";

// The big search on the Stocks page: pick any US stock or fund to open its page.
export default function TickerSearch() {
  const router = useRouter();
  return (
    <SymbolSearch
      size="lg"
      label="Search any US stock or fund"
      placeholder="Search any US stock or fund: Netflix, Uber, SPY…"
      onSelect={(item) => router.push(`/stocks/${item.symbol}`)}
    />
  );
}
