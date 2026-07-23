"""Service-Role-Client für Schreibzugriffe auf globale Tabellen (offers, stores,
price_history, rewe_prices) — siehe RLS-Regeln in docs/03-datenmodell.md.
Der Service-Role-Key lebt ausschließlich hier im Ingest-Prozess, nie im Client."""

import os
from functools import lru_cache

from supabase import Client, create_client


@lru_cache
def get_service_client() -> Client:
    url = os.environ["SUPABASE_URL"]
    service_role_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, service_role_key)
