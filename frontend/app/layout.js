import Link from "next/link";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import Logo from "../components/Logo";
import Sidebar, { StaticSidebar } from "../components/Sidebar";
import MobileBar from "../components/MobileBar";
import CoachPanel from "../components/CoachPanel";
import { LayoutMode } from "../lib/layoutMode";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "Seedwise · Investing for beginners",
  description: "Turn your goal into a beginner-friendly investing plan, with real US market data and an AI coach.",
};

// Runs before the page paints, so a saved light theme never flashes dark first.
// Light by default; dark if the person chose it, or (until they choose) if their device is in dark mode.
// Before the first paint: landing page and login use the top menu layout (see lib/layoutMode.js).
const LAYOUT_SCRIPT = `try{var p=location.pathname.replace(/\\/+$/,"")||"/";if(p==="/"||p==="/login")document.documentElement.dataset.layout="marketing"}catch(e){}`;
// Show focus rings only while someone is using the keyboard, never after a mouse click.
const KEYBOARD_SCRIPT = `try{var d=document.documentElement;addEventListener("keydown",function(e){if(e.key==="Tab")d.classList.add("kbd")},true);addEventListener("mousedown",function(){d.classList.remove("kbd")},true)}catch(e){}`;
const THEME_SCRIPT = `try{var t=localStorage.getItem("seedwise-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

const FOOTER_LINKS = [
  ["/plan", "Build my plan"],
  ["/practice", "Practice"],
  ["/coach", "AI Coach"],
  ["/stocks", "Stocks"],
  ["/tools", "Tools"],
  ["/learn", "Learn"],
];

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + LAYOUT_SCRIPT + KEYBOARD_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-ink font-sans text-fg antialiased">
        <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-ink">
          Skip to content
        </a>
        <div className="app-shell">
          {/* App pages: sidebar. The landing page and login hide it and show the top menu instead (see globals.css). */}
          <Suspense fallback={<StaticSidebar />}>
            <Sidebar />
          </Suspense>
          <Suspense fallback={null}>
            <LayoutMode />
          </Suspense>
          <div className="app-main">
            <Nav />
            <MobileBar />
            <main id="content" className="app-content flex-1">{children}</main>
        <footer className="site-footer mt-16 border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-8 px-6 py-10">
            <div className="max-w-sm">
              <Link href="/" className="flex items-center gap-2.5">
                <Logo size={28} />
                <span className="font-display text-lg font-bold">Seedwise</span>
              </Link>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                An educational capstone project. Not financial advice. Past performance does not guarantee future results.
              </p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-sm sm:grid-cols-3">
              {FOOTER_LINKS.map(([href, label]) => (
                <Link key={href} href={href} className="text-muted transition hover:text-fg">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="border-t border-line px-6 py-5 text-center text-xs text-muted">
            Market data from Alpaca and SEC EDGAR · Built with Next.js, FastAPI and Supabase
          </div>
        </footer>
          </div>
        </div>
        <CoachPanel />
      </body>
    </html>
  );
}
