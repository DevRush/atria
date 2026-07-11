/**
 * Thin client for the isolated solver service (FastAPI, :8000).
 * Endpoints per docs/SCHEMA.md: POST /solve, /repair, /validate.
 */

export const SOLVER_URL = process.env.SOLVER_URL ?? "http://localhost:8000";

export class SolverUnreachableError extends Error {
  constructor(cause: unknown) {
    super(`Solver service unreachable at ${SOLVER_URL}`);
    this.name = "SolverUnreachableError";
    this.cause = cause;
  }
}

export class SolverHttpError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`Solver returned HTTP ${status}`);
    this.name = "SolverHttpError";
    this.status = status;
    this.body = body;
  }
}

export async function solverPost<T>(
  endpoint: "/solve" | "/repair" | "/validate",
  payload: unknown
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SOLVER_URL}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (e) {
    throw new SolverUnreachableError(e);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new SolverHttpError(res.status, body);
  return body as T;
}
