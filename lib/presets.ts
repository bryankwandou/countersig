// Real challenges issued and signed on devnet by tools/ (see docs/evidence/presets).
export const WALLETS = {
  prior: "66ahMx2mUV3a4X2Hyoe6SXv4tBmmCtariKvvyCZ8sv98",
  claimed: "5xqQGYCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9",
  attacker: "fjuXhLw6cpsWPAiYYwg6SGiLjAnwFbuUmjQsnDB1wPa",
};
// Same first and last four characters as the claimed wallet: the poisoning pattern.
export const POISONED = "5xqQZzCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9";

export type PresetKey = "continuity" | "takeover" | "mismatch" | "lookalike" | "firstContact";
export interface Preset {
  claimed: string;
  prior: string | null;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  known?: string[];
}

export const PRESETS: Record<PresetKey, Preset> = {
  continuity: { claimed: WALLETS.claimed, prior: WALLETS.prior, nonce: "6ENQ1W0CBV8Q94TB", issuedAt: "2026-09-14T01:05:42.057Z", expiresAt: "2027-09-14T01:05:42.057Z" },
  takeover: { claimed: WALLETS.attacker, prior: WALLETS.prior, nonce: "CX5VFHAHYX0ABMRE", issuedAt: "2026-09-13T12:18:53.742Z", expiresAt: "2027-09-13T12:18:53.742Z" },
  mismatch: { claimed: WALLETS.claimed, prior: WALLETS.prior, nonce: "KBYPBCYC0ATVHN4F", issuedAt: "2026-09-13T12:18:34.615Z", expiresAt: "2027-09-13T12:18:34.615Z" },
  lookalike: { claimed: WALLETS.claimed, prior: WALLETS.prior, nonce: "6ENQ1W0CBV8Q94TB", issuedAt: "2026-09-14T01:05:42.057Z", expiresAt: "2027-09-14T01:05:42.057Z", known: [POISONED] },
  firstContact: { claimed: WALLETS.claimed, prior: null, nonce: "KBJ642BRQ7FHBNFK", issuedAt: "2026-09-13T12:19:10.655Z", expiresAt: "2027-09-13T12:19:10.655Z" },
};

export const PRESET_ORDER: PresetKey[] = ["continuity", "takeover", "mismatch", "lookalike", "firstContact"];

export function presetQuery(p: Preset) {
  const q = new URLSearchParams({ a: p.claimed, n: p.nonce, i: String(Date.parse(p.issuedAt) / 1000 | 0), e: String(Date.parse(p.expiresAt) / 1000 | 0), c: "devnet" });
  if (p.prior) q.set("p", p.prior);
  if (p.known?.length) q.set("k", p.known.join(","));
  return q.toString();
}
