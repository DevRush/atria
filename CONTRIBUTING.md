# Contributing to Atria

Thanks for your interest. Atria aims to be the trustworthy, explainable scheduling
system for medical training programs.

## Ground rules

- **Never** submit patient data, private clinician information, live credentials,
  or identifiable operational rosters. De-identify all fixtures.
- Keep generation and validation on separate code paths. The validator must never
  import the solver or OR-Tools (a test enforces this).
- Required constraints must not be silently downgraded to soft.
- AI output is never treated as validation evidence.

## Especially welcome

- De-identified schedule fixtures (block schedules, call rotas, jeopardy policies)
- Specialty-specific rule packs (with owner, source, effective date)
- Independent validator test cases
- Import/export adapters (Excel, ICS, CSV)
- Solver improvements with reproducible benchmarks
- Accessibility and large-grid performance work

## Development

```bash
# solver
cd solver && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
./run.sh                 # :8000, PYTHONHASHSEED=0

# web
cd web && npm install && npx prisma db push && npm run demo:reset && npm run dev
```

Run the checks before opening a PR:

```bash
cd solver && .venv/bin/pytest      # engine, validator, independence, ACGME
cd web && npm run build            # typecheck + build
```

Keep the web↔solver contract in `docs/SCHEMA.md` in sync on both sides when you
change it. See [ARCHITECTURE.md](ARCHITECTURE.md) and [SECURITY.md](SECURITY.md)
first.
