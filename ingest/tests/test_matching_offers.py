from types import SimpleNamespace

from matching import offers as offers_module


class FakeInsert:
    def __init__(self, sink):
        self.sink = sink

    def insert(self, rows):
        self.sink.extend(rows)
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=rows))


class FakeStoresQuery:
    def __init__(self, stores):
        self._stores = stores

    def select(self, *_a, **_k):
        return self

    def eq(self, _col, value):
        return SimpleNamespace(execute=lambda: SimpleNamespace(
            data=[s for s in self._stores if s["chain"] == value]
        ))


class FakeClient:
    def __init__(self, stores):
        self.stores = stores
        self.inserted: list[dict] = []

    def from_(self, table):
        if table == "stores":
            return FakeStoresQuery(self.stores)
        if table == "offers":
            return FakeInsert(self.inserted)
        raise AssertionError(f"unerwartete Tabelle: {table}")


def test_fan_out_ueber_alle_filialen_der_kette(monkeypatch):
    monkeypatch.setattr(offers_module, "match_ingredient", lambda client, name: ("ing-1", 0.9))
    client = FakeClient(stores=[
        {"id": "store-a", "chain": "ALDI"},
        {"id": "store-b", "chain": "ALDI"},
        {"id": "store-c", "chain": "Norma"},
    ])
    raw_offers = [{
        "title": "Aubergine", "brand": None, "amount": None, "unit": "Stück", "price_cent": 59,
        "valid_from": "2026-07-20", "valid_to": None, "source_chain": "aldi_nord",
    }]

    saved = offers_module.save_offers(client, raw_offers)

    assert saved == 2
    assert {row["store_id"] for row in client.inserted} == {"store-a", "store-b"}
    assert all(row["ingredient_id"] == "ing-1" and row["confidence"] == 0.9 for row in client.inserted)
    assert all(row["source"] == "aldi_nord" for row in client.inserted)


def test_ohne_bekannte_filiale_wird_nichts_geschrieben(monkeypatch):
    monkeypatch.setattr(offers_module, "match_ingredient", lambda client, name: (None, 0.0))
    client = FakeClient(stores=[])
    raw_offers = [{
        "title": "Milch", "brand": None, "amount": None, "unit": "l", "price_cent": 99,
        "valid_from": None, "valid_to": None, "source_chain": "norma",
    }]

    assert offers_module.save_offers(client, raw_offers) == 0
    assert client.inserted == []


def test_leere_offer_liste():
    assert offers_module.save_offers(FakeClient(stores=[]), []) == 0
