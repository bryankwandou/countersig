// Records real RPC responses for the golden corpus used by tests/countersig.mjs.
// Run once: node tools/record-golden.mjs   -> _upstream/tests/fixtures/countersig-golden.json
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { verify } from "../skill/scripts/countersig.mjs";

const UPSTREAM = { solana: "https://api.devnet.solana.com", base: "https://sepolia.base.org" };
const recorded = { solana: {}, base: {} };
const key = (method, params) => `${method} ${JSON.stringify(params)}`;

const server = createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  const net = req.url.includes("base") ? "base" : "solana";
  const { method, params } = JSON.parse(body);
  const k = key(method, params);
  if (!recorded[net][k]) {
    const r = await fetch(UPSTREAM[net], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    recorded[net][k] = (await r.json()).result ?? null;
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: recorded[net][k] }));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const P = "66ahMx2mUV3a4X2Hyoe6SXv4tBmmCtariKvvyCZ8sv98";
const C = "5xqQGYCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9";
const A = "fjuXhLw6cpsWPAiYYwg6SGiLjAnwFbuUmjQsnDB1wPa";
const POISONED = "5xqQZzCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9";
const SOL_NOW = Date.parse("2026-09-15T00:00:00Z");
const cases = [
  { name: "solana: legitimate rotation", net: "solana", now: SOL_NOW, input: { cluster: "devnet", claimed: C, prior: P, nonce: "6ENQ1W0CBV8Q94TB", issuedAt: "2026-09-14T01:05:42.057Z", expiresAt: "2027-09-14T01:05:42.057Z" } },
  { name: "solana: mailbox takeover", net: "solana", now: SOL_NOW, input: { cluster: "devnet", claimed: A, prior: P, nonce: "CX5VFHAHYX0ABMRE", issuedAt: "2026-09-13T12:18:53.742Z", expiresAt: "2027-09-13T12:18:53.742Z" } },
  { name: "solana: swapped endorsement", net: "solana", now: SOL_NOW, input: { cluster: "devnet", claimed: C, prior: P, nonce: "KBYPBCYC0ATVHN4F", issuedAt: "2026-09-13T12:18:34.615Z", expiresAt: "2027-09-13T12:18:34.615Z" } },
  { name: "solana: address poisoning", net: "solana", now: SOL_NOW, input: { cluster: "devnet", claimed: C, prior: P, nonce: "6ENQ1W0CBV8Q94TB", issuedAt: "2026-09-14T01:05:42.057Z", expiresAt: "2027-09-14T01:05:42.057Z", known: [POISONED] } },
  { name: "solana: first contact", net: "solana", now: SOL_NOW, input: { cluster: "devnet", claimed: C, prior: null, nonce: "KBJ642BRQ7FHBNFK", issuedAt: "2026-09-13T12:19:10.655Z", expiresAt: "2027-09-13T12:19:10.655Z" } },
];

const base = JSON.parse(await readFile(new URL("../docs/evidence/base-sepolia.json", import.meta.url), "utf8"));
const W = base.wallets;
const plan = [
  ["base: legitimate rotation", W.payee, W.prior, 0, 1],
  ["base: mailbox takeover", W.attacker, W.prior, 0, null],
  ["base: conflicting rotation hash", W.payee, W.prior, 0, 1],
  ["base: hash from the wrong sender", W.payee, null, 0, null],
  ["base: first contact", W.payee, null, 0, null],
];
const ran = Date.parse(base.ranAt);
for (const [i, [name, claimed, prior, ci, ri]] of plan.entries()) {
  const r = base.results[i];
  const h = (n) => r.txs[n].split("/tx/")[1];
  const tx = await (await fetch(UPSTREAM.base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [h(ci)] }) })).json();
  const nonce = Buffer.from(tx.result.input.slice(2), "hex").toString("utf8").split(":")[2];
  cases.push({ name, net: "base", now: ran + 3600 * 1000, input: { cluster: "base-sepolia", claimed, prior, nonce, issuedAt: new Date(ran - 3600 * 1000).toISOString(), expiresAt: new Date(ran + 72 * 3600 * 1000).toISOString(), controlTx: h(ci), ...(ri != null ? { rotationTx: h(ri) } : {}) } });
}

for (const c of cases) {
  const v = await verify({ ...c.input, rpc: `http://127.0.0.1:${port}/${c.net}`, now: c.now });
  c.expected = v.verdict;
  console.log(`${c.name} -> ${v.verdict}`);
}
server.close();

await mkdir(new URL("../docs/evidence/golden/", import.meta.url), { recursive: true });
const out = {
  about: "Real RPC responses recorded from Solana devnet and Base Sepolia for mermail-countersig. Replayed offline by tests/countersig.mjs; each case's verdict must stay identical.",
  recordedAt: new Date().toISOString(),
  sources: UPSTREAM,
  cases,
  responses: recorded,
};
await writeFile(new URL("../docs/evidence/golden/countersig-golden.json", import.meta.url), `${JSON.stringify(out)}\n`);
console.log(`\nsaved ${cases.length} cases, ${Object.keys(recorded.solana).length + Object.keys(recorded.base).length} responses`);
