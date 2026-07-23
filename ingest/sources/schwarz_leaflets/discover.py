"""Entdeckung der aktuell gültigen Schwarz-Prospekte."""

from datetime import date
import re
from urllib.parse import urlparse

import httpx

from .._browser import rendered_page

LIDL_URL = "https://www.lidl.de/c/online-prospekte/s10005610"
KAUFLAND_URL = "https://filiale.kaufland.de/prospekte.html"
FLYER_URL = "https://endpoints.leaflets.schwarz/v4/flyer"

_DATE_RE = re.compile(r"(?P<day>\d{2})[-.](?P<month>\d{2})[-.](?P<year>20\d{2})")


def _links(page) -> list[tuple[str, str]]:
    """Liest absolute hrefs und den sichtbaren Linktext aus einer Page."""
    try:
        return [
            (item["href"], item.get("text", ""))
            for item in page.locator("a").evaluate_all(
                """els => els.map(a => ({href: a.href, text: a.innerText || ''}))"""
            )
            if item.get("href")
        ]
    except (AttributeError, TypeError):
        # Kleine, bewusst unterstützte Fallback-Schnittstelle für Test-Fixtures.
        return [(str(href), "") for href in getattr(page, "links", [])]


def _date_range(value: str) -> tuple[date, date] | None:
    dates = []
    for match in _DATE_RE.finditer(value):
        try:
            dates.append(date(int(match["year"]), int(match["month"]), int(match["day"])))
        except ValueError:
            continue
    return (dates[0], dates[1]) if len(dates) >= 2 else None


def _is_current(value: str, today: date | None = None) -> bool:
    period = _date_range(value)
    return period is None or period[0] <= (today or date.today()) <= period[1]


def _pdf_url(identifier: str, region: str) -> str | None:
    response = httpx.get(
        FLYER_URL,
        params={"flyer_identifier": identifier, "region_id": region, "region_code": region},
        timeout=30.0,
    )
    if response.status_code != 200:
        return None
    payload = response.json()
    value = payload.get("flyer", {}).get("pdfUrl")
    return value if isinstance(value, str) and value else None


def find_current_lidl_pdf_url() -> str | None:
    """Findet den laufenden Lidl-Aktionsprospekt."""
    with rendered_page(LIDL_URL) as page:
        for href, text in _links(page):
            match = re.search(r"/prospekte/([^/?#]+)/ar/0(?:[/?#]|$)", href)
            if not match:
                continue
            identifier = match.group(1)
            if "aktionsprospekt" not in identifier.lower() or not _is_current(identifier + " " + text):
                continue
            return _pdf_url(identifier, "0")
    return None


def find_current_kaufland_pdf_urls() -> list[str]:
    """Findet alle aktuell gültigen Kaufland-Prospekte."""
    result: list[str] = []
    seen: set[tuple[str, str]] = set()
    with rendered_page(KAUFLAND_URL) as page:
        for href, text in _links(page):
            match = re.search(r"leaflets\.kaufland\.com/de-DE/([^/?#]+)/ar/([^/?#]+)", href, re.I)
            if not match or not _is_current(href + " " + text):
                continue
            identifier, region = match.groups()
            if (identifier, region) in seen:
                continue
            seen.add((identifier, region))
            pdf_url = _pdf_url(identifier, region)
            if pdf_url:
                result.append(pdf_url)
    return result
