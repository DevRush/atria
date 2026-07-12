# Atria roadmap

Ordered by operational trust, not feature count.

## Done (v1)

- CP-SAT generate with named-assumption-literal infeasibility explanations
- Independent validator (separate code path) + un-bypassable publish gate; ACGME
  duty-hour checks hard-coded
- Minimal-disruption repair with disruption receipts; candidates re-validated
  before return
- Manual grid editing (click-to-swap), live-validated, auto-locked
- Time-off request intake with inline repair-on-approval; rule-checked call swaps
- Excel import (messy real-world sheets) → validated program with generated call
- Fairness ledger; rule catalog; who's-on-call read path
- Immutable versioned publication with validation receipts + append-only audit
- Secure, privacy-allowlisted, revocable shareable who's-on-call link
- Deployed (two services on Railway) with auth key + rate limits + in-app reset

## Next — toward a supervised parallel-run pilot

- Backtest against a de-identified real trainee schedule and attending call rota
- Durable people / eligibility / coverage / rule editors (some config still uses
  fixtures)
- Configurable rule hardness surfaced in the UI (which minima block publish)
- Full attending edition on the shared core (interventional call, service-week
  allocation, FTE targets, post-call recovery)
- Requests: leave, swap pool, give-away, open-shift pickup wired to amendments
- Notification delivery + acknowledgment ledger; calendar (ICS) feeds
- Rule owners, sources, effective dates, and per-rule test cases
- Optimistic concurrency, stale-draft detection, idempotency

## Later — organization & enterprise

- Organizations, memberships, RBAC (scheduler/approver/viewer), multi-tenancy
- Durable Postgres persistence; backup/restore drills; emergency read-only roster
- SSO/SCIM; SOC 2 program; penetration test; VPAT/accessibility review
- EHR/HRIS/paging/payroll/calendar adapters
- SLA, RPO/RTO, incident response, data retention/offboarding

## Intentionally deferred (the never-list)

Patient scheduling · payroll or credentialing replacement · nursing workforce
scheduling · cash auctions for shifts · predictive-absence/wearable data ·
autonomous swap negotiation · public locums marketplace.
