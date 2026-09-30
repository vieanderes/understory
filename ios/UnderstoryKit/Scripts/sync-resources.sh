#!/bin/sh
# Writes the files the Swift package embeds from the web repo (Scripts/build-resources.ts
# lists them). Run it after `pnpm exec tsx scripts/build-sandbox.ts` changes
# public/sandbox, or after the sucrase, pyodide or Python harness versions change.
# `--check` exits 1 when a copy is stale, for CI.
set -eu

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"

if [ ! -f "$repo/public/sandbox/harness.v1.js" ]; then
  echo "Missing public/sandbox/harness.v1.js. Run: pnpm exec tsx scripts/build-sandbox.ts" >&2
  exit 1
fi

cd "$repo"
exec pnpm exec tsx ios/UnderstoryKit/Scripts/build-resources.ts "$@"
