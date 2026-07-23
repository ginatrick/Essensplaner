"""Normalisiert Prospekt-Rohmengen (RawOffer.amount/unit) auf Basiseinheit
(g/ml/stk) — analog zu web/lib/units/convert.ts für Rezeptzeilen, aber für
die uneinheitlichen Prospekt-Rohtexte der Ketten (z. B. ALDI: "500-g-Packung",
"2er-Packung", "kg-Preis"; Norma liefert amount/unit schon halb normalisiert,
z. B. amount=500, unit="g"). Kein Treffer -> (None, None), kein Raten —
solche Angebote fließen dann nicht in Preisvergleiche ein, landen aber
trotzdem in `offers` (Review-UI kann sie trotzdem zuordnen)."""

import re

_WEIGHT_UNIT_TO_GRAMS = {"kg": 1000.0, "g": 1.0, "mg": 0.001}
_VOLUME_UNIT_TO_ML = {"l": 1000.0, "ml": 1.0, "cl": 10.0}

_KG_PRICE = re.compile(r"\bkg[\s-]*preis\b", re.I)
# "6x20-g-Packung", "6 x 100 ml"
_MULTIPACK = re.compile(
    r"(?P<count>\d+)\s*[x×]\s*(?P<each>\d+(?:[.,]\d+)?)[\s-]*(?P<unit>kg|g|mg|l|ml|cl)\b", re.I
)
# "500-g-Packung", "1,5-kg-Packung", "500 g", "8 kg"
_WEIGHT_OR_VOLUME = re.compile(
    r"(?P<amount>\d+(?:[.,]\d+)?)[\s-]*(?P<unit>kg|g|mg|l|ml|cl)\b", re.I
)
# "2er-Packung", "6er-Pack"
_PIECE_PACK = re.compile(r"(?P<count>\d+)\s*er\b", re.I)
_STUECK = re.compile(r"\bst(ü|u)ck\b", re.I)
# Reine Gebinde-Wörter ohne Gewichtsangabe (z. B. "Packung", "3 Paar") — ohne
# Zahl wird 1 angenommen ("Packung" = "1 Packung"), mit Zahl die Zahl selbst.
_CONTAINER = re.compile(
    r"(?:(?P<count>\d+)\s+)?\b(beutel|garnitur|paar|pflanze|packung|bund|dose|flasche|tafel|netz|kiste)\b", re.I
)


def parse_quantity(raw_amount: int | float | None, raw_unit: str | None) -> tuple[float | None, str | None]:
    text = f"{raw_amount if raw_amount is not None else ''} {raw_unit or ''}".strip()
    if not text:
        return None, None

    # "kg-Preis" heißt: der angezeigte Preis ist bereits der Preis pro kg
    # (typisch für lose Ware) — amount=1000/unit=g passt zur offers-Konvention
    # "price_cent gilt für (amount, unit)", price_cent bleibt dann unverändert.
    if _KG_PRICE.search(text):
        return 1000.0, "g"

    multi = _MULTIPACK.search(text)
    if multi:
        count = float(multi.group("count"))
        each = float(multi.group("each").replace(",", "."))
        unit = multi.group("unit").lower()
        if unit in _WEIGHT_UNIT_TO_GRAMS:
            return count * each * _WEIGHT_UNIT_TO_GRAMS[unit], "g"
        return count * each * _VOLUME_UNIT_TO_ML[unit], "ml"

    weight_or_volume = _WEIGHT_OR_VOLUME.search(text)
    if weight_or_volume:
        amount = float(weight_or_volume.group("amount").replace(",", "."))
        unit = weight_or_volume.group("unit").lower()
        if unit in _WEIGHT_UNIT_TO_GRAMS:
            return amount * _WEIGHT_UNIT_TO_GRAMS[unit], "g"
        return amount * _VOLUME_UNIT_TO_ML[unit], "ml"

    piece_pack = _PIECE_PACK.search(text)
    if piece_pack:
        return float(piece_pack.group("count")), "stk"

    if _STUECK.search(text):
        amount = float(raw_amount) if isinstance(raw_amount, (int, float)) else 1.0
        return amount, "stk"

    container = _CONTAINER.search(text)
    if container:
        count = float(container.group("count")) if container.group("count") else 1.0
        return count, "stk"

    return None, None
