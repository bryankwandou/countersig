"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mark } from "./Mark";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";

export const REPO = "https://github.com/Nudgen-Marketing/mermail-skills";

export function Header() {
  const { t, locale, setLocale } = useI18n();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("cs-theme");
    } catch {}
    const d = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
  }, []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.dataset.theme = d ? "dark" : "light";
    try {
      localStorage.setItem("cs-theme", d ? "dark" : "light");
    } catch {}
  };
  return (
    <header className="sticky top-0 z-40 border-b border-rule/70 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark size={26} />
          <span className="display text-[23px] leading-none">Countersig</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-[14px] text-graphite md:flex">
          <Link href="/#how" className="hover:text-ink">{t.nav.how}</Link>
          <Link href="/#demo" className="hover:text-ink">{t.nav.demo}</Link>
          <Link href="/#limits" className="hover:text-ink">{t.nav.limits}</Link>
          <Link href="/proof" className="hover:text-ink">Proof</Link>
          <Link href="/verify" className="hover:text-ink">{t.nav.verify}</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <label className="sr-only" htmlFor="locale">{t.common.language}</label>
          <select
            id="locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="h-10 cursor-pointer rounded-md border border-rule bg-transparent px-2 font-mono text-[12px] uppercase text-ink"
          >
            {Object.entries(LOCALES).map(([k, name]) => (
              <option key={k} value={k} className="bg-sheet normal-case">{name}</option>
            ))}
          </select>
          <button onClick={toggle} className="grid size-10 place-items-center rounded-md border border-rule hover:border-ink" aria-label={t.common.theme}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-10 text-[14px] text-graphite sm:px-8">
        <span className="flex items-center gap-2 text-ink">
          <Mark size={20} /> <span className="display text-[19px]">Countersig</span>
        </span>
        <span>{t.footer.built}</span>
        <a className="hover:text-ink" href={REPO} target="_blank" rel="noreferrer">{t.footer.source}</a>
        <Link className="hover:text-ink" href="/verify">{t.nav.verify}</Link>
        <span className="ml-auto font-mono text-[12px]">countersig:v1</span>
      </div>
    </footer>
  );
}
