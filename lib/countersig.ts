// Browser port of skill/mermail-countersig/scripts/countersig.mjs (verify path only).
// Keep the verdict rules identical to the CLI; tools/parity-check.mjs compares both against devnet.

export const VERSION = "v1";
export const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export type Cluster = "devnet" | "testnet" | "mainnet-beta";
export const RPC: Record<Cluster, string> = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};
const CLOCK_SKEW_S = 300;
const FIRST_CONTACT_COOL_OFF_H = 24;

export type VerdictName =
  | "VERIFIED_CONTINUITY"
  | "VERIFIED_CHANNEL"
  | "PENDING"
  | "MISMATCH"
  | "LOOKALIKE"
  | "EXPIRED"
  | "UNCHANGED"
  | "INVALID_ADDRESS"
  | "INVALID_INPUT";

export interface Evidence {
  signature: string;
  slot: number;
  blockTime: number;
  blockTimeIso: string;
  memo: string | null;
  signedByAddress: boolean;
  succeeded: boolean;
  explorer?: string;
}

export interface Verdict {
  verdict: VerdictName;
  payable: boolean;
  cluster: Cluster;
  claimed: string;
  prior: string | null;
  nonce: string;
  checkedAt: string;
  reason?: string;
  coolOffUntil?: string;
  missing?: string[];
  collisions?: string[];
  evidence?: { control: Evidence | null; rotation: Evidence | null };
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function b58decode(text: string): Uint8Array {
  let n = 0n;
  for (const ch of text) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("invalid base58");
    n = n * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const ch of text) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}
export function isSolanaAddress(text: string | null | undefined): text is string {
  if (!text || text.length < 32 || text.length > 44) return false;
  try {
    return b58decode(text).length === 32;
  } catch {
    return false;
  }
}

export const controlMemo = (nonce: string) => `countersig:${VERSION}:${nonce}`;
export const rotateMemo = (nonce: string, claimed: string) => `countersig:${VERSION}:${nonce}:rotate:${claimed}`;
export const explorerTx = (sig: string, cluster: Cluster) =>
  `https://explorer.solana.com/tx/${sig}${cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`}`;
export const explorerAddress = (addr: string, cluster: Cluster) =>
  `https://explorer.solana.com/address/${addr}${cluster === "mainnet-beta" ? "" : `?cluster=${cluster}`}`;
export const shortAddress = (a: string, n = 4) => (a.length > n * 2 + 3 ? `${a.slice(0, n)}...${a.slice(-n)}` : a);
export const formatNonce = (n: string) => n.match(/.{1,4}/g)?.join("-") ?? n;
export const normalizeNonce = (n: string) => n.replace(/[^0-9A-Za-z]/g, "").toUpperCase();

export function lookalikes(claimed: string, known: string[]) {
  return known.filter((k) => k && k !== claimed && k.slice(0, 4) === claimed.slice(0, 4) && k.slice(-4) === claimed.slice(-4));
}

