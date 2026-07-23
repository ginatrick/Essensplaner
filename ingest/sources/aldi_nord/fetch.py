"""Deterministische Extraktion der clientseitig gerenderten ALDI-Nord-Kacheln."""

from __future__ import annotations

import re
from datetime import date

from .._browser import rendered_page
from .._types import RawOffer

URL = "https://www.aldi-nord.de/angebote.html"
_DECIMAL = re.compile(r"\d+[.,]\d{1,2}")
_DATE = re.compile(r"\b(?:ab\s+)?(?:mo|di|mi|do|fr|sa|so)[^\d]*(\d{1,2})[./-](\d{1,2})\b", re.I)


def _date_from_text(text: str) -> str | None:
    match = _DATE.search(text)
    if not match:
        return None
    try:
        return date(date.today().year, int(match.group(2)), int(match.group(1))).isoformat()
    except ValueError:
        return None


def _parse_tiles(page) -> list[RawOffer]:
    records = page.locator(".product-tile").evaluate_all(
        """
        tiles => {
          const dateRe = /\\b(?:ab\\s+)?(?:mo|di|mi|do|fr|sa|so)[^\\d]*(\\d{1,2})[.\\/-](\\d{1,2})\\b/i;
          // Nur Abschnitts-Überschriften (haben ein id-Attribut, z. B. id="Ab-Mo--20-7-"),
          // nicht die Produktname-<h2> jeder Kachel (dieselben Heading-Tags, aber ohne id).
          const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => h.id);
          const text = el => (el?.textContent || '').replace(/\\s+/g, ' ').trim();
          const before = tile => headings.filter(h =>
            (h.compareDocumentPosition(tile) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
          ).at(-1);
          return tiles.map(tile => {
            const q = selector => tile.querySelector(selector);
            const name = q('.product-tile__content__upper__product-name');
            const brand = q('.product-tile__content__upper__brand-name');
            const price = q('[data-testid$="-tag-current-price-amount"]');
            const unit = q('.tag__marker--salesunit');
            const heading = before(tile);
            return {title:text(name), brand:text(brand), price:text(price), unit:text(unit), section:text(heading)};
          });
        }
        """
    )
    offers: list[RawOffer] = []
    for item in records:
        if not item.get("title"):
            continue
        match = _DECIMAL.search(item.get("price", ""))
        if not match:
            continue
        offers.append({
            "title": item["title"],
            "brand": item.get("brand") or None,
            "amount": None,
            "unit": item.get("unit") or None,
            "price_cent": round(float(match.group().replace(",", ".")) * 100),
            "valid_from": _date_from_text(item.get("section", "")),
            "valid_to": None,
            "source_chain": "aldi_nord",
        })
    return offers


def fetch() -> list[RawOffer]:
    try:
        with rendered_page(URL) as page:
            return _parse_tiles(page)
    except Exception:
        return []
