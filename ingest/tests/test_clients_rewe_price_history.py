from types import SimpleNamespace

import clients.supabase as supabase_client


class FakeRewePricesQuery:
    def select(self, *_a, **_k):
        return self

    def single(self):
        return self

    def execute(self):
        return SimpleNamespace(data={"product_name": "Milch", "amount": 1000, "unit": "ml", "price_cent": 109, "is_offer": False})


class FakeRewePricesTable:
    def insert(self, _row):
        return FakeRewePricesQuery()


class FakeStoresQuery:
    def __init__(self, store_id):
        self.store_id = store_id

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        data = [{"id": self.store_id}] if self.store_id else []
        return SimpleNamespace(data=data)


class FakeClient:
    def __init__(self, store_id):
        self.store_id = store_id
        self.price_history_inserts: list[dict] = []

    def from_(self, table):
        if table == "rewe_prices":
            return FakeRewePricesTable()
        if table == "stores":
            return FakeStoresQuery(self.store_id)
        if table == "price_history":
            self._sink = []
            return self
        raise AssertionError(f"unerwartete Tabelle: {table}")

    def insert(self, row):
        self.price_history_inserts.append(row)
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=[row]))


def test_insert_rewe_price_loggt_price_history_bei_bekanntem_markt(monkeypatch):
    client = FakeClient(store_id="store-schmalkalden")
    monkeypatch.setattr(supabase_client, "get_service_client", lambda: client)

    supabase_client.insert_rewe_price("ing-1", "1469536", {"product_name": "Milch", "amount": 1000, "unit": "ml", "price_cent": 109, "is_offer": False})

    assert client.price_history_inserts == [{"ingredient_id": "ing-1", "store_id": "store-schmalkalden", "price_cent": 109}]


def test_insert_rewe_price_ohne_bekannten_markt_ueberspringt_history(monkeypatch):
    client = FakeClient(store_id=None)
    monkeypatch.setattr(supabase_client, "get_service_client", lambda: client)

    supabase_client.insert_rewe_price("ing-1", "unbekannt", {"product_name": "Milch", "amount": 1000, "unit": "ml", "price_cent": 109, "is_offer": False})

    assert client.price_history_inserts == []
