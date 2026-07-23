"""Schreibt RawOffer-Listen (siehe sources/_types.py) als offers-Zeilen,
mit Zutaten-Matching pro Angebot (docs/06-modul-angebote.md, Schritt 4).

Ein Prospekt-Angebot gilt kettenweit, nicht pro Filiale — unsere `stores`
haben aber mehrere Filialen pro Kette (siehe docs/06 Marktradius). Statt das
Schema um kettenweite Angebote zu erweitern, wird jede Zeile einmal pro
Filiale der Kette geschrieben (Fan-out) — hält `offers.store_id not null`
aus docs/03-datenmodell.md unverändert, Zeilenzahl bleibt bei unserer
Filialanzahl (max. 3 pro Kette) unkritisch.
"""

from parsing.quantity import parse_quantity

from .ingredients import match_ingredient

# RawOffer.source_chain (Slug aus den fetch()-Modulen) -> stores.chain (Anzeigename).
CHAIN_DISPLAY_NAME = {
    "lidl": "Lidl",
    "kaufland": "Kaufland",
    "aldi_nord": "ALDI",
    "norma": "Norma",
}


def save_offers(client, offers: list[dict]) -> int:
    """Matched und schreibt Angebote. Gibt die Zahl geschriebener Zeilen zurück."""
    if not offers:
        return 0

    chain_slug = offers[0]["source_chain"]
    chain_name = CHAIN_DISPLAY_NAME.get(chain_slug, chain_slug)
    stores = client.from_("stores").select("id").eq("chain", chain_name).execute().data
    store_ids = [row["id"] for row in stores]
    if not store_ids:
        return 0

    rows = []
    for offer in offers:
        ingredient_id, confidence = match_ingredient(client, offer["title"])
        # amount/unit auf Basiseinheit normalisieren (siehe parsing/quantity.py) —
        # offers.amount/unit sind damit wie recipe_ingredients "amount gilt für
        # unit in g/ml/stk", kein Roh-Prospekttext mehr. Kein Treffer -> beide
        # None, die Zeile landet trotzdem in offers (Review-UI/Nachpflege),
        # zählt aber nicht in Preisvergleichen mit, die amount/unit brauchen.
        amount, unit = parse_quantity(offer["amount"], offer["unit"])
        for store_id in store_ids:
            rows.append({
                "store_id": store_id,
                "ingredient_id": ingredient_id,
                "raw_title": offer["title"],
                "brand": offer["brand"],
                "amount": amount,
                "unit": unit,
                "price_cent": offer["price_cent"],
                "valid_from": offer["valid_from"],
                "valid_to": offer["valid_to"],
                "source": chain_slug,
                "confidence": confidence,
            })

    if rows:
        client.from_("offers").insert(rows).execute()
        # price_history nur für zugeordnete Zeilen (ingredient_id not null,
        # siehe Migration 20260723150000) — für die Plausibilitätsprüfung
        # (docs/06) reicht ein Preispunkt pro (Zutat, Filiale, Zeitpunkt).
        history_rows = [
            {"ingredient_id": row["ingredient_id"], "store_id": row["store_id"], "price_cent": row["price_cent"]}
            for row in rows
            if row["ingredient_id"] is not None
        ]
        if history_rows:
            client.from_("price_history").insert(history_rows).execute()
    return len(rows)
