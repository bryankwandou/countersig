// Live Mermail round-trip for Countersig, run in CI with a MERMAIL_API_KEY secret.
// Uses only the workspace's own mailbox: the challenge is self-addressed, the receipt is a draft.
// Run locally: MERMAIL_API_KEY=... node tests/live-mermail.mjs
import { challenge, checkReceipt, receipt, verify } from "../skill/scripts/countersig.mjs";

const RAW = process.env.MERMAIL_API_KEY ?? "";
// The secret may be a whole key file; use the key token if one is present.
const KEY = (RAW.match(/sk-proj-[A-Za-z0-9_-]+/)?.[0] ?? RAW.replace(/^﻿/, "")).trim();
if (!KEY) {
  console.log("MERMAIL_API_KEY not set; skipping live Mermail run");
  process.exit(0);
}
const MCP = "https://console.mermail.app/mcp";
let session;
async function rpc(method, params, notify = false) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "x-api-key": KEY, ...(session ? { "mcp-session-id": session } : {}) },
    body: JSON.stringify(notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  session = res.headers.get("mcp-session-id") ?? session;
  const text = await res.text();
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status}`);
  if (notify) return null;
  const line = (res.headers.get("content-type") ?? "").includes("event-stream") ? text.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5)).pop() : text;
  const json = JSON.parse(line);
  if (json.error) throw new Error(`${method}: ${json.error.message}`);
  return json.result;
}
const tool = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  if (r.isError) throw new Error(`${name}: ${JSON.stringify(r.content).slice(0, 300)}`);
  return r.structuredContent ?? JSON.parse(r.content?.[0]?.text ?? "null");
};

const steps = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    const detail = await fn();
    steps.push({ name, ok: true, ms: Date.now() - t, detail });
    console.log(`pass  ${name}${detail ? `  ${detail}` : ""}`);
  } catch (error) {
    steps.push({ name, ok: false, error: error.message });
    console.log(`FAIL  ${name}  ${error.message}`);
    throw error;
  }
};

const RUN = new Date().toISOString();
try {
  await step("initialize MCP session", async () => {
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "countersig-ci", version: "1.0" } });
    await rpc("notifications/initialized", {}, true);
  });

  const required = ["list_mailboxes", "search_emails", "get_email_context", "send_email", "save_draft", "list_folders", "create_folder", "move_email"];
  await step("every tool the skill composes exists on the hosted server", async () => {
    const names = new Set((await rpc("tools/list", {})).tools.map((t) => t.name));
    const missing = required.filter((n) => !names.has(n));
    if (missing.length) throw new Error(`missing ${missing.join(", ")}`);
    return `${required.length} tools present`;
  });

  let box;
  await step("list_mailboxes", async () => {
    const r = await tool("list_mailboxes", {});
    box = (r.items ?? r)[0];
    if (!box?.public_id || !box?.email) throw new Error("no mailbox");
    return "mailbox resolved";
  });

  // Recorded devnet rotation: real on-chain proof, re-read now.
  const recorded = { claimed: "5xqQGYCkXE6mA5Djh4phvzE1xHMRqm4K33uacNg86qJ9", prior: "66ahMx2mUV3a4X2Hyoe6SXv4tBmmCtariKvvyCZ8sv98", nonce: "6ENQ1W0CBV8Q94TB", issuedAt: "2026-09-14T01:05:42.057Z", expiresAt: "2027-09-14T01:05:42.057Z", cluster: "devnet" };

  let c;
  await step("challenge email built and sent once, self-addressed", async () => {
    c = challenge({ claimed: recorded.claimed, prior: recorded.prior, channel: box.email, counterparty: "Countersig CI", cluster: "devnet" });
    if (c.email.to !== box.email) throw new Error("challenge recipient is not the trusted channel");
    const sent = await tool("send_email", {
      mailboxId: box.public_id,
      body: { to: c.email.to, subject: `${c.email.subject} [CI ${RUN}]`, text: c.email.text, html: c.email.html, from: { email: box.email, name: "Countersig CI" } },
      idempotencyKey: `countersig-ci-${c.nonce}`,
    });
    return `status ${sent?.status ?? "accepted"}`;
  });

  let v;
  await step("verify recorded rotation on live devnet", async () => {
    v = await verify(recorded);
    if (v.verdict !== "VERIFIED_CONTINUITY") throw new Error(`got ${v.verdict}`);
    return v.verdict;
  });

  let r;
  await step("receipt saved as a draft to the mailbox itself", async () => {
    r = receipt(v, { nonce: recorded.nonce, claimed: recorded.claimed, counterparty: "Countersig CI", channel: box.email, issuedAt: recorded.issuedAt, expiresAt: recorded.expiresAt });
    const d = await tool("save_draft", { mailboxId: box.public_id, body: { to: box.email, from: { email: box.email }, subject: `${r.subject} [CI ${RUN}]`, text: r.text } });
    return `draft ${d?.status ?? "saved"}`;
  });

  await step("receipt read back through search_emails and accepted only as our own draft", async () => {
    let found;
    for (let i = 0; i < 6 && !found; i += 1) {
      const res = await tool("search_emails", { mailboxId: box.public_id, query: { subject: `[CI ${RUN}]`, folder: "draft", limit: 5 } });
      found = (res.emails ?? res.items ?? []).find((e) => String(e.subject).includes(r.subject));
      if (!found) await new Promise((ok) => setTimeout(ok, 2000));
    }
    if (!found) throw new Error("draft not found by search");
    const own = await checkReceipt({ text: r.text, origin: "draft" });
    const inbound = await checkReceipt({ text: r.text, origin: "inbound" });
    if (own.level !== "self_written_unanchored" || inbound.level !== "untrusted") throw new Error(`levels ${own.level}/${inbound.level}`);
    return "draft found; own draft needs user confirmation, same text inbound is untrusted";
  });

  console.log(`\n${steps.length} of ${steps.length} live Mermail steps pass`);
} catch {
  console.log(`\n${steps.filter((s) => s.ok).length} of ${steps.length} live Mermail steps pass`);
  process.exitCode = 1;
}
