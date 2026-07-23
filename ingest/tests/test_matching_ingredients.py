from types import SimpleNamespace

from matching.ingredients import match_ingredient


class FakeQuery:
    def __init__(self, data):
        self._data = data

    def select(self, *_a, **_k):
        return self

    def ilike(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def execute(self):
        return SimpleNamespace(data=self._data)


class FakeRpc:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return SimpleNamespace(data=self._data)


class FakeClient:
    def __init__(self, exact_data=None, fuzzy_data=None):
        self.exact_data = exact_data or []
        self.fuzzy_data = fuzzy_data or []

    def from_(self, _table):
        return FakeQuery(self.exact_data)

    def rpc(self, _name, _params):
        return FakeRpc(self.fuzzy_data)


def test_exakter_treffer_hat_confidence_1():
    client = FakeClient(exact_data=[{"ingredient_id": "ing-1"}])
    assert match_ingredient(client, "Tomate") == ("ing-1", 1.0)


def test_fuzzy_treffer_uebernimmt_similarity():
    client = FakeClient(fuzzy_data=[{"ingredient_id": "ing-2", "alias": "Tomaten", "similarity": 0.62}])
    assert match_ingredient(client, "Tomatn") == ("ing-2", 0.62)


def test_kein_treffer():
    client = FakeClient()
    assert match_ingredient(client, "Unbekanntes Produkt XYZ") == (None, 0.0)


def test_leerer_name_ohne_query():
    client = FakeClient(exact_data=[{"ingredient_id": "sollte-nicht-treffen"}])
    assert match_ingredient(client, "   ") == (None, 0.0)
