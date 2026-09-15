"use client";

import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Mark } from "@/components/Mark";
import { MEMO_PROGRAM, RPC, controlMemo, explorerTx, formatNonce, isSolanaAddress, normalizeNonce, rotateMemo, shortAddress, type SolanaCluster } from "@/lib/countersig";
import { useI18n } from "@/lib/i18n";

interface Provider {
  publicKey?: { toBase58(): string } | null;
  connect(): Promise<{ publicKey?: { toBase58(): string } } | void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
}
type W = Window & { phantom?: { solana?: Provider }; solflare?: Provider; backpack?: Provider; solana?: Provider };

function wallets(): { name: string; p: Provider }[] {
  const w = window as W;
  return [
    ["Phantom", w.phantom?.solana],
    ["Solflare", w.solflare],
    ["Backpack", w.backpack],
    ["Wallet", !w.phantom && w.solana ? w.solana : undefined],
  ]
    .filter((x): x is [string, Provider] => Boolean(x[1]))
    .map(([name, p]) => ({ name, p }));
}

type Status =
  | { s: "idle" }
  | { s: "connecting" }
  | { s: "signing" }
  | { s: "sending"; sig: string }
  | { s: "done"; sig: string }
  | { s: "error"; msg: string }
  | { s: "rejected" };

function SignInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const nonce = normalizeNonce(sp.get("n") ?? "");
  const claimed = sp.get("a") ?? "";
  const prior = sp.get("p");
  const cluster = (sp.get("c") as SolanaCluster) || "devnet";
  const expires = Number(sp.get("e")) || 0;
  const valid = /^[0-9A-Z]{16}$/.test(nonce) && isSolanaAddress(claimed) && (!prior || isSolanaAddress(prior)) && cluster in RPC;
  const [openedAt] = useState(() => Date.now() / 1000);
  const expired = expires > 0 && openedAt > expires;

  const roles = useMemo(
    () => [
      { key: "new", label: t.sign.roleNew, wallet: claimed, memo: controlMemo(nonce) },
      ...(prior ? [{ key: "prior", label: t.sign.rolePrior, wallet: prior, memo: rotateMemo(nonce, claimed) }] : []),
    ],
    [claimed, prior, nonce, t],
  );
  const [roleIdx, setRoleIdx] = useState(0);
  const [connected, setConnected] = useState<{ name: string; p: Provider; address: string } | null>(null);
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const role = roles[roleIdx];
  const [available, setAvailable] = useState<{ name: string; p: Provider }[] | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setAvailable(wallets()), 300);
    return () => clearTimeout(id);
  }, []);

  const connect = async (name: string, p: Provider) => {
    setStatus({ s: "connecting" });
    try {
      const res = await p.connect();
      const address = (res && res.publicKey?.toBase58()) || p.publicKey?.toBase58();
      if (!address) throw new Error("no public key");
      setConnected({ name, p, address });
      const idx = roles.findIndex((r) => r.wallet === address);
      if (idx >= 0) setRoleIdx(idx);
      setStatus({ s: "idle" });
    } catch {
      setStatus({ s: "rejected" });
    }
  };

  const sign = async () => {
    if (!connected) return;
    setStatus({ s: "signing" });
    try {
      const conn = new Connection(RPC[cluster], "confirmed");
      const payer = new PublicKey(connected.address);
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
      const tx = new Transaction({ feePayer: payer, blockhash, lastValidBlockHeight }).add(
        new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [{ pubkey: payer, isSigner: true, isWritable: false }], data: Buffer.from(role.memo, "utf8") }),
      );
      let signed: Transaction;
      try {
        signed = await connected.p.signTransaction(tx);
      } catch {
        setStatus({ s: "rejected" });
        return;
      }
      const sig = await conn.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed" });
      setStatus({ s: "sending", sig });
      const res = await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (res.value.err) throw new Error(JSON.stringify(res.value.err));
      setStatus({ s: "done", sig });
    } catch (e) {
      setStatus({ s: "error", msg: (e as Error).message });
    }
  };

  if (!valid) {
    return <Shell><p className="text-graphite">{t.sign.missing}</p></Shell>;
  }

  const mismatch = connected && connected.address !== role.wallet;

  const verifyHref = `/verify?${sp.toString()}`;

  return (
    <Shell>
      <p className="eyebrow">countersig:v1 · {cluster}</p>
      <h1 className="display mt-3 text-[42px] sm:text-[52px]">{t.sign.title}</h1>
      <p className="mt-3 text-graphite">{t.sign.lede}</p>

      {expired && <p className="mt-6 rounded-md border border-blocked px-4 py-3 text-[14px] text-blocked">{t.sign.expired}</p>}

      {roles.length > 1 && (
        <div className="mt-8" role="tablist" aria-label={t.sign.role}>
          <p className="mb-2 text-[13px] font-medium">{t.sign.role}</p>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((r, i) => (
              <button key={r.key} role="tab" aria-selected={i === roleIdx} onClick={() => { setRoleIdx(i); setStatus({ s: "idle" }); }} className={`min-h-11 rounded-md border px-3 text-left text-[14px] ${i === roleIdx ? "border-ink text-ink" : "border-rule text-graphite hover:text-ink"}`}>
                <span className="block font-mono text-[11px] text-graphite">{String(i + 1).padStart(2, "0")}</span>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <dl className="mt-8 space-y-4">
        <div>
          <dt className="text-[13px] font-medium">{t.sign.expected}</dt>
          <dd className="mt-1 break-all font-mono text-[13px]">{role.wallet}</dd>
        </div>
        <div>
          <dt className="text-[13px] font-medium">{t.sign.memo}</dt>
          <dd className="mt-1 break-all rounded-[2px] border border-rule bg-paper px-3 py-2 font-mono text-[13px]">{role.memo}</dd>
          <dd className="mt-1 font-mono text-[12px] text-graphite">nonce {formatNonce(nonce)}{expires ? ` · exp ${new Date(expires * 1000).toISOString()}` : ""}</dd>
        </div>
      </dl>

      <div className="mt-8 border-t border-rule pt-6">
        {!connected ? (
          available === null ? null : available.length === 0 ? (
            <p className="text-[14px] text-graphite">{t.sign.noWallet}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {available.map((w) => (
                <button key={w.name} className="btn btn-seal" disabled={status.s === "connecting" || expired} onClick={() => connect(w.name, w.p)}>
                  {status.s === "connecting" ? t.sign.connecting : `${t.sign.connect} · ${w.name}`}
                </button>
              ))}
            </div>
          )
        ) : (
          <div>
            <p className="font-mono text-[13px]">
              <span className="mr-2 inline-block size-2 rounded-full" style={{ background: mismatch ? "var(--blocked)" : "var(--verified)" }} aria-hidden />
              {connected.name} · {shortAddress(connected.address)}
            </p>
            {mismatch && <p className="mt-2 text-[14px] text-blocked">{t.sign.wrongWallet}</p>}
            {status.s !== "done" && (
              <button className="btn btn-seal mt-4" disabled={Boolean(mismatch) || expired || status.s === "signing" || status.s === "sending"} aria-busy={status.s === "signing" || status.s === "sending"} onClick={sign}>
                {status.s === "signing" ? t.sign.signing : status.s === "sending" ? `${t.sign.sending} ${cluster}` : t.sign.signBtn}
              </button>
            )}
          </div>
        )}

        {status.s === "rejected" && <p className="mt-3 text-[14px] text-graphite">{t.sign.rejected}</p>}
        {status.s === "error" && (
          <p className="mt-3 text-[14px] text-blocked">
            {t.sign.failed} <span className="block break-all font-mono text-[12px]">{status.msg}</span>
          </p>
        )}
        {status.s === "done" && (
          <div className="rise mt-5 rounded-md border border-verified p-4">
            <p className="font-medium text-verified">{t.sign.done}</p>
            <a className="mt-1 block break-all font-mono text-[12px] underline underline-offset-4" href={explorerTx(status.sig, cluster)} target="_blank" rel="noreferrer">{status.sig}</a>
            <div className="mt-4 flex flex-wrap gap-2">
              {roleIdx === 0 && roles.length > 1 && (
                <button className="btn" onClick={() => { setRoleIdx(1); setStatus({ s: "idle" }); }}>{t.sign.next}</button>
              )}
              <Link className="btn" href={verifyHref}>{t.sign.check}</Link>
            </div>
          </div>
        )}
      </div>

      <p className="mt-10 text-[13px] text-graphite">{t.sign.warn}</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-5 py-14 sm:py-20">
      <div className="sheet relative p-6 sm:p-10">
        <div className="absolute right-6 top-6 opacity-90" aria-hidden><Mark size={30} /></div>
        {children}
      </div>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense>
      <SignInner />
    </Suspense>
  );
}
