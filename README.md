# Aven

**A protocol for verified work payments, portable attestations, and on-chain reputation on Stellar.**

Aven turns measured work into verifiable work history. Clients fund escrow, the `aven-stellar` npm package measures active work time, and the contract releases only the amount justified by that session.

The repository contains the Aven web app, its editorial GSAP-powered landing page, the Aven protocol contracts, generated TypeScript bindings, and the `aven-stellar` work-session package. The enhanced stream build is ready for its first testnet deployment.

## How it works

```mermaid
flowchart LR
  A["npm work session<br/>Measures active seconds"] --> B["Stream contract<br/>Reserves exact payment"]
  B --> C["Attestation contract<br/>Records released work"]
  C --> D["Reputation contract<br/>Scores completed projects once"]
```

- **Stream** — escrows USDC or XLM and validates `active seconds × rate` for each npm session.
- **Verified releases** — ties exact session payments to verifier records, client review, and timeout release.
- **Attestation** — mints permanent records for released work sessions and final project completion.
- **Reputation** — calculates one stable score from each completed project; ledger time cannot change it.

## Product surfaces

- `/` — monochrome editorial landing page with a GSAP layered-pinning scroll loop
- `/dashboard` — sent and received payment streams
- `/stream/create` — create a new stream
- `/stream/[id]` — inspect and manage a stream
- `/profile/[address]` — public work history and reputation
- `/verify` — verify an attestation or reputation claim
- `/agents` — on-chain reputation lookup for human and AI workers
- `/cli/authorize` — wallet-signed authorization for the local work-session CLI
- `/stream/[id]` — also contains the client/worker work-session review ledger

## Tech stack

- Next.js 15, React 19, and TypeScript
- GSAP, ScrollTrigger, and `@gsap/react`
- Stellar SDK and Freighter wallet
- Soroban smart contracts written in Rust
- Generated TypeScript clients for each contract
- Upstash Redis for shared production work-session and CLI authorization state
- Mantine primitives and Lucide icons

## Run locally

### Prerequisites

- Node.js 20 or newer
- npm
- [Freighter](https://www.freighter.app/) configured for Stellar testnet to use wallet features
- Rust and the `wasm32v1-none` target only if you plan to build or test the contracts

### Start the web app

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The testnet RPC endpoint, network passphrase, and asset contract IDs are defined in `lib/contracts.ts`. Contract deployment IDs come from `NEXT_PUBLIC_STREAM_CONTRACT_ID`, `NEXT_PUBLIC_ATTESTATION_CONTRACT_ID`, and `NEXT_PUBLIC_REPUTATION_CONTRACT_ID`.

Local development can use file-backed session state. Production requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` so sessions and CLI authorizations are shared across devices and serverless instances.

## Validation

```bash
npm run typecheck
npm run build
```

Contract tests run from the Rust workspace:

```bash
cd contracts
cargo test
```

## Work sessions

[`aven-stellar`](https://www.npmjs.com/package/aven-stellar) is the published CLI that connects Git activity to an existing Aven stream without executing project code or collecting full file contents. It requires Node.js 20 or newer and must be run inside a Git repository:

```bash
npx aven-stellar start

# After working in the connected repository:
npx aven-stellar stop
```

For a global installation, run `npm install --global aven-stellar` and use `aven start` / `aven stop`. Both `aven` and `aven-stellar` are installed as command aliases.

On first use, `start` asks for the Aven dashboard URL and stream ID, opens `/cli/authorize`, and asks the stream recipient to sign a short-lived device authorization with Freighter. For local development, use `http://localhost:3000` as the dashboard URL. The resulting token can read that worker's streams, submit sessions, and request review; it cannot create streams or approve the worker's own request.

The CLI creates `.avenignore` with private-file defaults, records relative paths and Git statistics, and stores recoverable local state under `.aven/`. `stop` calculates the session report and previews it before submission. Submitted sessions appear in the `WORK SESSIONS` section on `/stream/[id]`, where the worker can request review and the stream sender can approve or dispute the request.

The report contains session timing, branch and commit metadata, file-level change statistics, and the worker's statement. Its payment amount is calculated automatically from tracked active seconds and the stream's on-chain rate, capped by unreserved escrow; workers do not enter their own amount. The contract independently checks the same calculation before reserving funds. The report does not contain complete source files, keystrokes, screenshots, environment files, wallet secret keys, or excluded paths. The CLI never executes the tracked project or installs its dependencies.

Checkpoint and ledger-time unlocking are intentionally disabled. The configured verifier records the npm session's exact amount and report hash before the approval/dispute/timeout flow begins. The dashboard uses `NEXT_PUBLIC_STREAM_CONTRACT_ID`, while the server signs verification with `AVEN_VERIFIER_SECRET`.

To build the contract WASM artifacts:

```bash
rustup target add wasm32v1-none
cd contracts
stellar contract build --package stream_contract
```

## Repository structure

```text
app/                    Next.js routes and global styles
components/             Wallet, navigation, app shell, and landing sections
components/sections/    Aven protocol panels and infinite layered loop
contracts/              Soroban Rust workspace
  bindings/             Generated TypeScript clients for deployed contracts
  contracts/stream_contract/
  contracts/attestation_contract/
  contracts/reputation_contract/
  contracts/shared/
lib/contracts.ts        Testnet config and contract client factories
lib/stellar.ts          Wallet and on-chain application operations
packages/aven-work-session/ Source for the published `aven-stellar` CLI
```

## Testnet deployment

The frontend is currently wired to Stellar testnet:

| Contract | Address |
| --- | --- |
| Stream | `CAZ53PKMFJOJCK2GC6MZI3TID35UL6B4X5OJ5HV4U5VQ2MLIJUK34NXD` |
| Attestation | `CC34BWDMECEJ3XI5ZY7KRYYLIEC5Y2HKOKRCG4GGEKG7LAPH6AN7VLV4` |
| Reputation | `CAUU3K3JMUQZCPEQAM34X5UX3OVV6RVKOQLAC4BG4MTBMXMSYLBLZHJ2` |

Amounts use Stellar's seven-decimal fixed-point representation. The frontend converts human-readable values at the client boundary in `lib/contracts.ts`.

## Development notes

- The landing-page loop is desktop-only. Mobile renders the same content as a normal stacked document flow.
- The duplicate final panel is an internal loop bridge and is excluded from pin and snap calculations.
- Freighter signs transactions in the browser; secret keys are never stored by the app.
- AI agents participate as workers: their wallet address is the recipient of an ordinary Aven payment stream.
- Contract bindings must be regenerated or updated after deploying a new contract version or changing a contract interface.

## Status

Aven is under active development and currently targets Stellar testnet. Do not treat testnet balances, attestations, or reputation scores as production records.
