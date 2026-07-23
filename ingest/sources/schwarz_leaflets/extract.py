"""PDF-Text-Extraktion und seitenweises Angebot-Parsing mit Claude Haiku."""

import json
import os
import re
from typing import TypedDict

import pdfplumber

try:
    from anthropic import Anthropic
except ImportError:  # Die Tests injizieren den Client; Produktion installiert anthropic.
    Anthropic = None  # type: ignore[assignment,misc]


class RawOffer(TypedDict):
    title: str
    brand: str | None
    amount: int | float | None
    unit: str | None
    price_cent: int
    valid_from: str | None
    valid_to: str | None
    source_chain: str


MODEL = "claude-haiku-4-5-20251001"


def _client():
    client_type = Anthropic
    if client_type is None:
        from anthropic import Anthropic as client_type
    return client_type(api_key=os.environ.get("ANTHROPIC_API_KEY"))


def _response_text(response) -> str:
    content = getattr(response, "content", [])
    if not content:
        return ""
    first = content[0]
    return getattr(first, "text", first if isinstance(first, str) else "")


def _parse_response(text: str, chain: str) -> list[RawOffer]:
    text = text.strip()
    if not text:
        return []
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I | re.S).strip()
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return []
    if not isinstance(payload, list):
        return []
    offers: list[RawOffer] = []
    for item in payload:
        if not isinstance(item, dict) or not isinstance(item.get("title"), str):
            continue
        price = item.get("price_cent")
        if isinstance(price, bool) or not isinstance(price, (int, float)):
            continue
        offers.append({
            "title": item["title"],
            "brand": item.get("brand") if isinstance(item.get("brand"), str) else None,
            "amount": item.get("amount") if isinstance(item.get("amount"), (int, float)) else None,
            "unit": item.get("unit") if isinstance(item.get("unit"), str) else None,
            "price_cent": int(price),
            "valid_from": item.get("valid_from") if isinstance(item.get("valid_from"), str) else None,
            "valid_to": item.get("valid_to") if isinstance(item.get("valid_to"), str) else None,
            "source_chain": chain,
        })
    return offers


def _extract_page(client, text: str, chain: str) -> list[RawOffer]:
    prompt = f"""Das ist der durcheinandergewürfelte Text einer Prospekt-Seite von {chain}.
Extrahiere alle erkennbaren Lebensmittel-Angebote als JSON-Array mit den Feldern
title, brand (nullable), amount (Zahl, nullable wenn nicht erkennbar), unit (Roh-Text
wie im Prospekt, nullable), price_cent (Integer, aktueller Angebotspreis, nicht der
durchgestrichene alte Preis), valid_from und valid_to (ISO-Datum aus Prospekt-Titel
oder Header übernehmen). Kein Angebot erkennbar: leeres Array. Nichts erfinden.
Antworte ausschließlich mit gültigem JSON.

SEITENTEXT:
{text}"""
    response = client.messages.create(model=MODEL, max_tokens=4096, messages=[{"role": "user", "content": prompt}])
    return _parse_response(_response_text(response), chain)


def extract_offers_from_pdf(pdf_path: str, chain: str) -> list[RawOffer]:
    """Extrahiert Angebote aus jeder PDF-Seite; fehlerhafte Seiten werden übersprungen."""
    client = _client()
    offers: list[RawOffer] = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            try:
                text = page.extract_text() or ""
                if text.strip():
                    offers.extend(_extract_page(client, text, chain))
            except Exception:
                continue
    return offers
