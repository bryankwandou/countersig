// Re-reads the recorded Base Sepolia scenarios with the skill's own script. No keys needed.
// Run: node tests/live-base.mjs
import { readFile } from "node:fs/promises";
import { verify } from "../skill/scripts/countersig.mjs";

const evidence = JSON.parse(await readFile(new URL("../docs/evidence/base-sepolia.json", import.meta.url), "utf8"));
const W = evidence.wallets;
const call = async (method, params) => (await (await fetch("https://sepolia.base.org", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json()).result;
const hashOf = (url) => url.split("/tx/")[1];
const memoOf = async (hash) => Buffer.from((await call("eth_getTransactionByHash", [hash])).input.slice(2), "hex").toString("utf8");

// claimed wallet, prior wallet (or null), and which recorded txs are control / rotation
const plan = {
  "legitimate rotation on Base": { claimed: W.payee, prior: W.prior, control: 0, rotation: 1 },
  "mailbox takeover: attacker signs, prior wallet never countersigns": { claimed: W.attacker, prior: W.prior, control: 0 },
  "attacker submits the prior wallet's hash for a different rotation": { claimed: W.payee, prior: W.prior, control: 0, rotation: 1 },
  "hash from the wrong sender": { claimed: W.payee, prior: null, control: 0 },
  "first contact on Base": { claimed: W.payee, prior: null, control: 0 },
};

let failed = 0;
for (const r of evidence.results) {
  const p = plan[r.name];
  const controlTx = hashOf(r.txs[p.control]);
  const nonce = (await memoOf(controlTx)).split(":")[2];
  const ran = Date.parse(evidence.ranAt);
  const v = await verify({
    cluster: "base-sepolia",
    claimed: p.claimed,
    prior: p.prior,
    nonce,
    issuedAt: new Date(ran - 3600 * 1000).toISOString(),
    expiresAt: new Date(ran + 72 * 3600 * 1000).toISOString(),
    controlTx,
    rotationTx: p.rotation != null ? hashOf(r.txs[p.rotation]) : undefined,
    now: ran + 3600 * 1000,
  });
  const ok = v.verdict === r.expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${r.name}  -> ${v.verdict}${ok ? "" : ` (expected ${r.expected})`}`);
}
console.log(`\n${evidence.results.length - failed} of ${evidence.results.length} live Base Sepolia scenarios match`);
process.exitCode = failed ? 1 : 0;
