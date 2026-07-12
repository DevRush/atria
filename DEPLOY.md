# Deploying Atria to Railway

Two services in one Railway project: **solver** (Python/OR-Tools) and **web** (Next.js).
Both build from their own Dockerfile. The web talks to the solver over HTTPS via `SOLVER_URL`.

## One-time auth

```bash
railway login          # opens a browser; authorize once
```

## Deploy

```bash
# from the repo root
railway init                                  # create a new project (name it "atria")

# --- solver service ---
cd solver
railway up --service solver                   # first run creates the service + uploads the Dockerfile build
railway domain --service solver               # generate a public URL, note it (e.g. https://solver-xxxx.up.railway.app)

# --- web service ---
cd ../web
railway up --service web
railway variables --service web \
  --set "SOLVER_URL=https://<the solver domain from above>"
railway domain --service web                  # generate the public URL you'll share
```

Redeploy after the env var is set so the web picks it up:

```bash
railway up --service web
```

## Cost & abuse protection

The solver's `/solve` and `/repair` do CPU-heavy CP-SAT work, so they're guarded:

- **Shared key:** both services have an `ATRIA_KEY` env var; the solver rejects any `/solve`,
  `/repair`, or `/validate` request without the matching `x-atria-key` header with a cheap `401`.
  Only the web app (which has the key) can trigger a solve — public scanners can't.
- **Rate limiting:** the solver has a global sliding-window cap; the web rate-limits every
  compute route per IP (solve 8/min, repair 12, publish 20, validate 40, import 6–10).

**Two protections you must set in the Railway dashboard (not available via CLI):**

1. **Hard spending cap — the real guarantee.** Dashboard → your workspace → **Settings → Usage** →
   set a **Hard Limit** (e.g. $5–10/mo). When hit, Railway shuts the services down — you cannot be
   charged past it.
2. **App Sleeping (serverless) — ~zero idle cost.** For **each** service (atria-web, atria-solver):
   Settings → **Serverless / App Sleeping** → enable. Services sleep when idle and wake on the next
   request, so a demo that sits unused costs almost nothing.

## Notes

- **Database:** SQLite, recreated and re-seeded from the bundled `web/data/program.json` on every
  boot — the app always starts on a clean, complete cardiology sample. Session edits persist while the
  container lives; a redeploy resets to the sample. For durable data, add a Railway Postgres and switch
  the Prisma provider (not needed for a demo).
- **Reproducibility:** the solver runs with `PYTHONHASHSEED=0` (baked into its Dockerfile) so generated
  schedules are identical across restarts.
- **Ports:** both Dockerfiles honor Railway's `$PORT`. The solver has no auth (no sensitive data); if you
  want it private, put both services in the same project and use Railway private networking instead of a
  public solver domain (`SOLVER_URL=http://solver.railway.internal:8080`).
- **Import demo:** the sample messy spreadsheet is served at `/legacy-schedule.xlsx`.
