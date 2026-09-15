// Offline red-team checks against a local mock JSON-RPC. Run: node tests/attack-check.mjs
import { createServer } from "node:http";
import { checkReceipt, receipt, receiptMemo, verify } from "../skill/scripts/countersig.mjs";
import { findEvmProof } from "../skill/scripts/evm.mjs";

const NOW = Math.floor(Date.now() / 1000);
const PRIOR = "66ahMx2mUV3a4X2Hyoe6SXv4tBmmCtariKvvyCZ8sv98";
const CLAIMED = "5xqQGYCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9";
const ATTACKER = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const ANCHOR = "Cs7CFiRrdAdgXEuNcYGhYKuZwEdMkbFqyu5UxA3qwrTN";
const NONCE = "6ENQ1W0CBV8Q94TB";

// state is swapped per case
let chain = { sigs: {}, txs: {}, evm: {} };
const server = createServer(async (req, res) => {
  let body = "";
  for await (const c of req) body += c;
  const { method, params } = JSON.parse(body);
  let result = null;
  if (method === "getSignaturesForAddress") {
    const [addr, { limit, before }] = params;
    const all = chain.sigs[addr] ?? [];
    const start = before ? all.findIndex((s) => s.signature === before) + 1 : 0;
    result = all.slice(start, start + limit);
  } else if (method === "getTransaction") result = chain.txs[params[0]] ?? null;
  else if (method === "eth_getTransactionByHash") result = chain.evm[params[0]]?.tx ?? null;
  else if (method === "eth_getTransactionReceipt") result = chain.evm[params[0]]?.receipt ?? null;
  else if (method === "eth_getBlockByNumber") result = { timestamp: `0x${(NOW - 60).toString(16)}` };
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result }));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const RPC_URL = `http://127.0.0.1:${server.address().port}`;

