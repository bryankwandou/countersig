"use client";

import { CopyCommand } from "@/components/CopyCommand";
import { HeroScene } from "@/components/HeroScene";
import { LiveCheck } from "@/components/LiveCheck";
import { useI18n } from "@/lib/i18n";

function Section({ id, eyebrow, title, lede, children }: { id: string; eyebrow: string; title: string; lede?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-rule">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-6 lg:grid-cols-12">
          <p className="eyebrow lg:col-span-3 lg:pt-3">{eyebrow}</p>
          <div className="lg:col-span-9">
            <h2 className="display max-w-[20ch] text-[40px] sm:text-[56px]">{title}</h2>
            {lede && <p className="mt-5 max-w-[60ch] text-[17px] text-graphite">{lede}</p>}
          </div>
        </div>
        <div className="mt-12 sm:mt-16">{children}</div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useI18n();
  const rungs = [
    { n: "L1", title: t.ladder.r1t, desc: t.ladder.r1d, tag: t.ladder.never, color: "var(--graphite)" },
    { n: "L2", title: t.ladder.r2t, desc: t.ladder.r2d, tag: t.ladder.hold, color: "var(--pending)" },
    { n: "L3", title: t.ladder.r3t, desc: t.ladder.r3d, tag: t.ladder.payable, color: "var(--verified)" },
  ];
  const flow = [
    ["search_emails", t.flow.s1],
    ["send_email", t.flow.s2],
    ["/sign", t.flow.s3],
    ["verify", t.flow.s4],
    ["agent-wallet", t.flow.s5],
  ];

  return (
    <>
      {/* hero */}
      <section className="grain">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:gap-10 lg:pb-28">
          <div className="lg:col-span-7">
            <p className="eyebrow rise">{t.hero.eyebrow}</p>
            <h1 className="display rise mt-6 text-[52px] sm:text-[76px] lg:text-[88px]" style={{ animationDelay: "60ms" }}>
              {t.hero.title1}
              <br />
              <span className="text-graphite">{t.hero.title2} </span>
              <em className="relative whitespace-nowrap text-ink">
                {t.hero.titleEm}
                <svg className="absolute -bottom-2 left-0 w-full" height="14" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden>
                  <path className="ink-draw" style={{ ["--len" as string]: 220, animationDelay: "500ms" }} d="M3 9c30-6 60-8 96-4s64 5 98-3" fill="none" stroke="var(--seal-bright)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </em>
            </h1>
            <p className="rise mt-8 max-w-[54ch] text-[17.5px] text-graphite" style={{ animationDelay: "120ms" }}>{t.hero.lede}</p>
            <div className="rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
              <a href="#demo" className="btn btn-seal">{t.hero.ctaDemo}</a>
              <a href="#install" className="btn">{t.hero.ctaInstall}</a>
            </div>
            <div className="mt-14 flex max-w-md items-start gap-4 border-t border-rule pt-5">
              <span className="display text-[44px] leading-none num">$3.04B</span>
              <p className="text-[13.5px] text-graphite">
                {t.hero.stat}{" "}
                <a className="underline decoration-rule underline-offset-4 hover:text-ink" href="https://www.ic3.gov/AnnualReport/Reports/2025_IC3Report.pdf" target="_blank" rel="noreferrer">
                  {t.hero.statSource}
                </a>
              </p>
            </div>
          </div>
          <div className="lg:col-span-5 lg:pt-6">
            <HeroScene />
          </div>
        </div>
      </section>

      {/* ladder */}
      <Section id="how" eyebrow={t.ladder.eyebrow} title={t.ladder.title} lede={t.ladder.lede}>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-rule bg-rule lg:grid-cols-3">
          {rungs.map((r, i) => (
            <li key={r.n} className="flex flex-col bg-sheet p-7" style={{ paddingTop: `${28 + (2 - i) * 28}px` }}>
              <span className="font-mono text-[12px] text-graphite">{r.n}</span>
              <h3 className="display mt-3 text-[34px]">{r.title}</h3>
              <p className="mt-3 flex-1 text-[15px] text-graphite">{r.desc}</p>
              <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11.5px]" style={{ color: r.color, borderColor: r.color }}>
                <span className="size-1.5 rounded-full" style={{ background: r.color }} aria-hidden />
                {r.tag}
              </span>
            </li>
          ))}
        </ol>
      </Section>

      {/* live */}
      <Section id="demo" eyebrow={t.demo.eyebrow} title={t.demo.title} lede={t.demo.lede}>
        <LiveCheck />
      </Section>

      {/* flow */}
      <Section id="flow" eyebrow={t.flow.eyebrow} title={t.flow.title}>
        <ol className="max-w-4xl">
          {flow.map(([tool, text], i) => (
            <li key={tool} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-rule py-5 sm:grid-cols-[3rem_11rem_1fr]">
              <span className="font-mono text-[12px] text-graphite num">{String(i + 1).padStart(2, "0")}</span>
              <code className={`font-mono text-[13px] ${i === 4 ? "text-seal" : ""}`}>{tool}</code>
              <p className="col-span-2 text-[16px] sm:col-span-1">{text}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* limits */}
      <Section id="limits" eyebrow={t.limits.eyebrow} title={t.limits.title}>
        <ul className="grid max-w-5xl gap-x-12 gap-y-8 sm:grid-cols-2">
          {[t.limits.l1, t.limits.l2, t.limits.l3, t.limits.l4].map((l, i) => (
            <li key={i} className="border-l-2 border-rule pl-5 text-[16.5px]">{l}</li>
          ))}
        </ul>
      </Section>

      {/* install */}
      <Section id="install" eyebrow={t.install.eyebrow} title={t.install.title} lede={t.install.note}>
        <div className="grid max-w-3xl gap-3">
          <CopyCommand command="npx skills add Nudgen-Marketing/mermail-skills --skill mermail-countersig" />
          <CopyCommand command="node scripts/countersig.mjs challenge --claimed <wallet> --prior <wallet> --channel billing@vendor.com" />
          <p className="mt-2 font-mono text-[12.5px] text-verified">{t.install.tests}</p>
        </div>
      </Section>
    </>
  );
}
