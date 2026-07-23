import json
from pathlib import Path

import pytest

from sources.rewe import fetch as rewe_fetch


FIXTURES = Path(__file__).parent / "fixtures" / "rewe"


class FakeResponse:
    status_code = 200

    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


def fixture(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        (
            "volume_offer.json",
            {"product_name": "REWE Frei von Fettarme H-Milch 1l", "amount": 1000, "unit": "ml", "price_cent": 109, "is_offer": True},
        ),
        (
            "piece.json",
            {"product_name": "REWE Salatherzen 3 Stück", "amount": 1, "unit": "stk", "price_cent": 199, "is_offer": False},
        ),
    ],
)
def test_fetch_price_mappt_fixtures(monkeypatch, name, expected):
    monkeypatch.setattr(rewe_fetch.httpx, "get", lambda *args, **kwargs: FakeResponse(fixture(name)))
    assert rewe_fetch.fetch_price("Milch", "1469536") == expected


def test_fetch_price_no_hit(monkeypatch):
    monkeypatch.setattr(rewe_fetch.httpx, "get", lambda *args, **kwargs: FakeResponse(fixture("no_hit.json")))
    assert rewe_fetch.fetch_price("unbekannt", "1469536") is None


def test_fetch_price_unerwartetes_json(monkeypatch):
    monkeypatch.setattr(rewe_fetch.httpx, "get", lambda *args, **kwargs: FakeResponse(fixture("broken.json")))
    assert rewe_fetch.fetch_price("Milch", "1469536") is None
