# Security policy

Atria is an active prototype. Do not use it as the sole operational source for
clinical coverage until local rules, outputs, and recovery procedures have been
validated in a supervised parallel run.

## Reporting a vulnerability

Email the maintainer privately rather than opening a public issue. Include steps
to reproduce and the potential impact. Please do not include patient data,
identifiable rosters, or live credentials in a report.

## Data boundaries

- **No patient data, ever.** There is no patient model and none should be added.
- **No PHI.** Absence *reasons* are stored as opaque, role-gated codes and are
  excluded from any AI processing.
- **Least exposure on public links.** The shareable who's-on-call projection
  contains only program name, dates, service/role labels, and abbreviated
  display names. Person IDs, emails, FTE, eligibility, rules, fairness, absence
  reasons, locks, and audit actors are excluded by construction.

## Controls in the current build

- The solver's compute-heavy endpoints require a shared key; only the web app can
  trigger a solve. Public traffic gets a cheap 401.
- Per-IP rate limits on every compute route.
- Bearer share links use a 256-bit secret stored only as its SHA-256 hash, shown
  once, revocable and rotatable. Bad/revoked/expired tokens return one generic
  page. Public pages are noindex / no-referrer.
- Publication independently revalidates the exact payload and refuses blocking
  violations without a named, logged override.
- Append-only audit log of consequential actions.

## Not yet implemented (do not assume present)

Authentication/SSO, multi-tenant isolation and RBAC, durable encrypted
persistence, backup/restore, penetration testing, and a formal incident-response
process are roadmap items. Treat any deployment as demo-grade until those exist.
