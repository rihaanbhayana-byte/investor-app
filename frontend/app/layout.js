import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Nav from "../components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });

export const metadata = {
  title: "Seedwise · Investing for beginners",
  description: "Turn your goal into a beginner-friendly investing plan, with real US market data and an AI coach.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="min-h-screen bg-ink font-sans text-fg antialiased">
        <Nav />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="border-t border-line px-6 py-8 text-center text-sm text-muted">
          Seedwise is an educational capstone project. Not financial advice. Past performance does not guarantee future results.
        </footer>
      </body>
    </html>
  );
}