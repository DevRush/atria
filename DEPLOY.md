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
