#!/usr/bin/env bash
# Start the Atria solver. PYTHONHASHSEED=0 pins set-iteration order so CP-SAT
# model construction — and therefore the generated schedule — is reproducible
# across process restarts (SPEC-V1 §3 / CLAUDE.md invariant 6).
set -euo pipefail
cd "$(dirname "$0")"
exec env PYTHONHASHSEED=0 .venv/bin/uvicorn app.main:app --port "${PORT:-8000}" "$@"
