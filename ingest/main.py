"""FastAPI-Grundgerüst für den Ingest-Service (Phase 4, Schritt 1).
Läuft lokal auf dem Entwickler-PC, erreichbar für Supabase über Cloudflare
Tunnel (siehe README.md). Crawler/Parser folgen als eigene Endpoints unter
sources/ und parsing/, siehe docs/06-modul-angebote.md."""

from dotenv import load_dotenv
from fastapi import Depends, FastAPI

from auth import require_ingest_secret

load_dotenv()

app = FastAPI(title="MealPlanner Ingest")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/whoami", dependencies=[Depends(require_ingest_secret)])
def whoami() -> dict[str, str]:
    """Testet die Shared-Secret-Auth end-to-end, ohne echte Ingest-Logik."""
    return {"status": "authenticated"}
