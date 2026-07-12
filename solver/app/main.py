"""Atria solver service — FastAPI. Isolated from the web app (SPEC-V1 §7).

Cost/abuse protections (the /solve and /repair CP-SAT calls are CPU-heavy):
  - a shared key (ATRIA_KEY) gates the expensive endpoints, so only our web app
    can trigger a solve — random public traffic gets a cheap 401, never a solve;
  - a global in-memory rate limit caps solves even if the key leaks.
Both are no-ops when ATRIA_KEY is unset (local dev).
"""
from __future__ import annotations

import os
import time
from collections import deque

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    RepairRequest,
    RepairResponse,
    SolveRequest,
    SolveResponse,
    ValidateRequest,
    ValidateResponse,
)
from .solver import solve_generate, solve_repair
from .validator import validate

ATRIA_KEY = os.environ.get("ATRIA_KEY")

# global sliding-window limiter for the CPU-heavy endpoints
_RATE_MAX = int(os.environ.get("SOLVER_RATE_MAX", "20"))     # requests
_RATE_WINDOW = float(os.environ.get("SOLVER_RATE_WINDOW", "60"))  # seconds
_hits: deque[float] = deque()


def require_key(x_atria_key: str | None = Header(default=None)):
    if ATRIA_KEY and x_atria_key != ATRIA_KEY:
        raise HTTPException(status_code=401, detail="unauthorized")


def rate_limit():
    now = time.time()
    while _hits and now - _hits[0] > _RATE_WINDOW:
        _hits.popleft()
    if len(_hits) >= _RATE_MAX:
        raise HTTPException(status_code=429, detail="rate limit — too many solves; try again shortly")
    _hits.append(now)


HEAVY = [Depends(require_key), Depends(rate_limit)]

app = FastAPI(title="Atria Solver", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "service": "atria-solver"}


@app.post("/solve", response_model=SolveResponse, dependencies=HEAVY)
def solve(req: SolveRequest) -> SolveResponse:
    return solve_generate(req)


@app.post("/repair", response_model=RepairResponse, dependencies=HEAVY)
def repair(req: RepairRequest) -> RepairResponse:
    return solve_repair(req)


@app.post("/validate", response_model=ValidateResponse, dependencies=[Depends(require_key)])
def validate_endpoint(req: ValidateRequest) -> ValidateResponse:
    return validate(req)
