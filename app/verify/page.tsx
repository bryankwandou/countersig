"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { VerdictSheet } from "@/components/VerdictSheet";
import { isEvmChain, verify, type Cluster, type Verdict } from "@/lib/countersig";
import { useI18n } from "@/lib/i18n";
import { PRESETS, PRESET_ORDER } from "@/lib/presets";

const toLocal = (unix: number) => {
  const d = new Date(unix * 1000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (s: string) => Math.floor(new Date(s).getTime() / 1000);

function formFromUrl(sp: URLSearchParams | ReturnType<typeof useSearchParams>): Form {
  const now = Math.floor(Date.now() / 1000);
  const e = Number(sp.get("e")) || now + 72 * 3600;
  return {
    claimed: sp.get("a") ?? "",
    prior: sp.get("p") ?? "",
    nonce: sp.get("n") ?? "",
    issued: toLocal(Number(sp.get("i")) || (sp.get("e") ? e - 72 * 3600 : now - 3600)),
    expires: toLocal(e),
    cluster: (sp.get("c") as Cluster) || "devnet",
    known: (sp.get("k") ?? "").split(",").filter(Boolean).join("\n"),
    controlTx: sp.get("ct") ?? "",
    rotationTx: sp.get("rt") ?? "",
  };
}

type Form = { claimed: string; prior: string; nonce: string; issued: string; expires: string; cluster: Cluster; known: string; controlTx: string; rotationTx: string };

function VerifyInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const [f, setF] = useState<Form>(() => formFromUrl(sp));
  const [json, setJson] = useState("");
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; v?: Verdict; msg?: string }>({ status: "idle" });
  const auto = useRef(false);

  const run = async (form: Form) => {
    setState({ status: "loading" });
    try {
      const v = await verify({
        claimed: form.claimed,
        prior: form.prior || null,
        nonce: form.nonce,
        issuedAt: fromLocal(form.issued),
        expiresAt: fromLocal(form.expires),
        cluster: form.cluster,
        known: form.known.split(/[\s,]+/).filter(Boolean),
        controlTx: form.controlTx,
        rotationTx: form.rotationTx,
      });
      setState({ status: "done", v });
    } catch (e) {
      setState({ status: "error", msg: (e as Error).message });
    }
  };

  useEffect(() => {
    if (auto.current || !f.claimed || !f.nonce) return;
    const pending = setTimeout(() => {
      auto.current = true;
      run(f);
    }, 0);
    return () => clearTimeout(pending);
    // Runs once for a shared link; later edits wait for the Verify button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadJson = (text: string) => {
    setJson(text);
    try {
      const c = JSON.parse(text);
      setF((old) => ({
        ...old,
        claimed: c.claimed ?? old.claimed,
        prior: c.prior ?? "",
        nonce: c.nonce ?? old.nonce,
        issued: c.issuedAt ? toLocal(Date.parse(c.issuedAt) / 1000) : old.issued,
        expires: c.expiresAt ? toLocal(Date.parse(c.expiresAt) / 1000) : old.expires,
        cluster: c.cluster ?? old.cluster,
        controlTx: c.controlTx ?? old.controlTx,
        rotationTx: c.rotationTx ?? old.rotationTx,
      }));
    } catch {}
  };

  const preset = (k: (typeof PRESET_ORDER)[number]) => {
    const p = PRESETS[k];
    const next: Form = { claimed: p.claimed, prior: p.prior ?? "", nonce: p.nonce, issued: toLocal(Date.parse(p.issuedAt) / 1000), expires: toLocal(Date.parse(p.expiresAt) / 1000), cluster: "devnet", known: (p.known ?? []).join("\n"), controlTx: "", rotationTx: "" };
    setF(next);
    run(next);
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <h1 className="display text-[46px] sm:text-[58px]">{t.verify.title}</h1>
        <p className="mt-4 text-graphite">{t.verify.lede}</p>

        <form
          className="mt-10 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(f);
          }}
        >
          <Field id="claimed" label={t.verify.claimed}>
            <input id="claimed" className="field" required autoComplete="off" spellCheck={false} value={f.claimed} onChange={set("claimed")} placeholder="5xqQ...6qJ9" />
          </Field>
          <Field id="prior" label={t.verify.prior} hint={t.verify.priorHint}>
            <input id="prior" className="field" autoComplete="off" spellCheck={false} value={f.prior} onChange={set("prior")} />
          </Field>
          <div className="grid grid-cols-[1fr_10rem] gap-3">
            <Field id="nonce" label={t.verify.nonce}>
              <input id="nonce" className="field uppercase" required autoComplete="off" spellCheck={false} value={f.nonce} onChange={set("nonce")} placeholder="TABY-3FV4-SDY5-12PW" />
            </Field>
            <Field id="cluster" label={t.verify.cluster}>
              <select id="cluster" className="field" value={f.cluster} onChange={set("cluster")}>
                <option value="devnet">devnet</option>
                <option value="testnet">testnet</option>
                <option value="mainnet-beta">mainnet-beta</option>
                <option value="base-sepolia">base-sepolia</option>
                <option value="base">base</option>
              </select>
            </Field>
          </div>
          {isEvmChain(f.cluster) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="controlTx" label={t.verify.controlTx} hint={t.verify.txHint}>
                <input id="controlTx" className="field" required autoComplete="off" spellCheck={false} value={f.controlTx} onChange={set("controlTx")} placeholder="0x..." pattern="0x[0-9a-fA-F]{64}" />
              </Field>
              {f.prior && (
                <Field id="rotationTx" label={t.verify.rotationTx}>
                  <input id="rotationTx" className="field" autoComplete="off" spellCheck={false} value={f.rotationTx} onChange={set("rotationTx")} placeholder="0x..." pattern="0x[0-9a-fA-F]{64}" />
                </Field>
              )}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="issued" label={t.verify.issued}>
              <input id="issued" type="datetime-local" className="field" required value={f.issued} onChange={set("issued")} />
            </Field>
            <Field id="expires" label={t.verify.expires}>
              <input id="expires" type="datetime-local" className="field" required value={f.expires} onChange={set("expires")} />
            </Field>
          </div>
          <Field id="known" label={t.verify.known}>
            <textarea id="known" rows={2} className="field" spellCheck={false} value={f.known} onChange={set("known")} />
          </Field>
          <details className="border-t border-rule pt-4">
            <summary className="cursor-pointer text-[14px] text-graphite hover:text-ink">{t.verify.json}</summary>
            <textarea aria-label={t.verify.json} rows={5} className="field mt-3" spellCheck={false} value={json} onChange={(e) => loadJson(e.target.value)} placeholder='{"type":"countersig.challenge", ...}' />
          </details>
          <button className="btn btn-seal w-full" disabled={state.status === "loading"} aria-busy={state.status === "loading"}>
            {state.status === "loading" ? "..." : t.verify.submit}
          </button>
        </form>

        <div className="mt-8">
          <p className="eyebrow">{t.verify.presets}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESET_ORDER.map((k) => (
              <button key={k} onClick={() => preset(k)} className="min-h-10 rounded-full border border-rule px-3 text-[13px] text-graphite hover:border-ink hover:text-ink">
                {t.demo.cases[k][0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="lg:col-span-7 lg:pt-4">
        <div className="lg:sticky lg:top-24">
          {state.status === "idle" && <div className="grid min-h-[460px] place-items-center rounded-xl border border-dashed border-rule p-8 text-center text-graphite">{t.verify.empty}</div>}
          {state.status === "loading" && (
            <div className="sheet min-h-[460px] animate-pulse p-8" aria-busy>
              <div className="h-6 w-44 rounded-full bg-rule" />
              <div className="mt-6 h-10 w-3/4 rounded bg-rule" />
              <div className="mt-3 h-4 w-2/3 rounded bg-rule/70" />
            </div>
          )}
          {state.status === "error" && (
            <div className="sheet grid min-h-[460px] place-items-center p-8 text-center">
              <div>
                <p className="text-graphite">{t.demo.error}</p>
                <p className="mt-2 font-mono text-[12px] text-blocked">{state.msg}</p>
                <button className="btn mt-4" onClick={() => run(f)}>{t.demo.retry}</button>
              </div>
            </div>
          )}
          {state.status === "done" && state.v && <VerdictSheet key={state.v.checkedAt} v={state.v} />}
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[12.5px] text-graphite">{hint}</p>}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyInner />
    </Suspense>
  );
}
