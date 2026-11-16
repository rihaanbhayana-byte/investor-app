import Link from "next/link";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";
import Logo from "../components/Logo";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata = {
  title: "Seedwise · Investing for beginners",
  description: "Turn your goal into a beginner-friendly investing plan, with real US market data and an AI coach.",
};

// Runs before the page paints, so a saved light theme never flashes dark first.
const THEME_SCRIPT = `try{if(localStorage.getItem("seedwise-theme")==="light")document.documentElement.classList.add("light")}catch(e){}`;

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
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-ink font-sans text-fg antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="mt-16 border-t border-line">
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
      </body>
    </html>
  );
}