async function rpc<T>(url: string, method: string, params: unknown[], signal?: AbortSignal): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal,
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`RPC HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw Object.assign(new Error(json.error.message), { fatal: true });
      return json.result as T;
    } catch (error) {
      last = error;
      if ((error as { fatal?: boolean }).fatal || signal?.aborted) throw error;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw last;
}

interface SigInfo { signature: string; blockTime: number | null; memo: string | null }
interface ParsedTx {
  slot: number;
  blockTime: number;
  meta: { err: unknown; innerInstructions?: { instructions: { programId: string; parsed?: unknown }[] }[] } | null;
  transaction: { message: { accountKeys: { pubkey: string; signer: boolean }[]; instructions: { programId: string; parsed?: unknown }[] } };
}

async function findMemoProof(opts: { rpcUrl: string; address: string; expected: string; notBefore: number; notAfter: number; signal?: AbortSignal }) {
  const { rpcUrl, address, expected, notBefore, notAfter, signal } = opts;
  const prefix = expected.split(":").slice(0, 3).join(":");
  const sigs = await rpc<SigInfo[]>(rpcUrl, "getSignaturesForAddress", [address, { limit: 200, commitment: "confirmed" }], signal);
  let match: Evidence | null = null;
  const nearMisses: Evidence[] = [];
  for (const entry of sigs) {
    if (entry.blockTime == null || entry.blockTime < notBefore - CLOCK_SKEW_S || entry.blockTime > notAfter) continue;
    if (!entry.memo || !entry.memo.includes(prefix)) continue;
    const tx = await rpc<ParsedTx | null>(rpcUrl, "getTransaction", [entry.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }], signal);
    if (!tx) continue;
    const signer = tx.transaction.message.accountKeys.some((k) => k.pubkey === address && k.signer);
    const all = [...tx.transaction.message.instructions, ...(tx.meta?.innerInstructions ?? []).flatMap((i) => i.instructions)];
    const memos = all.filter((ix) => ix.programId === MEMO_PROGRAM && typeof ix.parsed === "string").map((ix) => ix.parsed as string);
    const ev: Evidence = {
      signature: entry.signature,
      slot: tx.slot,
      blockTime: tx.blockTime,
      blockTimeIso: new Date(tx.blockTime * 1000).toISOString(),
      memo: memos.find((m) => m.startsWith(prefix)) ?? memos[0] ?? null,
      signedByAddress: signer,
      succeeded: tx.meta?.err == null,
    };
    if (memos.includes(expected) && signer && ev.succeeded && !match) match = ev;
    else nearMisses.push(ev);
  }
  return { found: Boolean(match), evidence: match, nearMisses };
}

export interface VerifyInput {
  claimed: string;
  prior?: string | null;
  nonce: string;
  issuedAt: number; // unix seconds
  expiresAt: number; // unix seconds
  cluster?: Cluster;
  known?: string[];
  signal?: AbortSignal;
}

export async function verify(input: VerifyInput): Promise<Verdict> {
  const cluster = input.cluster ?? "devnet";
  const rpcUrl = RPC[cluster];
  const claimed = input.claimed.trim();
  const prior = input.prior?.trim() || null;
  const nonce = normalizeNonce(input.nonce);
  const now = Math.floor(Date.now() / 1000);
  const base = { cluster, claimed, prior, nonce, checkedAt: new Date(now * 1000).toISOString() };
  const done = (verdict: VerdictName, extra: Partial<Verdict> = {}): Verdict => ({ ...base, verdict, payable: verdict === "VERIFIED_CONTINUITY", ...extra });

  if (!isSolanaAddress(claimed)) return done("INVALID_ADDRESS", { reason: "claimed" });
  if (prior && !isSolanaAddress(prior)) return done("INVALID_ADDRESS", { reason: "prior" });
  if (!/^[0-9A-Z]{16}$/.test(nonce)) return done("INVALID_INPUT", { reason: "nonce" });
  if (!(input.expiresAt > input.issuedAt)) return done("INVALID_INPUT", { reason: "window" });
  if (prior && prior === claimed) return done("UNCHANGED");
  const collisions = lookalikes(claimed, [...new Set([...(input.known ?? []), ...(prior ? [prior] : [])])]);
  if (collisions.length) return done("LOOKALIKE", { collisions });

  const windowEnd = Math.min(now, input.expiresAt);
  const control = await findMemoProof({ rpcUrl, address: claimed, expected: controlMemo(nonce), notBefore: input.issuedAt, notAfter: windowEnd, signal: input.signal });
  let rotation: Awaited<ReturnType<typeof findMemoProof>> | null = null;
  const link = (e: Evidence | null) => (e ? { ...e, explorer: explorerTx(e.signature, cluster) } : null);
  if (prior) {
    rotation = await findMemoProof({ rpcUrl, address: prior, expected: rotateMemo(nonce, claimed), notBefore: input.issuedAt, notAfter: windowEnd, signal: input.signal });
    const wrong = rotation.nearMisses.find(
      (m) => m.signedByAddress && m.succeeded && m.memo?.startsWith(`countersig:${VERSION}:${nonce}:rotate:`) && m.memo !== rotateMemo(nonce, claimed),
    );
    if (wrong) return done("MISMATCH", { evidence: { control: link(control.evidence), rotation: link(wrong) } });
  }
  const evidence = { control: link(control.evidence), rotation: link(rotation?.evidence ?? null) };
  if (control.found && prior && rotation?.found) return done("VERIFIED_CONTINUITY", { evidence });
  if (control.found && !prior) {
    return done("VERIFIED_CHANNEL", {
      evidence,
      coolOffUntil: new Date((control.evidence!.blockTime + FIRST_CONTACT_COOL_OFF_H * 3600) * 1000).toISOString(),
    });
  }
  if (now > input.expiresAt) return done("EXPIRED", { evidence });
  const missing = [!control.found && "control", prior && !rotation?.found && "rotation"].filter(Boolean) as string[];
  return done("PENDING", { evidence, missing });
}
