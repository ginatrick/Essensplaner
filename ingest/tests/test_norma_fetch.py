from sources.norma import fetch as norma_fetch


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


def test_norma_nimmt_angebotspreis_nicht_grundpreis(monkeypatch):
    # Regression: .produktBox-txt-price ist der Grundpreis (z. B. "1 kg = 2,58"),
    # nicht der tatsächliche Angebotspreis — die Kachel liefert den echten Preis
    # separat über priceLabel (aria-label "1,29 Euro").
    page = FakePage([
        {"title": "Bio-Zucchini", "brand": "Bio Sonne", "quantity": "je 500 g",
         "priceLabel": "1,29 Euro", "section": "Artikel des Themas OBST & GEMÜSE. Verfügbar ab Montag, 20.07."},
    ])
    monkeypatch.setattr(norma_fetch, "rendered_page", lambda *_args, **_kwargs: FakePageContext(page))

    result = norma_fetch.fetch()
    assert result == [{
        "title": "Bio-Zucchini", "brand": "Bio Sonne", "amount": 500, "unit": "g", "price_cent": 129,
        "valid_from": "2026-07-20", "valid_to": None, "source_chain": "norma",
    }]


def test_norma_bindestrich_menge_und_stueck_ohne_zahl(monkeypatch):
    page = FakePage([
        {"title": "Äpfel", "brand": "River Valley Fresh", "quantity": "1-kg-Beutel",
         "priceLabel": "1,49 Euro", "section": "Ab Montag, 20.07."},
        {"title": "Mango", "brand": "", "quantity": "je Stück",
         "priceLabel": "1,69 Euro", "section": "Ab Montag, 20.07."},
    ])
    monkeypatch.setattr(norma_fetch, "rendered_page", lambda *_args, **_kwargs: FakePageContext(page))

    result = norma_fetch.fetch()
    assert result == [
        {"title": "Äpfel", "brand": "River Valley Fresh", "amount": 1, "unit": "kg", "price_cent": 149,
         "valid_from": "2026-07-20", "valid_to": None, "source_chain": "norma"},
        {"title": "Mango", "brand": None, "amount": None, "unit": "Stück", "price_cent": 169,
         "valid_from": "2026-07-20", "valid_to": None, "source_chain": "norma"},
    ]


def test_norma_ohne_preis_wird_uebersprungen(monkeypatch):
    page = FakePage([
        {"title": "Champignons", "brand": "", "quantity": "250-g-Schale", "priceLabel": "", "section": ""},
    ])
    monkeypatch.setattr(norma_fetch, "rendered_page", lambda *_args, **_kwargs: FakePageContext(page))
    assert norma_fetch.fetch() == []


def test_norma_ohne_kacheln_ist_leer(monkeypatch):
    monkeypatch.setattr(norma_fetch, "rendered_page", lambda *_args, **_kwargs: FakePageContext(FakePage([])))
    assert norma_fetch.fetch() == []
