import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Investor App",
  description: "Build a beginner-friendly investment plan using real US market data.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <Nav />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-500">
          For education only. Not financial advice. Past performance does not guarantee future results.
        </footer>
      </body>
    </html>
  );
}
