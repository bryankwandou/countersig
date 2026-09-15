"use client";

import { explorerAddress, formatNonce, shortAddress, type Evidence, type Verdict } from "@/lib/countersig";
import { useI18n } from "@/lib/i18n";

const TONE: Record<string, string> = {
  VERIFIED_CONTINUITY: "var(--verified)",
  VERIFIED_CHANNEL: "var(--pending)",
  PENDING: "var(--pending)",
  EXPIRED: "var(--blocked)",
  MISMATCH: "var(--blocked)",
  LOOKALIKE: "var(--blocked)",
  UNCHANGED: "var(--graphite)",
  INVALID_ADDRESS: "var(--blocked)",
  INVALID_INPUT: "var(--blocked)",
};

function SignatureLine({ label, ev, state, color }: { label: string; ev: Evidence | null; state: string; color: string }) {
  return (
    <div className="min-w-0">
      <div className="relative h-12">
        {ev && (
          <svg className="absolute bottom-1 left-0" width="150" height="36" viewBox="0 0 150 36" aria-hidden>
            <path
              className="ink-draw"
              style={{ ["--len" as string]: 220 }}
              d="M4 26c8-16 16-20 21-10s9 8 16-4 13-8 18 2 11 6 20-6 12-6 15 3 8 7 16-2 14-9 24-8"
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <div className="border-t border-ink pt-2">
        <div className="text-[13px] font-medium">{label}</div>
        {ev ? (
          <a href={ev.explorer} target="_blank" rel="noreferrer" className="font-mono text-[12px] text-graphite underline decoration-rule underline-offset-4 hover:text-ink">
            {shortAddress(ev.signature, 6)} · slot <span className="num">{ev.slot.toLocaleString("en-US")}</span>
          </a>
        ) : (
          <div className="font-mono text-[12px] text-graphite">{state}</div>
        )}
      </div>
    </div>
  );
}

export function VerdictSheet({ v }: { v: Verdict }) {
  const { t } = useI18n();
  const [head, body] = t.verdict[v.verdict];
  const tone = TONE[v.verdict];
  const hasRotation = v.verdict === "MISMATCH" || Boolean(v.prior);
  return (
    <article className="sheet rise relative overflow-hidden p-6 sm:p-8" aria-live="polite">
      {v.verdict === "VERIFIED_CONTINUITY" && (
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72" style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--seal-bright) 16%, transparent), transparent)" }} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="stamp inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11.5px] tracking-[0.08em]" style={{ color: tone, borderColor: tone }}>
          <span className="size-1.5 rounded-full" style={{ background: tone }} aria-hidden />
          {v.verdict.replace(/_/g, " ")}
        </span>
        <span className="font-mono text-[12px] text-graphite">
          {v.cluster} · {v.payable ? t.verdict.payable : t.verdict.notPayable}
        </span>
      </div>
      <h3 className="display mt-5 text-[34px] sm:text-[40px]">{head}</h3>
      <p className="mt-2 max-w-[52ch] text-graphite">{body}</p>

      <dl className="mt-6 grid gap-x-6 gap-y-3 font-mono text-[12.5px] sm:grid-cols-[auto_1fr]">
        <dt className="text-graphite">wallet</dt>
        <dd className="min-w-0 break-all">
          <a href={explorerAddress(v.claimed, v.cluster)} target="_blank" rel="noreferrer" className="hover:text-seal">{v.claimed}</a>
        </dd>
        {v.prior && (
          <>
            <dt className="text-graphite">prior</dt>
            <dd className="min-w-0 break-all">{v.prior}</dd>
          </>
        )}
        <dt className="text-graphite">nonce</dt>
        <dd>{formatNonce(v.nonce)}</dd>
        {v.coolOffUntil && (
          <>
            <dt className="text-graphite">{t.verdict.coolOff}</dt>
            <dd>{v.coolOffUntil}</dd>
          </>
        )}
        {v.collisions?.map((c) => (
          <div key={c} className="contents">
            <dt className="text-blocked">{t.verdict.collision}</dt>
            <dd className="break-all text-blocked">{c}</dd>
          </div>
        ))}
      </dl>

      {v.evidence && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <SignatureLine label={t.verdict.control} ev={v.evidence.control} state={t.verdict.missing} color="var(--ink)" />
          <SignatureLine
            label={t.verdict.rotation}
            ev={v.evidence.rotation}
            state={hasRotation ? t.verdict.missing : t.verdict.notRequired}
            color={v.verdict === "MISMATCH" ? "var(--blocked)" : "var(--seal-bright)"}
          />
        </div>
      )}
      <p className="mt-6 font-mono text-[11.5px] text-graphite">
        {t.verdict.checked} {v.checkedAt}
      </p>
    </article>
  );
}
