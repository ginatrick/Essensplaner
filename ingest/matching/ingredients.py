"""Zutaten-Matching für Angebote — Port von web/lib/recipes/lookupAlias.ts,
gleiche Schwelle/Semantik (erst exakter Alias-Treffer, dann Trigram-Fuzzy
über dieselbe RPC), damit beide Wege (Rezept-Import, Angebots-Ingest)
konsistent gegen dieselben Aliase matchen."""

import re

FUZZY_MATCH_THRESHOLD = 0.4


def _escape_ilike(value: str) -> str:
    return re.sub(r"[%_]", lambda m: f"\\{m.group()}", value)


def match_ingredient(client, name: str) -> tuple[str | None, float]:
    """Gibt (ingredient_id, confidence) zurück. Kein Treffer -> (None, 0.0)."""
    trimmed = name.strip()
    if not trimmed:
        return None, 0.0

    exact = (
        client.from_("ingredient_aliases")
        .select("ingredient_id")
        .ilike("alias", _escape_ilike(trimmed))
        .limit(1)
        .execute()
    )
    if exact.data:
        return exact.data[0]["ingredient_id"], 1.0

    fuzzy = client.rpc(
        "match_ingredient_alias_fuzzy",
        {"search": trimmed, "min_similarity": FUZZY_MATCH_THRESHOLD, "match_limit": 1},
    ).execute()
    if fuzzy.data:
        top = fuzzy.data[0]
        return top["ingredient_id"], top["similarity"]

    return None, 0.0
