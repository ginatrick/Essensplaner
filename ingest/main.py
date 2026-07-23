"""FastAPI-Grundgerüst für den Ingest-Service (Phase 4, Schritt 1).
Läuft lokal auf dem Entwickler-PC, erreichbar für Supabase über Cloudflare
Tunnel (siehe README.md). Crawler/Parser folgen als eigene Endpoints unter
sources/ und parsing/, siehe docs/06-modul-angebote.md."""

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi import Query

from auth import require_ingest_secret
from clients.supabase import get_cached_rewe_price, get_ingredient_name, insert_rewe_price
from sources.rewe.fetch import fetch_price

load_dotenv()

app = FastAPI(title="MealPlanner Ingest")

REWE_RESPONSE_FIELDS = ("product_name", "amount", "unit", "price_cent", "is_offer")


def _rewe_hit_response(row: dict) -> dict:
    return {"hit": True, **{field: row[field] for field in REWE_RESPONSE_FIELDS}}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/whoami", dependencies=[Depends(require_ingest_secret)])
def whoami() -> dict[str, str]:
    """Testet die Shared-Secret-Auth end-to-end, ohne echte Ingest-Logik."""
    return {"status": "authenticated"}


@app.get("/rewe/price", dependencies=[Depends(require_ingest_secret)])
def rewe_price(
    ingredient_id: str = Query(...),
    market_id: str = Query(...),
) -> dict:
    cached = get_cached_rewe_price(ingredient_id, market_id)
    if cached is not None:
        return _rewe_hit_response(cached)

    ingredient_name = get_ingredient_name(ingredient_id)
    if ingredient_name is None:
        return {"hit": False}

    hit = fetch_price(ingredient_name, market_id)
    if hit is None:
        return {"hit": False}

    stored = insert_rewe_price(ingredient_id, market_id, hit)
    return _rewe_hit_response(stored)
