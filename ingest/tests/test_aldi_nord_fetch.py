from types import SimpleNamespace

from sources.aldi_nord import fetch as aldi_fetch


class FakeLocator:
    def __init__(self, records):
        self.records = records

    def evaluate_all(self, _script):
        return self.records


class FakePage:
    def __init__(self, records):
        self.records = records

    def locator(self, _selector):
        return FakeLocator(self.records)


class FakePageContext:
    def __init__(self, page):
        self.page = page

    def __enter__(self):
        return self.page

    def __exit__(self, *_args):
        return False


def test_aldi_parst_fixturedaten_und_abschnitt(monkeypatch):
    page = FakePage([
        {"title": "Aubergine", "brand": "", "price": "0.59**", "unit": "Stück", "section": "Ab Do, 23.7"},
        {"title": "Bio-Möhren", "brand": "GUT BIO", "price": "1.29", "unit": "500-g-Schale", "section": "Ab Do, 23.7"},
    ])
    monkeypatch.setattr(aldi_fetch, "rendered_page", lambda *_args, **_kwargs: FakePageContext(page))

    assert aldi_fetch.fetch() == [
        {"title": "Aubergine", "brand": None, "amount": None, "unit": "Stück", "price_cent": 59,
         "valid_from": "2026-07-23", "valid_to": None, "source_chain": "aldi_nord"},
        {"title": "Bio-Möhren", "brand": "GUT BIO", "amount": None, "unit": "500-g-Schale", "price_cent": 129,
         "valid_from": "2026-07-23", "valid_to": None, "source_chain": "aldi_nord"},
    ]


def test_aldi_ohne_kacheln_ist_leer(monkeypatch):
    monkeypatch.setattr(aldi_fetch, "rendered_page", lambda *_args, **_kwargs: FakePageContext(FakePage([])))
    assert aldi_fetch.fetch() == []
