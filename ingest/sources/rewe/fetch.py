"""HTTP-Zugriff auf die normale REWE-Web-Shop-API."""

from typing import TypedDict

import httpx


class ReweHit(TypedDict):
    product_name: str
    amount: int
    unit: str
    price_cent: int
    is_offer: bool


REWE_PRODUCTS_URL = "https://shop.rewe.de/api/products"
REWE_HEADERS = {
    "accept": "application/vnd.rewe.productlist+json",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


def fetch_price(ingredient_name: str, market_id: str) -> ReweHit | None:
    """Lädt den relevantesten REWE-Treffer und mappt ihn auf ``ReweHit``.

    Alle Fehler werden absichtlich in einen normalen Miss übersetzt: Der
    Ingest-Service soll bei einer temporär nicht erreichbaren Quelle weiter
    funktionieren.
    """
    try:
        response = httpx.get(
            REWE_PRODUCTS_URL,
            params={
                "market": market_id,
                "search": ingredient_name,
                "serviceTypes": "PICKUP",
                "objectsPerPage": 10,
                "page": 1,
                "sorting": "RELEVANCE_DESC",
            },
            headers=REWE_HEADERS,
            timeout=15.0,
            follow_redirects=True,  # shop.rewe.de leitet 301 auf www.rewe.de/shop weiter
        )
        if response.status_code != 200:
            return None

        payload = response.json()
        products = payload["_embedded"]["products"]
        if not products:
            return None
        product = products[0]
        product_name = product["productName"]
        pricing = product["_embedded"]["articles"][0]["_embedded"]["listing"]["pricing"]

        base_unit = pricing.get("baseUnit")
        if base_unit is not None:
            if "KG" in base_unit:
                amount, unit, price_cent = 1000, "g", pricing["basePrice"]
            elif "L" in base_unit:
                amount, unit, price_cent = 1000, "ml", pricing["basePrice"]
            else:
                return None
        else:
            amount, unit, price_cent = 1, "stk", pricing["currentRetailPrice"]

        if not isinstance(product_name, str) or not isinstance(price_cent, int):
            return None
        return {
            "product_name": product_name,
            "amount": amount,
            "unit": unit,
            "price_cent": price_cent,
            "is_offer": "discount" in pricing,
        }
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        return None
