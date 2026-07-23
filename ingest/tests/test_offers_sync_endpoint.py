import os

os.environ["INGEST_SHARED_SECRET"] = "test-secret"

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)
HEADERS = {"X-Ingest-Secret": "test-secret"}


def test_sync_offers_delegiert_an_sync_chain(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "sync_chain", lambda chain: calls.append(chain) or {"chain": chain, "offers_found": 3, "offers_saved": 3})

    response = client.post("/offers/sync?chain=norma", headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {"chain": "norma", "offers_found": 3, "offers_saved": 3}
    assert calls == ["norma"]


def test_sync_offers_ohne_secret_verweigert():
    response = client.post("/offers/sync?chain=norma")
    assert response.status_code == 401
