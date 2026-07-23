from types import SimpleNamespace

import clients.supabase as supabase_client


class FakeDeleteQuery:
    def __init__(self, sink):
        self.sink = sink

    def eq(self, *_a, **_k):
        return self

    def lt(self, *_a, **_k):
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class FakeInsertQuery:
    def __init__(self, existing, sink):
        self.existing = existing
        self.sink = sink

    def insert(self, row):
        if row["chain"] in self.existing:
            raise Exception("duplicate key value violates unique constraint")
        self.sink.append(row["chain"])
        return SimpleNamespace(execute=lambda: SimpleNamespace(data=[row]))


class FakeTable:
    def __init__(self, existing, inserted, deleted):
        self.existing = existing
        self.inserted = inserted
        self.deleted = deleted
        self._mode = None

    def delete(self):
        self._mode = "delete"
        return self

    def insert(self, row):
        return FakeInsertQuery(self.existing, self.inserted).insert(row)

    def eq(self, _col, value):
        if self._mode == "delete":
            self.deleted.append(value)
        return self

    def lt(self, *_a, **_k):
        return self

    def execute(self):
        return SimpleNamespace(data=[])


class FakeClient:
    def __init__(self, existing=()):
        self.existing = set(existing)
        self.inserted: list[str] = []
        self.deleted: list[str] = []

    def from_(self, _table):
        return FakeTable(self.existing, self.inserted, self.deleted)


def test_try_lock_frei_gibt_true(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(supabase_client, "get_service_client", lambda: client)
    assert supabase_client.try_lock_chain("norma") is True
    assert client.inserted == ["norma"]


def test_try_lock_bereits_gesperrt_gibt_false(monkeypatch):
    client = FakeClient(existing={"norma"})
    monkeypatch.setattr(supabase_client, "get_service_client", lambda: client)
    assert supabase_client.try_lock_chain("norma") is False


def test_release_lock_loescht_zeile(monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(supabase_client, "get_service_client", lambda: client)
    supabase_client.release_lock_chain("norma")
    assert client.deleted == ["norma"]
