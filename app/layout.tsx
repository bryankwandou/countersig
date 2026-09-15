import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { Footer, Header } from "@/components/Chrome";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrument = Instrument_Serif({ variable: "--font-instrument", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Countersig · Wallet proof before an agent pays",
  description: "A Mermail Agent Skill that makes a new Solana payout wallet sign, and the old wallet countersign, before any payment.",
  icons: { icon: "/brand/favicon.svg" },
};

const themeBoot = `try{var s=localStorage.getItem("cs-theme");var d=s?s==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable} ${instrument.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body className="min-h-dvh">
        <I18nProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
