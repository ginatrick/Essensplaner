import os

os.environ["INGEST_SHARED_SECRET"] = "test-secret"

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_ist_oeffentlich():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_geschuetzter_endpoint_ohne_secret_verweigert():
    response = client.get("/whoami")
    assert response.status_code == 401


def test_geschuetzter_endpoint_mit_falschem_secret_verweigert():
    response = client.get("/whoami", headers={"X-Ingest-Secret": "falsch"})
    assert response.status_code == 401


def test_geschuetzter_endpoint_mit_richtigem_secret_erlaubt():
    response = client.get("/whoami", headers={"X-Ingest-Secret": "test-secret"})
    assert response.status_code == 200
    assert response.json() == {"status": "authenticated"}
