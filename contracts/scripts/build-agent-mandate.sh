#!/usr/bin/env bash
set -euo pipefail

RUSTC_PATH="${RUSTC_PATH:-$HOME/.rustup/toolchains/stable-aarch64-apple-darwin/bin/rustc}"
if [[ ! -x "$RUSTC_PATH" ]]; then
  RUSTC_PATH="$(command -v rustc)"
fi

RUSTC="$RUSTC_PATH" cargo build \
  -p agent_mandate_contract \
  --target wasm32v1-none \
  --release

stellar contract bindings typescript \
  --wasm target/wasm32v1-none/release/agent_mandate_contract.wasm \
  --output-dir bindings/agent_mandate

echo "Built WASM and refreshed bindings/agent_mandate."
