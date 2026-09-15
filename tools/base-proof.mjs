// Live Base Sepolia proof suite. Run it yourself; private keys never leave this process and are never printed.
//   node tools/base-proof.mjs --wallet-file "E:\Download\wallet hackaton darurat.txt"
// The file may contain other text: every 32-byte hex string is tried, and the one holding the most
// Base Sepolia ETH is used as the "prior" wallet. Two throwaway wallets (new payee, attacker) are created
// in memory and funded with a few cents of test ETH for gas.
// Output: docs/evidence/base-sepolia.json (addresses, tx hashes, verdicts only).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { challenge, controlMemo, rotateMemo, verify } from "../skill/scripts/countersig.mjs";
import { EVM_CHAINS, addressFromPrivateKey, evmExplorer, keccak256, newEvmKey, rlp, sendEvmMemo, signHash } from "../skill/scripts/evm.mjs";

const CLUSTER = "base-sepolia";
const { rpc: RPC, chainId } = EVM_CHAINS[CLUSTER];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function call(method, params) {
  const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const json = await res.json();
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}
const eth = (wei) => (Number(BigInt(wei)) / 1e18).toFixed(6);
const intBytes = (n) => (BigInt(n) === 0n ? Buffer.alloc(0) : Buffer.from(BigInt(n).toString(16).padStart(Math.ceil(BigInt(n).toString(16).length / 2) * 2, "0"), "hex"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendValue(from, to, wei) {
  const [nonce, gasPrice, tip] = await Promise.all([call("eth_getTransactionCount", [from.address, "pending"]), call("eth_gasPrice", []), call("eth_maxPriorityFeePerGas", []).catch(() => "0x5f5e100")]);
  const maxFee = BigInt(gasPrice) * 2n + BigInt(tip);
  const fields = [intBytes(chainId), intBytes(nonce), intBytes(tip), intBytes(maxFee), intBytes(21000), Buffer.from(to.slice(2), "hex"), intBytes(wei), Buffer.alloc(0), []];
  const { r, s, yParity } = signHash(keccak256(Buffer.concat([Buffer.from([2]), rlp(fields)])), from.secret);
  const raw = Buffer.concat([Buffer.from([2]), rlp([...fields, intBytes(yParity), intBytes(r), intBytes(s)])]);
  const hash = await call("eth_sendRawTransaction", [`0x${raw.toString("hex")}`]);
  for (let i = 0; i < 60; i += 1) {
    const receipt = await call("eth_getTransactionReceipt", [hash]);
    if (receipt) return hash;
    await sleep(1000);
  }
  throw new Error(`funding not confirmed: ${hash}`);
}

// ---- pick the funded wallet without ever printing a key ----
async function main() {
  const file = arg("wallet-file");
  if (!file) throw new Error('usage: node tools/base-proof.mjs --wallet-file "<path to your wallet txt>"');
  const text = await readFile(file, "utf8");
  const candidates = [...new Set([...text.matchAll(/(?<![0-9a-fA-F])(?:0x)?([0-9a-fA-F]{64})(?![0-9a-fA-F])/g)].map((m) => m[1].toLowerCase()))];
  let prior = null;
  let best = -1n;
  for (const hex of candidates) {
    const secret = Buffer.from(hex, "hex");
    let address;
    try {
      address = addressFromPrivateKey(secret);
    } catch {
      continue;
    }
    const bal = BigInt(await call("eth_getBalance", [address, "latest"]));
    if (bal > best) {
      best = bal;
      prior = { secret, address };
    }
}
  if (!prior || best === 0n) throw new Error(`no hex key in that file holds Base Sepolia ETH (checked ${candidates.length} candidates)`);
  console.log(`prior wallet ${prior.address} balance ${eth(best)} ETH (key stays local)`);
  if (best < 30000000000000n) throw new Error("need at least 0.00003 ETH on Base Sepolia for the suite");

  const mk = () => {
    const k = newEvmKey();
    return { secret: Buffer.from(k.privateKey.slice(2), "hex"), address: k.address };
  };
  const payee = mk();
  const attacker = mk();
  const gasEach = best / 5n;
  console.log(`funding throwaway payee ${payee.address} and attacker ${attacker.address} with ${eth(gasEach)} ETH each`);
  const funding = [await sendValue(prior, payee.address, gasEach), await sendValue(prior, attacker.address, gasEach)];
  await sleep(3500);

  const results = [];
  const run = async (name, expected, fn) => {
    try {
      const { verdict, txs } = await fn();
      const pass = verdict.verdict === expected;
      results.push({ name, expected, actual: verdict.verdict, pass, reason: verdict.reason ?? null, txs });
      console.log(`${pass ? "PASS" : "FAIL"}  ${name}  expected=${expected} actual=${verdict.verdict}`);
    } catch (error) {
      results.push({ name, expected, actual: "ERROR", pass: false, reason: error.message });
      console.log(`FAIL  ${name}  ${error.message}`);
    }
  };
  const fresh = (claimed, withPrior = true) => challenge({ claimed, prior: withPrior ? prior.address : undefined, channel: "billing@vendor.example", counterparty: "Vendor", cluster: CLUSTER, now: Date.now() - 60000 });
  const check = async (c, extra) => { await sleep(2500); for (let i = 0; i < 15; i++) { try { const v = await verify({ claimed: c.claimed, prior: c.prior, nonce: c.nonce, issuedAt: c.issuedAt, expiresAt: c.expiresAt, cluster: CLUSTER, ...extra }); if (v.verdict === 'PENDING' && extra.rotationTx && i < 14) { await sleep(2000); continue; } return v; } catch (e) { if (i < 14) { await sleep(1500); continue; } throw e; } } };

  await run("legitimate rotation on Base", "VERIFIED_CONTINUITY", async () => {
    const c = fresh(payee.address);
    const ctl = await sendEvmMemo({ key: payee, memo: controlMemo(c.nonce), cluster: CLUSTER });
    const rot = await sendEvmMemo({ key: prior, memo: rotateMemo(c.nonce, payee.address), cluster: CLUSTER });
    return { verdict: await check(c, { controlTx: ctl.signature, rotationTx: rot.signature }), txs: [ctl.explorer, rot.explorer] };
});
  await run("mailbox takeover: attacker signs, prior wallet never countersigns", "PENDING", async () => {
    const c = fresh(attacker.address);
    const ctl = await sendEvmMemo({ key: attacker, memo: controlMemo(c.nonce), cluster: CLUSTER });
    return { verdict: await check(c, { controlTx: ctl.signature }), txs: [ctl.explorer] };
});
  await run("attacker submits the prior wallet's hash for a different rotation", "MISMATCH", async () => {
    const c = fresh(payee.address);
    const ctl = await sendEvmMemo({ key: payee, memo: controlMemo(c.nonce), cluster: CLUSTER });
    const rot = await sendEvmMemo({ key: prior, memo: rotateMemo(c.nonce, attacker.address), cluster: CLUSTER });
    return { verdict: await check(c, { controlTx: ctl.signature, rotationTx: rot.signature }), txs: [ctl.explorer, rot.explorer] };
});
  await run("hash from the wrong sender", "PENDING", async () => {
    const c = fresh(payee.address, false);
    const ctl = await sendEvmMemo({ key: attacker, memo: controlMemo(c.nonce), cluster: CLUSTER });
    return { verdict: await check(c, { controlTx: ctl.signature }), txs: [ctl.explorer] };
});
  await run("first contact on Base", "VERIFIED_CHANNEL", async () => {
    const c = fresh(payee.address, false);
    const ctl = await sendEvmMemo({ key: payee, memo: controlMemo(c.nonce), cluster: CLUSTER });
    return { verdict: await check(c, { controlTx: ctl.signature }), txs: [ctl.explorer] };
});

  const passed = results.filter((r) => r.pass).length;
  const out = { suite: "countersig base-sepolia live", ranAt: new Date().toISOString(), passed, total: results.length, wallets: { prior: prior.address, payee: payee.address, attacker: attacker.address }, funding: funding.map((h) => evmExplorer(h, CLUSTER)), results };
  await mkdir(path.join(ROOT, "docs", "evidence"), { recursive: true });
  await writeFile(path.join(ROOT, "docs", "evidence", "base-sepolia.json"), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`\n${passed} of ${results.length} Base Sepolia scenarios pass. Evidence: docs/evidence/base-sepolia.json`);
  process.exitCode = passed === results.length ? 0 : 1;
}

main().catch((error) => {
  console.error(`stopped: ${error.message}`);
  process.exitCode = 1;
});
