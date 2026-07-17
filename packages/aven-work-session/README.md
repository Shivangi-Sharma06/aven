# aven-stellar

[![npm version](https://img.shields.io/npm/v/aven-stellar.svg)](https://www.npmjs.com/package/aven-stellar)

`aven-stellar` records a privacy-conscious Git work session for an existing Aven payment stream and submits a structured report to the Aven dashboard. It gives workers a reviewable record of what changed during a work period without running the project or uploading complete source files.

## Requirements

- Node.js 20 or newer
- A Git repository
- An existing Aven stream in which the worker is the recipient
- Access to the Aven dashboard and Freighter for the first authorization

## Install

Run the CLI without installing it globally:

```bash
npx aven-stellar start
npx aven-stellar stop
```

Or install both the `aven` and `aven-stellar` command aliases globally:

```bash
npm install --global aven-stellar
aven start
aven stop
```

## Typical workflow

1. Open a terminal inside the Git repository where the work will happen.
2. Start a session and select the existing Aven stream.
3. Work normally and commit changes when appropriate.
4. Stop the session, review its report, and submit it to the dashboard.

```bash
npx aven-stellar start

# Work normally in the repository.

npx aven-stellar stop
```

On first use, `start` asks for the dashboard URL and stream ID, then opens the dashboard for wallet authorization. Use `http://localhost:3000` when testing against a local Aven server. After authorization it launches a lightweight background activity watcher. `stop` calculates the Git change statistics, shows the complete report, and asks before submission.

The submitted report appears under `WORK SESSIONS` on the matching stream page. The worker can request review, and the stream sender can approve or dispute the request.

## Command options

```bash
npx aven-stellar start --stream <stream-id> --dashboard <url>
npx aven-stellar stop --message <summary>
```

- `start --non-interactive` skips the collection confirmation.
- `stop --submit` submits the previewed report without another prompt.
- `--message` supplies the worker's summary of the session.
- The payment amount is calculated automatically from tracked active seconds and the stream's on-chain rate, capped by currently earned funds.

## Privacy and safety

The report includes session timing, the active Git branch, commit metadata, relative changed paths, and additions/deletions. The package creates `.avenignore` with safe defaults and also respects `.gitignore`.

The package never:

- requests a Stellar secret key;
- executes project code or tests;
- installs project dependencies;
- records keystrokes or screenshots;
- uploads complete source files; or
- reads paths excluded by `.gitignore` or `.avenignore`.

Local, recoverable session state is stored under `.aven/`. Do not commit that directory.

## Automated workers

An AI worker uses the same payment stream and review workflow as a human worker. Once its repository has been authorized, automation can use the non-interactive flags:

```bash
npx aven-stellar start --non-interactive
npx aven-stellar stop \
  --message "Implemented the assigned validation changes" \
  --submit
```

## Current enforcement boundary

Work-session review is enforced on-chain in the current release. When the Aven dashboard verifies a session report, the stream contract's `verify_work` function is called atomically: funds are transferred to the worker and an attestation record is minted in a single transaction. If either step fails the entire transaction reverts — the worker receives no funds and no attestation. The stream contract and the attestation contract are authoritative for on-chain state.

## Package development

From this repository:

```bash
cd packages/aven-work-session
npm install
npm run typecheck
npm run build
```

Package page: [npmjs.com/package/aven-stellar](https://www.npmjs.com/package/aven-stellar)
