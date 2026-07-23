"""Orchestrierung der Schwarz-Prospekt-Pipeline."""

import tempfile
from pathlib import Path

import httpx

from .discover import find_current_kaufland_pdf_urls, find_current_lidl_pdf_url
from .extract import RawOffer, extract_offers_from_pdf


def _download(pdf_url: str) -> str:
    handle = tempfile.NamedTemporaryFile(prefix="schwarz-leaflet-", suffix=".pdf", delete=False)
    path = Path(handle.name)
    try:
        with httpx.stream("GET", pdf_url, timeout=120.0, follow_redirects=True) as response:
            if response.status_code != 200:
                raise httpx.HTTPStatusError("PDF-Download fehlgeschlagen", request=response.request, response=response)
            for chunk in response.iter_bytes():
                handle.write(chunk)
        return str(path)
    except Exception:
        path.unlink(missing_ok=True)
        raise
    finally:
        handle.close()


def fetch(chain: str) -> list[RawOffer]:
    """Lädt und extrahiert den aktuellen Prospekt der angegebenen Kette."""
    if chain not in ("lidl", "kaufland"):
        raise ValueError(f"Unbekannte Kette: {chain}")
    try:
        urls = ([find_current_lidl_pdf_url()] if chain == "lidl" else find_current_kaufland_pdf_urls())
        urls = [url for url in urls if url]
        offers: list[RawOffer] = []
        for url in urls:
            path = _download(url)
            try:
                offers.extend(extract_offers_from_pdf(path, chain))
            finally:
                Path(path).unlink(missing_ok=True)
        return offers
    except Exception:
        return []
