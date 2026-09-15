"use client";

import Link from "next/link";
import { useEffect } from "react";
import { createPref } from "@/lib/pref";
import { Mark } from "./Mark";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";

export const REPO = "https://github.com/Nudgen-Marketing/mermail-skills";

type Theme = "light" | "dark";
const themePref = createPref<Theme>(
  "cs-theme",
  () => (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
  (v): v is Theme => v === "light" || v === "dark",
);

export function Header() {
  const { t, locale, setLocale } = useI18n();
  const theme = themePref.use();
  const dark = theme === "dark";
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () => themePref.set(dark ? "light" : "dark");
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
