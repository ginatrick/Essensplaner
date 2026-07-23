from pathlib import Path
from types import SimpleNamespace

from sources.schwarz_leaflets import extract


class FakeClient:
    def __init__(self, **_kwargs):
        self.messages = self

    def create(self, **_kwargs):
        return SimpleNamespace(content=[SimpleNamespace(text='[{"title":"Äpfel","brand":null,"amount":1000,"unit":"g","price_cent":199,"valid_from":"2026-07-20","valid_to":"2026-07-25"}]')])


FIXTURE = Path(__file__).parent / "fixtures" / "schwarz_leaflets" / "angebote.pdf"


def test_extract_parst_fixture_und_haengt_kette_an(monkeypatch):
    monkeypatch.setattr(extract, "Anthropic", FakeClient)

    result = extract.extract_offers_from_pdf(str(FIXTURE), "lidl")

    assert result == [{
        "title": "Äpfel", "brand": None, "amount": 1000, "unit": "g",
        "price_cent": 199, "valid_from": "2026-07-20", "valid_to": "2026-07-25",
        "source_chain": "lidl",
    }]


def test_kaputtes_haiku_json_wird_uebersprungen(monkeypatch):
    class BrokenClient(FakeClient):
        def create(self, **_kwargs):
            return SimpleNamespace(content=[SimpleNamespace(text="kein JSON")])

    monkeypatch.setattr(extract, "Anthropic", BrokenClient)
    assert extract.extract_offers_from_pdf(str(FIXTURE), "kaufland") == []
