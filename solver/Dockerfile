# Atria solver — FastAPI + OR-Tools CP-SAT. PYTHONHASHSEED pinned for reproducible
# schedules across restarts (SPEC-V1 §3 / CLAUDE.md invariant 6).
FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONHASHSEED=0

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Railway provides $PORT; default 8000 for local runs.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
