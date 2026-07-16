#!/usr/bin/env bash
set -euo pipefail

: "${STELLAR_SOURCE:?Set STELLAR_SOURCE to a funded Stellar CLI identity alias}"
: "${OWNER:?Set OWNER to the owner G-address}"
: "${AGENT:?Set AGENT to the runner agent G-address}"
: "${STREAM_CONTRACT:?Set STREAM_CONTRACT to the deployed Stream C-address}"
: "${ALLOWED_ASSET:?Set ALLOWED_ASSET to the allowed SAC C-address}"
: "${EXPIRES_AT_LEDGER:?Set EXPIRES_AT_LEDGER to a future ledger}"

PER_STREAM_LIMIT="${PER_STREAM_LIMIT:-100000000}"
WINDOW_LIMIT="${WINDOW_LIMIT:-500000000}"
WINDOW_LEDGERS="${WINDOW_LEDGERS:-17280}"
MAX_DURATION_LEDGERS="${MAX_DURATION_LEDGERS:-120960}"
MAX_CHECKPOINT_COUNT="${MAX_CHECKPOINT_COUNT:-12}"
HUMAN_APPROVAL_THRESHOLD="${HUMAN_APPROVAL_THRESHOLD:-50000000}"

POLICY="{\"agent_can_approve_checkpoints\":false,\"enforce_recipient_allowlist\":true,\"expires_at_ledger\":${EXPIRES_AT_LEDGER},\"human_approval_threshold\":${HUMAN_APPROVAL_THRESHOLD},\"max_checkpoint_count\":${MAX_CHECKPOINT_COUNT},\"max_duration_ledgers\":${MAX_DURATION_LEDGERS},\"per_stream_limit\":${PER_STREAM_LIMIT},\"window_ledgers\":${WINDOW_LEDGERS},\"window_limit\":${WINDOW_LIMIT}}"

stellar contract deploy \
  --wasm target/wasm32v1-none/release/agent_mandate_contract.wasm \
  --source-account "$STELLAR_SOURCE" \
  --network testnet \
  --alias agent-mandate \
  -- \
  --owner "$OWNER" \
  --agent "$AGENT" \
  --stream-contract "$STREAM_CONTRACT" \
  --allowed-assets "[\"$ALLOWED_ASSET\"]" \
  --policy "$POLICY"
