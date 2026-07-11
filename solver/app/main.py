"""Atria solver service — FastAPI. Isolated from the web app (SPEC-V1 §7)."""
from __future__ import annotations

from fastapi import FastAPI
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

app = FastAPI(title="Atria Solver", version="0.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health():
    return {"ok": True, "service": "atria-solver"}


@app.post("/solve", response_model=SolveResponse)
def solve(req: SolveRequest) -> SolveResponse:
    return solve_generate(req)


@app.post("/repair", response_model=RepairResponse)
def repair(req: RepairRequest) -> RepairResponse:
    return solve_repair(req)


@app.post("/validate", response_model=ValidateResponse)
def validate_endpoint(req: ValidateRequest) -> ValidateResponse:
    return validate(req)
