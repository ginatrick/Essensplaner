"""DOM-Scraper für die Norma-Kategorie Obst & Gemüse.

Selektoren live gegen norma-online.de verifiziert (2026-07-23):
- Kachel: article.produktBoxContainer
- Titel: .produktBox-txt-headline
- Marke: .supplier
- Menge (Rohtext): .produktBox-txt-inh, z. B. "je 500 g"
- Preis: .produktBox-cont-wrapper-price, aria-label enthält den sauberen
  Wert ("1,29 Euro") — NICHT .produktBox-txt-price verwenden, das ist der
  Grundpreis pro kg/Stück, nicht der tatsächliche Angebotspreis.
- Abschnitt/Datum: nächstgelegene vorherige .articleGroup, deren
  aria-label das "Ab <Wochentag>, TT.MM."-Muster enthält.
"""

from __future__ import annotations

import re
from datetime import date

from .._browser import rendered_page
from .._types import RawOffer

URL = "https://www.norma-online.de/de/angebote/obst-und-gemuese/"
_PRICE = re.compile(r"(\d+),(\d{2})\s*Euro")
_DATE = re.compile(r"\b(?:ab\s+)?(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)[^\d]*(\d{1,2})[./](\d{1,2})", re.I)
_QUANTITY = re.compile(r"(\d+(?:[,.]\d+)?)[\s-]*(kg|g|mg|l|ml|cl|stk|stück)\b", re.I)


def _iso_date(text: str) -> str | None:
    match = _DATE.search(text)
    if not match:
        return None
    try:
        return date(date.today().year, int(match.group(2)), int(match.group(1))).isoformat()
    except ValueError:
        return None


def _parse_quantity(text: str) -> tuple[int | float | None, str | None]:
    match = _QUANTITY.search(text)
    if match:
        value = float(match.group(1).replace(",", "."))
        amount: int | float = int(value) if value.is_integer() else value
        return amount, match.group(2).lower()
    if re.search(r"\bst(ü|u)ck\b", text, re.I):
        return None, "Stück"
    return None, text or None


def _parse_tiles(page) -> list[RawOffer]:
    records = page.locator("article.produktBoxContainer").evaluate_all(
        """
        tiles => {
          const text = el => (el?.textContent || '').replace(/\\s+/g, ' ').trim();
          const sections = [...document.querySelectorAll('.articleGroup')];
          const before = tile => sections.filter(s =>
            (s.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          ).at(-1);
          return tiles.map(tile => {
            const priceEl = tile.querySelector('.produktBox-cont-wrapper-price [aria-label]');
            const section = before(tile);
            return {
              title: text(tile.querySelector('.produktBox-txt-headline')),
              brand: text(tile.querySelector('.supplier')),
              quantity: text(tile.querySelector('.produktBox-txt-inh')),
              priceLabel: priceEl ? priceEl.getAttribute('aria-label') : '',
              section: section ? (section.getAttribute('aria-label') || '') : '',
            };
          });
        }
        """
    )
    offers: list[RawOffer] = []
    for item in records:
        title = item.get("title", "")
        price_match = _PRICE.search(item.get("priceLabel", ""))
        if not title or not price_match:
            continue
        amount, unit = _parse_quantity(item.get("quantity", ""))
        offers.append({
            "title": title,
            "brand": item.get("brand") or None,
            "amount": amount,
            "unit": unit,
            "price_cent": int(price_match.group(1)) * 100 + int(price_match.group(2)),
            "valid_from": _iso_date(item.get("section", "")),
            "valid_to": None,
            "source_chain": "norma",
        })
    return offers


def fetch() -> list[RawOffer]:
    try:
        with rendered_page(URL) as page:
            return _parse_tiles(page)
    except Exception:
        return []
