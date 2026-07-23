"""Orchestrierung des Prospekt-Ingest: manueller Trigger (main.py) und
Cron Mo/Mi 05:00 (docs/06-modul-angebote.md) laufen über denselben
Code-Pfad, damit der Lock (clients/supabase.py) in beiden Fällen greift —
ein manueller Trigger während eines laufenden Cron-Laufs überschreibt sonst
Daten doppelt statt sich gegenseitig abzuwarten."""

import logging
from typing import Callable

from clients.supabase import get_service_client, release_lock_chain, try_lock_chain
from matching.offers import save_offers
from sources._types import RawOffer
from sources.aldi_nord.fetch import fetch as fetch_aldi_nord
from sources.norma.fetch import fetch as fetch_norma
from sources.schwarz_leaflets.fetch import fetch as fetch_schwarz_leaflets

logger = logging.getLogger(__name__)

CHAIN_FETCHERS: dict[str, Callable[[], list[RawOffer]]] = {
    "lidl": lambda: fetch_schwarz_leaflets("lidl"),
    "kaufland": lambda: fetch_schwarz_leaflets("kaufland"),
    "aldi_nord": fetch_aldi_nord,
    "norma": fetch_norma,
}


def sync_chain(chain: str) -> dict:
    if chain not in CHAIN_FETCHERS:
        return {"chain": chain, "offers_found": 0, "offers_saved": 0, "error": "unbekannte Kette"}

    if not try_lock_chain(chain):
        return {"chain": chain, "offers_found": 0, "offers_saved": 0, "error": "läuft bereits"}

    try:
        offers = CHAIN_FETCHERS[chain]()
        saved = save_offers(get_service_client(), offers) if offers else 0
        return {"chain": chain, "offers_found": len(offers), "offers_saved": saved}
    except Exception:
        logger.exception("Prospekt-Sync für %s fehlgeschlagen", chain)
        return {"chain": chain, "offers_found": 0, "offers_saved": 0, "error": "fehlgeschlagen"}
    finally:
        release_lock_chain(chain)


def run_scheduled_sync() -> list[dict]:
    """Vom APScheduler-Cron aufgerufen (main.py), alle Ketten nacheinander —
    kein Parallel-Lauf nötig, 4 Ketten x wenige Minuten passen locker vor
    den nächsten Werktag."""
    return [sync_chain(chain) for chain in CHAIN_FETCHERS]
