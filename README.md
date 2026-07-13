# Atria — the schedule maker for medicine

**Live demo:** https://atria-web-production.up.railway.app · **Code:** https://github.com/DevRush/atria

Define your program's rules and roster, press **Generate**, and Atria builds a complete, valid, fair
schedule in seconds — a full residency/fellowship academic year, or a private group's monthly call. It
**validates** every schedule against ACGME duty-hour limits and program requirements, **repairs** it with
minimal disruption when someone calls in sick, and **publishes** one trustworthy source of truth with a
free who's-on-call page anyone can read.

## The problem

One of the most labor-intensive wastes of time for doctors is the weekly/monthly/annual schedule-making
process. It's done almost exclusively by hand, by an individual or a small team. It's a major
administrative burden in medical training (every residency and fellowship) and in clinical practice as
attendings. Expensive software exists, but it doesn't reliably actually *create* the schedule — and it's
paywalled for what is a rote, automatable task: schedule-making is just plugging in a large set of rules
and letting a scheduler follow those constraints.

The burden is worst in training, where programs often can't afford the premium tools, so **trainees spend
dozens of hours** — clinical time, training time, and honestly rest time — doing something that should
take under an hour. And the review almost always falls on the *head* of the group to sign off ("time to
make next year's schedule… ugh" is a thing you'll actually hear).

Atria lets any residency, fellowship, private practice, or academic group set the rules of their practice
(call, rotation minimums/maximums, variable hours, jeopardy coverage, duty-hour limits) and their roster,
and it makes the schedule automatically. It's an unsexy idea — a doctor-schedule-maker — but it's a large,
unnecessary burden that is prime for automation, and there is no free or automated tool, especially not
for doctors in training.

## What it does

- **Build a schedule** — edit your roster and what each rotation needs, press Generate, and the CP-SAT
  constraint engine places everyone, honors every duty-hour rule, and balances call — a full academic
  year in seconds. Over-constrain it and it explains *which rules collide* and what to relax, instead of
  failing silently.
- **Two markets, one engine** — a **trainee** edition (fellows × 13 four-week blocks, COCATS
  requirements) and an **attending** edition (FTE-weighted, privilege-gated call like interventional-only
  STEMI) run on the same solver.
- **Repair, not rebuild** — when someone calls out sick, Atria re-solves the *minimum*: it touches the
  fewest people, proves the fix is valid, and shows a before/after receipt. Nobody else's schedule moves.
- **Trustworthy by construction** — an **independent validator** (shares no code with the solver) runs
  the authoritative ACGME arithmetic and gates every publish, so a solver bug can never publish an
  illegal or uncovered schedule. Every version is immutable and audited; the public share link is
  tamper-evident and revocable.

## Architecture

- **`solver/`** — Python + FastAPI + OR-Tools **CP-SAT**. `/solve` (generate), `/repair`
  (minimal-disruption re-solve), `/validate` (independent checker). Every rule compiles to a named
  assumption literal, so infeasibility comes back as the *specific conflicting rules* with ranked fixes —
  never the word "infeasible." Deterministic (fixed seed + single worker + `PYTHONHASHSEED=0`).
- **`web/`** — Next.js (App Router, TS, Tailwind) + Prisma. The Build flow, schedule grid, month
  calendar, repair flow, fairness ledger, rule catalog, publication history, and the who's-on-call page.
  `/api/publish` is the trust gate — it refuses on a blocking violation unless a named human files a
  typed override waiver.

The invariants that make it trustworthy are in [`CLAUDE.md`](CLAUDE.md); the product reasoning is in
[`docs/SPEC-V1.md`](docs/SPEC-V1.md) and [`docs/DECISION-BRIEF.md`](docs/DECISION-BRIEF.md).

## The demo (≈2 minutes)

1. **Build → Generate.** On the Build tab the cardiology roster is pre-filled. Add a couple of fellows,
   nudge a rotation's coverage, and press **Generate schedule**. The engine builds the whole academic
   year live — every rotation covered, every duty-hour rule satisfied — and the grid cascades in.
2. **Repair.** A fellow calls in sick over a weekend they're on call. **Find repairs** → the engine
   returns valid options ranked by disruption; the best routes their call to this week's backup —
   *1 of 664 assignments changed, 0 violations.* Publish it; the independent validator runs first.
3. **Attendings.** Switch to the attending edition and build a private group's monthly call — the month
   calendar fills in, weekends highlighted, interventional STEMI call going only to interventionalists.

## Run it locally

Two processes — **solver** (`cd solver && ./run.sh`, port 8000) and **web** (`cd web && npm install &&
npx prisma db push && npm run demo:reset && npm run dev`). `npm run demo:reset` re-arms the sample any
time. Full deploy notes in [DEPLOY.md](DEPLOY.md).

## Built with Claude Code

I used Claude Code — Fable 5 and Opus 4.8 are incredible beasts; they let you dream big and build
effortlessly. Claude Code is an amazing partner in development, brainstorming, coding, reviewing, and so
much more — it's fantastic to have what feels like a real, strong partner. As a cardiologist, I don't have
formal technical training in software development, but with Claude I can design solutions to the problems
that exist in medicine — the kind only physicians can identify from their day-to-day experience. Claude is
powerful, easy to use, and I'd recommend it to anyone in a heartbeat.

## Docs & license

[ARCHITECTURE.md](ARCHITECTURE.md) · [ROADMAP.md](ROADMAP.md) · [SECURITY.md](SECURITY.md) ·
[docs/CODEX-LEARNINGS.md](docs/CODEX-LEARNINGS.md). Licensed under Apache 2.0.
