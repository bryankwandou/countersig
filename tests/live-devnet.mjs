// Re-reads the recorded attack scenarios on live Solana devnet with the skill's own script. No keys needed.
// Run: node tests/live-devnet.mjs
import { verify } from "../skill/scripts/countersig.mjs";

const PRIOR = "66ahMx2mUV3a4X2Hyoe6SXv4tBmmCtariKvvyCZ8sv98";
const CLAIMED = "5xqQGYCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9";
const ATTACKER = "fjuXhLw6cpsWPAiYYwg6SGiLjAnwFbuUmjQsnDB1wPa";
const POISONED = "5xqQZzCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9";
// Fixed "now" inside every window so results do not drift as the calendar moves.
const NOW = Date.parse("2026-09-15T00:00:00Z");

const cases = [
  ["legitimate rotation", { claimed: CLAIMED, prior: PRIOR, nonce: "6ENQ1W0CBV8Q94TB", issuedAt: "2026-09-14T01:05:42.057Z", expiresAt: "2027-09-14T01:05:42.057Z" }, "VERIFIED_CONTINUITY"],
  ["mailbox takeover: attacker signed, prior wallet never countersigned", { claimed: ATTACKER, prior: PRIOR, nonce: "CX5VFHAHYX0ABMRE", issuedAt: "2026-09-13T12:18:53.742Z", expiresAt: "2027-09-13T12:18:53.742Z" }, "PENDING"],
  ["swapped endorsement", { claimed: CLAIMED, prior: PRIOR, nonce: "KBYPBCYC0ATVHN4F", issuedAt: "2026-09-13T12:18:34.615Z", expiresAt: "2027-09-13T12:18:34.615Z" }, "MISMATCH"],
  ["address poisoning", { claimed: CLAIMED, prior: PRIOR, nonce: "6ENQ1W0CBV8Q94TB", issuedAt: "2026-09-14T01:05:42.057Z", expiresAt: "2027-09-14T01:05:42.057Z", known: [POISONED] }, "LOOKALIKE"],
  ["first contact", { claimed: CLAIMED, prior: null, nonce: "KBJ642BRQ7FHBNFK", issuedAt: "2026-09-13T12:19:10.655Z", expiresAt: "2027-09-13T12:19:10.655Z" }, "VERIFIED_CHANNEL"],
];

let failed = 0;
for (const [name, input, expected] of cases) {
  const v = await verify({ ...input, cluster: "devnet", now: NOW });
  const ok = v.verdict === expected;
  if (!ok) failed += 1;
  const links = [v.evidence?.control?.explorer, v.evidence?.rotation?.explorer].filter(Boolean).join(" ");
  console.log(`${ok ? "pass" : "FAIL"}  ${name}  -> ${v.verdict}${ok ? "" : ` (expected ${expected})`}${links ? `  ${links}` : ""}`);
}
console.log(`\n${cases.length - failed} of ${cases.length} live devnet scenarios match`);
process.exitCode = failed ? 1 : 0;
