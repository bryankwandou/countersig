"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { verify, type Verdict } from "@/lib/countersig";
import { useI18n } from "@/lib/i18n";
import { PRESETS, PRESET_ORDER, presetQuery, type PresetKey } from "@/lib/presets";
import { VerdictSheet } from "./VerdictSheet";

export function LiveCheck() {
  const { t } = useI18n();
  const [key, setKey] = useState<PresetKey>("continuity");
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; v?: Verdict }>({ status: "idle" });
  const ctrl = useRef<AbortController | null>(null);

  const run = async (k: PresetKey) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState({ status: "loading" });
    const p = PRESETS[k];
    try {
      const v = await verify({ claimed: p.claimed, prior: p.prior, nonce: p.nonce, issuedAt: Date.parse(p.issuedAt) / 1000, expiresAt: Date.parse(p.expiresAt) / 1000, known: p.known, cluster: "devnet", signal: c.signal });
      if (!c.signal.aborted) setState({ status: "done", v });
    } catch {
      if (!c.signal.aborted) setState({ status: "error" });
    }
  };

  const pick = (k: PresetKey) => {
    setKey(k);
    run(k);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div role="tablist" aria-label={t.demo.eyebrow} className="flex flex-col">
        {PRESET_ORDER.map((k, i) => {
          const [title, desc] = t.demo.cases[k];
          const on = k === key;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={on}
              onClick={() => pick(k)}
              className="group grid grid-cols-[2rem_1fr] gap-x-3 border-t border-rule py-4 text-left last:border-b"
            >
              <span className="font-mono text-[12px] text-graphite num">{String(i + 1).padStart(2, "0")}</span>
              <span>
                <span className={`block font-medium ${on ? "text-ink" : "text-graphite group-hover:text-ink"}`} style={{ transition: "color 120ms" }}>
                  {title}
                  {on && <span className="ml-2 inline-block size-1.5 -translate-y-0.5 rounded-full bg-seal-bright align-middle" aria-hidden />}
                </span>
                <span className="mt-0.5 block text-[14px] text-graphite">{desc}</span>
              </span>
            </button>
          );
        })}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-seal" onClick={() => run(key)} disabled={state.status === "loading"} aria-busy={state.status === "loading"}>
            {state.status === "loading" ? t.demo.running : t.demo.run}
          </button>
          <Link className="btn" href={`/verify?${presetQuery(PRESETS[key])}`}>{t.demo.open}</Link>
        </div>
      </div>

      <div className="min-h-[420px]">
        {state.status === "idle" && (
          <div className="grid h-full min-h-[420px] place-items-center rounded-xl border border-dashed border-rule p-8 text-center text-graphite">
            <div>
              <p className="display text-[30px] text-ink">{t.demo.cases[key][0]}</p>
              <p className="mt-2 font-mono text-[12.5px]">countersig:v1:{PRESETS[key].nonce}</p>
            </div>
          </div>
        )}
        {state.status === "loading" && (
          <div className="sheet h-full min-h-[420px] animate-pulse p-8" aria-busy>
            <div className="h-6 w-44 rounded-full bg-rule" />
            <div className="mt-6 h-10 w-3/4 rounded bg-rule" />
            <div className="mt-3 h-4 w-2/3 rounded bg-rule/70" />
            <div className="mt-10 grid grid-cols-2 gap-6">
              <div className="h-16 border-b border-rule" />
              <div className="h-16 border-b border-rule" />
            </div>
          </div>
        )}
        {state.status === "error" && (
          <div className="sheet grid min-h-[420px] place-items-center p-8 text-center">
            <div>
              <p className="text-graphite">{t.demo.error}</p>
              <button className="btn mt-4" onClick={() => run(key)}>{t.demo.retry}</button>
            </div>
          </div>
        )}
        {state.status === "done" && state.v && <VerdictSheet key={state.v.checkedAt + key} v={state.v} />}
      </div>
    </div>
  );
}
