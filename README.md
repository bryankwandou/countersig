# Countersig

[![ci](https://github.com/bryankwandou/countersig/actions/workflows/ci.yml/badge.svg)](https://github.com/bryankwandou/countersig/actions/workflows/ci.yml)

An email can ask. The wallet has to sign.

Countersig is a Mermail Agent Skill that stops payout-address fraud before an AI agent pays. When a vendor emails a new wallet, the agent sends a one-time challenge only to the address it already trusts, then checks on-chain that the new wallet signed and the previously paid wallet countersigned.

- Live verifier and signer: https://countersig.vercel.app
- Skill pull request: https://github.com/Nudgen-Marketing/mermail-skills/pull/268
- Demo video: https://youtu.be/bR7C0wAPqm0

![Landing page](docs/web-home.png)

## What this repo contains

| Path | Purpose |
| --- | --- |
| `app/` | Landing page, `/sign` (payee signs the memo in Phantom, Solflare or Backpack), `/verify` (anyone re-checks a proof), `/proof` (real Mermail tool log and devnet transactions) |
| `lib/countersig.ts` | Browser port of the skill's verify rules for Solana and Base |
| `skill/scripts/` | Exact copy of the skill script from the PR branch. CI fails if it drifts |
| `tests/gate-check.mjs` | 21 offline cases for the payout gate |

## Trust ladder

| Rung | Proof | Payable |
| --- | --- | --- |
| L1 control | Claimed wallet signs `countersig:v1:<nonce>` | Never on its own |
| L2 channel | Nonce went only to the address from earlier authenticated mail | First contact: after a 24 h hold |
| L3 continuity | Prior wallet signs `countersig:v1:<nonce>:rotate:<new address>` | Yes, with user approval |

## Payout gate

`node skill/scripts/countersig.mjs gate --verdict-file verdict.json --amount-usd 40000 --payment-cluster mainnet-beta`

Returns `ALLOW_WITH_USER_APPROVAL`, `HOLD` or `BLOCK`. The policy lives in code, not in a prompt:

- A devnet proof never unlocks a mainnet payment; a Solana proof never unlocks a Base payment.
- A verdict older than 24 hours must be verified again.
- The payment destination must equal the verified wallet.
- First contact at 1,000 USD or more needs a call-back; split payments to one wallet are summed over 7 days.
- A lost old wallet needs a second independent channel and a 72 hour hold.
- `MISMATCH` and `LOOKALIKE` are hard stops.

## Verify it yourself

```bash
npm ci
npm run test:gate
npm run build
```

Or open https://countersig.vercel.app/verify, pick a preset, and your browser reads the public Solana RPC directly.

![Verifier](docs/web-verify.png)

## Limits

Countersig proves control of a key, not legal identity. If the vendor's old wallet key is also stolen, continuity can be forged. Base proofs need the payee to return a transaction hash, because EVM RPC cannot list transactions by sender. Nothing here moves funds.

## Languages

English by default, plus Bahasa Indonesia, Español, Tiếng Việt and 中文.
