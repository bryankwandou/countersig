"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { WALLETS } from "@/lib/presets";

// Stages: 0 request arrives, 1 challenge to trusted channel, 2 new wallet signs, 3 old wallet countersigns, 4 released.
const STAGE_MS = [1600, 1700, 1700, 1700, 3200];

export function HeroScene() {
  const { t } = useI18n();
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) setStage(4);
  }, []);
  useEffect(() => {
    if (paused || reduced.current) return;
    const id = setTimeout(() => setStage((s) => (s + 1) % 5), STAGE_MS[stage]);
    return () => clearTimeout(id);
  }, [stage, paused]);

  const steps = [t.mail.step1, t.mail.step2, t.mail.step3];
  const released = stage === 4;

  return (
    <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* the incoming email */}
      <div className="sheet relative z-10 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3 border-b border-rule pb-3 text-[13px]">
          <div className="min-w-0">
            <div className="text-graphite">
              {t.mail.from} <span className="text-ink">billing@vendor-ltd.co</span>
            </div>
            <div className="truncate text-graphite">
              Reply-To <span className="font-mono text-[12px] text-blocked line-through decoration-blocked/60">accounts@vendor-ltd-pay.com</span>
            </div>
          </div>
          <span className="shrink-0 font-mono text-[11px] text-graphite">09:42</span>
        </div>
        <p className="mt-3 font-medium">{t.mail.subject}</p>
        <p className="mt-1 text-[14.5px] text-graphite">{t.mail.body}</p>
        <p className="mt-2 break-all rounded-[2px] bg-paper px-2 py-1.5 font-mono text-[12.5px]">{WALLETS.claimed}</p>
        <p className="mt-2 text-[14.5px] text-graphite">{t.mail.urgent}</p>
      </div>

      {/* the agent's countersignature card, tucked under the email */}
      <div className="sheet relative -mt-3 ml-6 p-5 pt-7 sm:ml-12 sm:p-6 sm:pt-8">
        <div className="flex items-center justify-between">
          <span className="eyebrow">{t.mail.note}</span>
          <span
            key={released ? "r" : "h"}
            className="stamp shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-[0.06em]"
            style={{ color: released ? "var(--verified)" : "var(--pending)", borderColor: released ? "var(--verified)" : "var(--pending)" }}
          >
            {released ? t.mail.released : t.mail.held}
          </span>
        </div>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => {
            const done = stage > i;
            const active = stage === i + 1 || (stage === 0 && i === 0);
            return (
              <li key={i} className="flex gap-3 text-[14px]">
                <span
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border font-mono text-[10.5px]"
                  style={{
                    borderColor: done ? (i === 2 ? "var(--seal-bright)" : "var(--ink)") : "var(--rule)",
                    background: done ? (i === 2 ? "var(--seal-bright)" : "var(--ink)") : "transparent",
                    color: done ? "var(--paper)" : "var(--graphite)",
                    transition: "background-color 240ms var(--ease-out), border-color 240ms var(--ease-out)",
                  }}
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className={done || active ? "text-ink" : "text-graphite"} style={{ transition: "color 240ms" }}>{s}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-5 grid grid-cols-2 gap-5">
          {[0, 1].map((i) => {
            const shown = stage >= i + 2;
            return (
              <div key={i}>
                <div className="relative h-10">
                  {shown && (
                    <svg className="absolute bottom-0 left-0" width="130" height="34" viewBox="0 0 130 34" aria-hidden>
                      <path
                        className="ink-draw"
                        style={{ ["--len" as string]: 200 }}
                        d={i === 0 ? "M3 24c7-14 13-18 18-9s8 7 14-3 11-7 15 2 9 5 17-5 10-5 13 3 7 6 14-2 12-8 20-7" : "M3 22c6-10 11-13 14-5 3 7 8-13 16-8 5 3 2 10 9 7 6-3 9-10 16-10 5 0 3 8 9 7s9-7 16-9"}
                        fill="none"
                        stroke={i === 0 ? "var(--ink)" : "var(--seal-bright)"}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>
                <div className="border-t border-ink pt-1.5 font-mono text-[11px] text-graphite">
                  {i === 0 ? `5xqQ...6qJ9` : `66ah...v98 · rotate`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