const memoTx = (sig, signer, memo, t) => {
  chain.txs[sig] = {
    slot: 1,
    blockTime: t,
    meta: { err: null },
    transaction: { message: { accountKeys: [{ pubkey: signer, signer: true }], instructions: [{ programId: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr", parsed: memo }] } },
  };
  return { signature: sig, blockTime: t, memo: `[${memo.length}] ${memo}` };
};
const noise = (n, t) => Array.from({ length: n }, (_, i) => ({ signature: `spam${i}`, blockTime: t, memo: null }));
const base = { claimed: CLAIMED, prior: PRIOR, nonce: NONCE, issuedAt: new Date((NOW - 3600) * 1000).toISOString(), expiresAt: new Date((NOW + 3600) * 1000).toISOString(), cluster: "devnet", rpc: RPC_URL };

const cases = [];
const check = (name, got, expected) => cases.push([name, got, expected]);

// 1. Flood hides a conflicting endorsement deep in the prior wallet's history
{
  chain = { sigs: {}, txs: {}, evm: {} };
  const ok = memoTx("good", PRIOR, `countersig:v1:${NONCE}:rotate:${CLAIMED}`, NOW - 100);
  const bad = memoTx("evil", PRIOR, `countersig:v1:${NONCE}:rotate:${ATTACKER}`, NOW - 200);
  chain.sigs[CLAIMED] = [memoTx("ctl", CLAIMED, `countersig:v1:${NONCE}`, NOW - 50)];
  chain.sigs[PRIOR] = [ok, ...noise(2500, NOW - 150), bad];
  const v = await verify(base);
  check("flood cannot hide a conflicting endorsement", v.verdict, "MISMATCH");
}
// 2. Flood beyond the scan budget fails closed
{
  chain.sigs[PRIOR] = [chain.sigs[PRIOR][0], ...noise(12000, NOW - 150)];
  const v = await verify(base);
  check("flood beyond scan budget is never verified", v.verdict, "PENDING");
}
// 3. Normal rotation still verifies
{
  chain.sigs[PRIOR] = [memoTx("good", PRIOR, `countersig:v1:${NONCE}:rotate:${CLAIMED}`, NOW - 100), ...noise(30, NOW - 150)];
  const v = await verify(base);
  check("legitimate rotation still verifies", v.verdict, "VERIFIED_CONTINUITY");
}
// 4. Attacker memo that only references the prior wallet (not signed by it)
{
  chain.txs.good.transaction.message.accountKeys = [{ pubkey: ATTACKER, signer: true }, { pubkey: PRIOR, signer: false }];
  const v = await verify(base);
  check("memo that merely mentions the prior wallet is not a countersignature", v.verdict, "PENDING");
}

// Receipts
const verdict = { type: "countersig.verdict", verdict: "VERIFIED_CONTINUITY", payable: true, cluster: "devnet", claimed: CLAIMED, prior: PRIOR, nonce: NONCE, checkedAt: new Date((NOW - 600) * 1000).toISOString(), evidence: null };
const challenge = { nonce: NONCE, claimed: CLAIMED, counterparty: "Acme", channel: "billing@acme.example", issuedAt: base.issuedAt, expiresAt: base.expiresAt };
const real = receipt(verdict, challenge);
// 5. Attacker emails a well-formed receipt naming their own wallet
{
  const forged = receipt({ ...verdict, claimed: ATTACKER }, { ...challenge, claimed: ATTACKER });
  const r = await checkReceipt({ text: forged.text, origin: "inbound", rpcUrl: RPC_URL });
  check("inbound receipt naming attacker wallet is untrusted", r.level, "untrusted");
}
// 6. Tampered receipt text
{
  const tampered = real.text.replace(/^Wallet: .*/m, `Wallet: ${ATTACKER} (devnet)`).replace(/^Receipt data: (.*)$/m, (_, d) => `Receipt data: ${Buffer.from(Buffer.from(d, "base64url").toString().replace(CLAIMED, ATTACKER)).toString("base64url")}`);
  const r = await checkReceipt({ text: tampered, origin: "draft", rpcUrl: RPC_URL });
  check("edited receipt data fails sha256", r.level, "untrusted");
}
// 7. Our own draft without an anchor needs user confirmation
{
  const r = await checkReceipt({ text: real.text, origin: "draft", rpcUrl: RPC_URL });
  check("own draft without anchor needs user confirmation", r.level, "self_written_unanchored");
}
// 8. Anchored by our anchor wallet
{
  chain.sigs[ANCHOR] = [memoTx("anc", ANCHOR, receiptMemo(real.sha256), NOW - 300)];
  const r = await checkReceipt({ text: real.text, origin: "inbound", anchorWallet: ANCHOR, rpcUrl: RPC_URL });
  check("receipt anchored by our wallet is trusted", r.level, "anchored");
}
// 9. Anchor memo signed by someone else
{
  chain.sigs[ANCHOR] = [memoTx("anc2", ATTACKER, receiptMemo(real.sha256), NOW - 300)];
  const r = await checkReceipt({ text: real.text, origin: "inbound", anchorWallet: ANCHOR, rpcUrl: RPC_URL });
  check("anchor memo signed by another wallet is untrusted", r.level, "untrusted");
}
// 10. Base: legacy transaction without chain id
{
  const from = "0x1111111111111111111111111111111111111111";
  const memo = `countersig:v1:${NONCE}`;
  chain.evm["0x" + "a".repeat(64)] = { tx: { from, to: from, input: "0x" + Buffer.from(memo).toString("hex") }, receipt: { status: "0x1", blockNumber: "0x10" } };
  const r = await findEvmProof({ cluster: "base-sepolia", rpcUrl: RPC_URL, address: from, expected: memo, txHash: "0x" + "a".repeat(64), notBefore: NOW - 3600, notAfter: NOW });
  check("Base legacy tx without chain id is rejected", r.found, false);
  chain.evm["0x" + "a".repeat(64)].tx.chainId = "0x14a34";
  const r2 = await findEvmProof({ cluster: "base-sepolia", rpcUrl: RPC_URL, address: from, expected: memo, txHash: "0x" + "a".repeat(64), notBefore: NOW - 3600, notAfter: NOW });
  check("Base tx with matching chain id is accepted", r2.found, true);
}

server.close();
let failed = 0;
for (const [name, got, expected] of cases) {
  const ok = got === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}  -> ${got}${ok ? "" : ` (expected ${expected})`}`);
}
console.log(`\n${cases.length - failed} of ${cases.length} attack cases pass`);
process.exitCode = failed ? 1 : 0;
