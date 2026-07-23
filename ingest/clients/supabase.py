"""Service-Role-Client für Schreibzugriffe auf globale Tabellen (offers, stores,
price_history, rewe_prices) — siehe RLS-Regeln in docs/03-datenmodell.md.
Der Service-Role-Key lebt ausschließlich hier im Ingest-Prozess, nie im Client."""

import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from supabase import Client, create_client


@lru_cache
def get_service_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, service_role_key)


def get_cached_rewe_price(ingredient_id: str, market_id: str) -> dict | None:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    result = (
        get_service_client()
        .from_("rewe_prices")
        .select("product_name, amount, unit, price_cent, is_offer")
        .eq("ingredient_id", ingredient_id)
        .eq("market_id", market_id)
        .gt("fetched_at", cutoff)
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def get_ingredient_name(ingredient_id: str) -> str | None:
    result = (
        get_service_client()
        .from_("ingredients")
        .select("name")
        .eq("id", ingredient_id)
        .limit(1)
        .execute()
    )
    return result.data[0]["name"] if result.data else None


def insert_rewe_price(ingredient_id: str, market_id: str, hit: dict) -> dict:
    result = (
        get_service_client()
        .from_("rewe_prices")
        .insert({"ingredient_id": ingredient_id, "market_id": market_id, **hit})
        .select("product_name, amount, unit, price_cent, is_offer")
        .single()
        .execute()
    )
    return result.data
