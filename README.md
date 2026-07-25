<div align="center">

```text
 █████╗ ██╗   ██╗███████╗███╗   ██╗
██╔══██╗██║   ██║██╔════╝████╗  ██║
███████║██║   ██║█████╗  ██╔██╗ ██║
██╔══██║╚██╗ ██╔╝██╔══╝  ██║╚██╗██║
██║  ██║ ╚████╔╝ ███████╗██║ ╚████║
╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝

      Pay for verified work.
      Keep the proof.
```

### Pay for verified work. Keep the proof.

[Live Application](https://hey-aven.vercel.app) · Documentation · [npm Package](https://www.npmjs.com/package/aven-stellar)

![npm version](https://img.shields.io/npm/v/aven-stellar.svg)
![npm downloads](https://img.shields.io/npm/dm/aven-stellar.svg)
![License](https://img.shields.io/github/license/kartikeywastaken/aven-ste.svg)
![Stellar](https://img.shields.io/badge/Stellar-Testnet-08b5e5)

**🎉 `aven-stellar` has crossed 1,300 npm installs**

</div>

---

## Overview

Aven is a Stellar-based protocol for funding work, measuring active delivery, releasing exact payments, and building portable on-chain reputation.

Clients lock a project budget in a smart contract. Workers track privacy-conscious Git work sessions with the `aven-stellar` CLI. Each approved session releases exactly the amount justified by recorded active time — and leaves behind a verifiable, on-chain attestation.


## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [How It Works](#how-it-works)
- [Product Surfaces](#product-surfaces)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [The `aven-stellar` CLI](#the-aven-stellar-cli)
- [Privacy Boundary](#privacy-boundary)
- [Payment Enforcement](#payment-enforcement)
- [Testing](#testing)
- [Security Notes](#security-notes)
- [License](#license)

## Features

- 💰 Funded XLM and USDC work agreements on Stellar testnet
- ⏱️ Exact payment reservation based on verified active seconds and the stream rate
- 🔄 Full worker submission → client review → approval → dispute → release flow
- ✅ Final-project sessions with connected GitHub branch and commit verification
- 🪪 Portable work attestations and address-based reputation
- 🔐 Freighter wallet authentication — no wallet secret keys ever stored
- 🕵️ A privacy-conscious npm CLI that never uploads complete source files
- ☁️ Shared production persistence through Upstash Redis

## How It Works

1. A **client** creates a stream with a recipient, asset, budget, duration, and work verification type.
2. The **recipient** authorizes the local CLI by signing a short-lived device request with Freighter.
3. `aven-stellar` records active time and Git change statistics inside the selected repository.
4. The **worker** submits a reviewable work-session report to the matching stream.
5. The configured **verifier** reserves the contract-enforced payment amount.
6. The **client** approves or disputes the session — approved work releases payment and creates a permanent proof record.

## Product Surfaces

| Route | Purpose |
|---|---|
| `/` | Aven landing page and protocol overview |
| `/dashboard` | Sent and received payment streams |
| `/stream/create` | Guided four-step agreement creation |
| `/stream/[id]` | Stream funding, work sessions, review, and release |
| `/profile/[address]` | Public work attestations and reputation |
| `/verify` | Independent on-chain attestation verification |
| `/cli/authorize` | Wallet-signed local CLI authorization |
| `/register-sender` | Sender identity registration |

## Tech Stack

**Frontend** — Next.js 15 · React 19 · TypeScript · Mantine primitives · Lucide icons · GSAP + `@gsap/react`

**Blockchain** — Stellar SDK · Freighter · generated Soroban clients · Rust smart contracts on the Soroban SDK

**Infrastructure** — Upstash Redis for production session and authorization state

**Integrations** — GitHub App and OAuth for delivery verification

## Quick Start

### Requirements

- Node.js 20 or newer
- npm
- Freighter, configured for Stellar testnet
- Rust and the `wasm32v1-none` target — only if you're working on contracts

### Run the web application

```bash
git clone https://github.com/Shivangi-Sharma06/aven
cd aven
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app renders without a connected wallet, but stream, attestation, reputation, and verifier operations require the corresponding testnet contract IDs and a server signer.

## Environment Variables

Never commit `.env.local`, wallet secret keys, GitHub secrets, or Redis tokens.

**Stellar contracts**

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_STREAM_CONTRACT_ID` | Public | Deployed stream contract |
| `NEXT_PUBLIC_ATTESTATION_CONTRACT_ID` | Public | Deployed attestation contract |
| `NEXT_PUBLIC_REPUTATION_CONTRACT_ID` | Public | Deployed reputation contract |
| `AVEN_VERIFIER_SECRET` | Server only | Signs verified work claims |

The application currently uses Stellar testnet RPC, Horizon, network passphrase, native XLM SAC, and testnet USDC configuration from `lib/contracts.ts`.

**Persistence**

| Variable | Required | Purpose |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | Production | Shared Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Shared Redis credential |
| `AVEN_DATA_NAMESPACE` | Optional | Explicit deployment data namespace |
| `AVEN_SESSION_STORE` | Local only | File-backed work-session store |
| `AVEN_CLI_TOKEN_STORE` | Local only | File-backed CLI authorization store |

Local development can use the file-backed stores under `data/`. Production should use Redis so work sessions and CLI authorizations remain available across devices and serverless instances. When `AVEN_DATA_NAMESPACE` is omitted, the stream contract ID is used so a fresh deployment starts with a clean data set.

**GitHub integration**

| Variable | Purpose |
|---|---|
| `GITHUB_APP_ID` | GitHub App numeric ID |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App RSA private key |
| `GITHUB_APP_INSTALLATION_ID` | Installed Aven organization instance |
| `GITHUB_WEBHOOK_SECRET` | Validates GitHub webhook requests |
| `GITHUB_AVEN_ORG` | Organization that owns connected repositories |
| `GITHUB_OAUTH_CLIENT_ID` | Worker account linking |
| `GITHUB_OAUTH_CLIENT_SECRET` | OAuth server credential |
| `GITHUB_OAUTH_REDIRECT_URI` | Registered callback URL |

For Vercel or another single-line environment editor, store the private key in one value and replace its literal line breaks with `\n`. The server normalizes escaped newlines before creating the GitHub App client.

| Environment | Callback URL |
|---|---|
| Production | `https://your-domain.example/api/github/callback` |
| Local | `http://localhost:3000/api/github/callback` |

## The `aven-stellar` CLI

`aven-stellar` is the published Node.js CLI. The current package version in this repository is `0.3.0`, and it installs both `aven` and `aven-stellar` command aliases.

Run it without a global install:

```bash
npx aven-stellar start

# Work normally in the connected Git repository.

npx aven-stellar stop
```

Or install it globally:

```bash
npm install --global aven-stellar
aven start
aven stop
```

**Useful options**

```bash
npx aven-stellar start --stream <stream-id> --dashboard <url>
npx aven-stellar start --non-interactive
npx aven-stellar stop --message "Implemented the assigned changes"
npx aven-stellar stop --submit
npx aven-stellar stop --ended
```

| Flag | Effect |
|---|---|
| `start --non-interactive` | Skips the collection confirmation |
| `stop --message` | Includes a worker-written delivery summary |
| `stop --submit` | Submits the previewed report without a second prompt |
| `stop --ended` | Marks the session final, verifies selected delivery branches against the connected GitHub repository, and prepares the remaining unreserved escrow for client-approved release |

On first use, `start` asks for the dashboard URL and stream ID, opens `/cli/authorize`, and asks the stream recipient to sign with Freighter. The resulting token can read that worker's streams, submit sessions, and request review — it cannot create streams or approve the worker's own request.

> If a stopped session fails to submit, run `stop` again. The CLI keeps the original stop time and retries the same report instead of counting the delay as work.

## Privacy Boundary

| Tracked | Never touched |
|---|---|
| Session start, stop, and active time | Stellar secret keys |
| Branch and commit metadata | Executing the tracked project, tests, or scripts |
| Relative changed paths | Installing project dependencies |
| Additions, deletions, and Git status | Keystrokes or screenshots |
| The worker's delivery statement | Complete source files |
| — | Paths excluded by `.gitignore` or `.avenignore` |

Recoverable local state is stored under `.aven/`. Do not commit that directory.

## Payment Enforcement

For a normal session, the verifier reserves:

```
verified active seconds × stream rate
```

The amount is capped by the stream's unreserved escrow, and the smart contract independently checks the calculation. Workers never enter their own payment amount.

For `--ended`, the server converts the remaining escrow into a contract-compatible duration while preserving the real npm-tracked active seconds in the report. Pending or reserved payments must be resolved before a final session can be submitted. Final release still requires explicit client review in the web application.

## Testing

**Application checks**

```bash
npm run typecheck
npm test
npm run build
```

**CLI package tests**

```bash
npm --prefix packages/aven-work-session test
```

**Contract tests**

```bash
cd contracts
cargo test --workspace
```

**Build the stream contract**

```bash
rustup target add wasm32v1-none
cd contracts
stellar contract build --package stream_contract
```

## Security Notes

- Freighter signs browser transactions; the app never stores a user's wallet secret.
- `AVEN_VERIFIER_SECRET`, Redis credentials, and GitHub secrets must remain server-only.
- CLI device authorization is wallet-signed, scoped, and short-lived.
- Contract bindings must be regenerated after changing or redeploying a contract interface.
- Testnet balances, attestations, and reputation records are not production assets.

---

<div align="center">

Built on [Stellar](https://stellar.org) · Powered by [Soroban](https://soroban.stellar.org)

</div>