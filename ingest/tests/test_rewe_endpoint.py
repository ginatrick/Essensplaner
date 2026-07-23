import os

os.environ["INGEST_SHARED_SECRET"] = "test-secret"

from fastapi.testclient import TestClient

import main


def test_rewe_price_zweiter_aufruf_nutzt_cache(monkeypatch):
    calls = []
    cache = []
    hit = {"product_name": "Milch", "amount": 1000, "unit": "ml", "price_cent": 109, "is_offer": False}

    def cached(ingredient_id, market_id):
        return cache[-1] if cache else None

    def fetched(ingredient_name, market_id):
        calls.append((ingredient_name, market_id))
        return hit

    def inserted(ingredient_id, market_id, value):
        row = {**value, "market_id": market_id, "fetched_at": "2026-07-23T12:00:00+00:00"}
        cache.append(row)
        return row

    monkeypatch.setattr(main, "get_cached_rewe_price", cached)
    monkeypatch.setattr(main, "get_ingredient_name", lambda ingredient_id: "Milch")
    monkeypatch.setattr(main, "fetch_price", fetched)
    monkeypatch.setattr(main, "insert_rewe_price", inserted)
    client = TestClient(main.app)
    headers = {"X-Ingest-Secret": "test-secret"}

    first = client.get("/rewe/price?ingredient_id=ingredient-1&market_id=1469536", headers=headers)
    second = client.get("/rewe/price?ingredient_id=ingredient-1&market_id=1469536", headers=headers)

    assert first.status_code == second.status_code == 200
    assert first.json()["hit"] is True
    assert second.json()["price_cent"] == 109
    assert calls == [("Milch", "1469536")]
