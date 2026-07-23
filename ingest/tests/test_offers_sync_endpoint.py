import os

os.environ["INGEST_SHARED_SECRET"] = "test-secret"

from fastapi.testclient import TestClient

import main

client = TestClient(main.app)
HEADERS = {"X-Ingest-Secret": "test-secret"}


def test_sync_offers_ruft_fetcher_und_save_auf(monkeypatch):
    calls = []
    monkeypatch.setitem(main.OFFER_FETCHERS, "norma", lambda: [{"title": "Mango"}])
    monkeypatch.setattr(main, "save_offers", lambda client, offers: calls.append(offers) or 1)
    monkeypatch.setattr(main, "get_service_client", lambda: "fake-client")

    response = client.post("/offers/sync?chain=norma", headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {"chain": "norma", "offers_found": 1, "offers_saved": 1}
    assert calls == [[{"title": "Mango"}]]


def test_sync_offers_ohne_treffer_ruft_save_nicht_auf(monkeypatch):
    monkeypatch.setitem(main.OFFER_FETCHERS, "norma", lambda: [])
    called = []
    monkeypatch.setattr(main, "save_offers", lambda client, offers: called.append(True) or 0)

    response = client.post("/offers/sync?chain=norma", headers=HEADERS)

    assert response.json() == {"chain": "norma", "offers_found": 0, "offers_saved": 0}
    assert called == []


def test_sync_offers_unbekannte_kette(monkeypatch):
    response = client.post("/offers/sync?chain=nichtvorhanden", headers=HEADERS)
    assert response.json()["error"] == "unbekannte Kette"


def test_sync_offers_ohne_secret_verweigert():
    response = client.post("/offers/sync?chain=norma")
    assert response.status_code == 401
