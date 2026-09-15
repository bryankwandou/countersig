// Offline checks for `countersig.mjs gate`. Run: node tests/gate-check.mjs
import { gate } from "../skill/scripts/countersig.mjs";

const NOW = Date.parse("2026-09-15T12:00:00Z");
const iso = (h) => new Date(NOW + h * 3600 * 1000).toISOString();
const W = "5xqQGYCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9";
const v = (verdict, extra = {}) => ({ type: "countersig.verdict", verdict, cluster: "mainnet-beta", claimed: W, checkedAt: iso(-1), ...extra });
const channel = (extra = {}) => v("VERIFIED_CHANNEL", { coolOffUntil: iso(-2), evidence: { control: { blockTime: (NOW - 30 * 3600 * 1000) / 1000 } }, ...extra });

const cases = [
  ["continuity pays with approval", { verdict: v("VERIFIED_CONTINUITY"), amountUsd: 40000 }, "ALLOW_WITH_USER_APPROVAL"],
  ["mismatch is a hard stop", { verdict: v("MISMATCH"), amountUsd: 10 }, "BLOCK"],
  ["lookalike is a hard stop", { verdict: v("LOOKALIKE"), amountUsd: 10 }, "BLOCK"],
  ["pending holds", { verdict: v("PENDING", { missing: ["rotation"] }), amountUsd: 10 }, "HOLD"],
  ["expired blocks", { verdict: v("EXPIRED"), amountUsd: 10 }, "BLOCK"],
  ["devnet proof cannot unlock mainnet", { verdict: v("VERIFIED_CONTINUITY", { cluster: "devnet" }), amountUsd: 10, paymentCluster: "mainnet-beta" }, "BLOCK"],
  ["solana proof cannot unlock base", { verdict: v("VERIFIED_CONTINUITY"), amountUsd: 10, paymentCluster: "base" }, "BLOCK"],
  ["different destination blocks", { verdict: v("VERIFIED_CONTINUITY"), amountUsd: 10, destination: "66ahMx2mUV3a4X2Hyoe6SXv4tBmmCtariKvvyCZ8sv98" }, "BLOCK"],
  ["stale verdict holds", { verdict: v("VERIFIED_CONTINUITY", { checkedAt: iso(-30) }), amountUsd: 10 }, "HOLD"],
  ["missing amount blocks", { verdict: v("VERIFIED_CONTINUITY"), amountUsd: "" }, "BLOCK"],
  ["first contact small after cool-off", { verdict: channel(), amountUsd: 900 }, "ALLOW_WITH_USER_APPROVAL"],
  ["first contact inside cool-off holds", { verdict: channel({ coolOffUntil: iso(5) }), amountUsd: 900 }, "HOLD"],
  ["first contact large needs call-back", { verdict: channel(), amountUsd: 5000 }, "HOLD"],
  ["first contact large with call-back", { verdict: channel(), amountUsd: 5000, callbackConfirmed: true }, "ALLOW_WITH_USER_APPROVAL"],
  ["split payments are summed", { verdict: channel(), amountUsd: 900, history: [{ to: W, amountUsd: 900, at: iso(-24) }] }, "HOLD"],
  ["old split outside 7 days ignored", { verdict: channel(), amountUsd: 900, history: [{ to: W, amountUsd: 900, at: iso(-24 * 8) }] }, "ALLOW_WITH_USER_APPROVAL"],
  ["lost wallet without second channel holds", { verdict: channel(), amountUsd: 500, continuityUnavailable: true }, "HOLD"],
  ["lost wallet inside 72 h holds", { verdict: channel(), amountUsd: 500, continuityUnavailable: true, secondChannelAt: iso(-10) }, "HOLD"],
  ["lost wallet after 72 h allows", { verdict: channel({ evidence: { control: { blockTime: (NOW - 100 * 3600 * 1000) / 1000 } } }), amountUsd: 500, continuityUnavailable: true, secondChannelAt: iso(-80) }, "ALLOW_WITH_USER_APPROVAL"],
  ["72 h counts from the later proof", { verdict: channel(), amountUsd: 500, continuityUnavailable: true, secondChannelAt: iso(-80) }, "HOLD"],
  ["not a verdict blocks", { verdict: { claimed: W }, amountUsd: 10 }, "BLOCK"],
];

let failed = 0;
for (const [name, input, expected] of cases) {
  const got = gate({ ...input, now: NOW });
  const ok = got.decision === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}  -> ${got.decision}${ok ? "" : ` (expected ${expected}; ${got.reasons.join("; ")})`}`);
}
console.log(`\n${cases.length - failed} of ${cases.length} gate cases pass`);
process.exitCode = failed ? 1 : 0;
