"use client";

import Link from "next/link";
import { useState } from "react";
import { VerdictSheet } from "@/components/VerdictSheet";
import { verify, type Verdict } from "@/lib/countersig";

// Recorded run of the skill against a real Mermail mailbox on 2026-09-14. Raw tool output: /proof/mermail-log.json
const RUN = {
  mailbox: "nayrbryangamingagent01@mermail.app",
  claimed: "5xqQGYCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9",
  prior: "66ahMx2mUV3a4X2Hyoe6SXv4tBmmCtariKvvyCZ8sv98",
  nonce: "70K4BH8HTH16J1P3",
  issuedAt: "2026-09-14T01:34:04.658Z",
  expiresAt: "2026-09-17T01:34:04.658Z",
  control: "2st8otiRNSYfgcvHbYrAgs5AsR4Pjnp6fUvCyM7ffMCMp7TjdDaeERYtxzkRv35sZj2cnUXT35ebwh5yVB3roLZb",
  rotation: "4QETMqJuENStxQCgcCvN2eVb5UuMcUy6jdXEtfqkBMTgaYhAvYshFWunVqrs6Tob1jaD18tSTiD1azmZ1XwSrcH9",
  receipt: "ee90a1bdc3a6e6bfa5487351655d0b355801a7b968593ed58556a1a9c5ecccf9",
};
const tx = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;

const STEPS: { at: string; tool: string; title: string; detail: React.ReactNode }[] = [
  { at: "01:31:19", tool: "inbound", title: "Invoice #1181 arrives", detail: "The vendor's earlier thread names the wallet we already paid, 66ah...v98. Mermail reported its sender authentication as unknown, so by the skill's own rule it cannot make the address trusted by itself." },
  { at: "01:31:36", tool: "inbound", title: "“Updated payout wallet for invoice #1182”", detail: "Urgent request to pay a new wallet, 5xqQ...6qJ9. Mermail scan: clean. Sender authentication: unknown, so the skill does not trust it." },
  { at: "01:33", tool: "search_emails · get_email_context", title: "Agent finds the request and the payment history", detail: "No earlier message passed sender authentication, so the skill falls back to the address the user already trusts (recorded as user_supplied). In this demo the user who set up the vendor designated that address. The Reply-To of the new request is never used." },
  { at: "01:34:04", tool: "challenge", title: "One-time nonce 70K4-BH8H-TH16-J1P3", detail: "Valid for 72 hours. Verification at this moment returns PENDING, so nothing is payable." },
  { at: "01:34:12", tool: "send_email", title: "Challenge delivered to the trusted address", detail: "Mermail status: sent, delivered. The email carries both memos and a signing link." },
  { at: "01:39:25", tool: "Solana devnet", title: "New wallet signs the control memo", detail: <a className="underline underline-offset-4" href={tx(RUN.control)} target="_blank" rel="noreferrer">slot 498,002,617 · explorer</a> },
  { at: "01:39:27", tool: "Solana devnet", title: "Old wallet countersigns the rotation", detail: <a className="underline underline-offset-4" href={tx(RUN.rotation)} target="_blank" rel="noreferrer">slot 498,002,628 · explorer</a> },
  { at: "01:39:32", tool: "verify · save_draft", title: "VERIFIED_CONTINUITY, receipt saved", detail: <>Receipt sha256 <span className="break-all">{RUN.receipt.slice(0, 16)}...</span> saved as a Mermail draft. No funds moved; payment still needs a separate approval.</> },
];

export default function ProofPage() {
  const [state, setState] = useState<{ s: "idle" | "loading" | "done" | "error"; v?: Verdict }>({ s: "idle" });
  const run = async () => {
    setState({ s: "loading" });
    try {
      const v = await verify({ claimed: RUN.claimed, prior: RUN.prior, nonce: RUN.nonce, issuedAt: Date.parse(RUN.issuedAt) / 1000, expiresAt: Date.parse(RUN.expiresAt) / 1000, cluster: "devnet" });
      setState({ s: "done", v });
    } catch {
      setState({ s: "error" });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="eyebrow">Recorded run · 14 Sep 2026 · {RUN.mailbox}</p>
      <h1 className="display mt-4 max-w-[22ch] text-[44px] sm:text-[64px]">The skill, run end to end in a real Mermail inbox.</h1>
      <p className="mt-5 max-w-[62ch] text-[17px] text-graphite">
        Every step below happened on the live Mermail API and on Solana devnet. You do not have to trust this page: re-check the signatures yourself with the button, or open each transaction in the explorer.
      </p>

      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <ol className="lg:col-span-6">
          {STEPS.map((s, i) => (
            <li key={i} className="grid grid-cols-[4.5rem_1fr] gap-4 border-t border-rule py-5">
              <span className="font-mono text-[12px] text-graphite num">{s.at}</span>
              <div>
                <code className={`font-mono text-[12px] ${s.tool === "Solana devnet" ? "text-seal" : "text-graphite"}`}>{s.tool}</code>
                <p className="mt-1 font-medium">{s.title}</p>
                <p className="mt-1 text-[14.5px] text-graphite">{s.detail}</p>
              </div>
            </li>
          ))}
          <li className="border-t border-rule pt-5 text-[14px] text-graphite">
            Times in UTC. Raw Mermail tool output:{" "}
            <a className="underline underline-offset-4 hover:text-ink" href="/proof/mermail-log.json" target="_blank">mermail-log.json</a>
          </li>
        </ol>

        <div className="space-y-8 lg:col-span-6">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="eyebrow">Check it yourself</p>
              <button className="btn btn-seal" onClick={run} disabled={state.s === "loading"} aria-busy={state.s === "loading"}>
                {state.s === "loading" ? "Reading Solana..." : "Re-verify on devnet now"}
              </button>
            </div>
            <div className="mt-4">
              {state.s === "idle" && <div className="grid min-h-[260px] place-items-center rounded-xl border border-dashed border-rule p-8 text-center text-graphite">Your browser queries the public devnet RPC directly and applies the same rules as the skill script.</div>}
              {state.s === "loading" && <div className="sheet min-h-[260px] animate-pulse p-8" aria-busy><div className="h-6 w-44 rounded-full bg-rule" /><div className="mt-6 h-10 w-3/4 rounded bg-rule" /></div>}
              {state.s === "error" && <div className="sheet grid min-h-[260px] place-items-center p-8 text-center text-graphite"><div>The public RPC did not answer. <button className="btn mt-3" onClick={run}>Try again</button></div></div>}
              {state.s === "done" && state.v && <VerdictSheet key={state.v.checkedAt} v={state.v} />}
            </div>
          </div>

          <div>
            <p className="eyebrow">Screen recording of the run</p>
            <video className="mt-4 w-full rounded-xl border border-rule" src="/proof/evidence.webm" controls muted playsInline preload="metadata" />
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="btn" href="/#demo">Try the attack cases</Link>
            <a className="btn" href="https://github.com/Nudgen-Marketing/mermail-skills/pull/268" target="_blank" rel="noreferrer">Source · PR #268</a>
          </div>
        </div>
      </div>
    </div>
  );
}
