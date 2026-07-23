from sources.schwarz_leaflets import discover


class FakeLocator:
    def __init__(self, links):
        self.links = links

    def evaluate_all(self, _script):
        return self.links


class FakePage:
    def __init__(self, links):
        self._links = links

    def locator(self, _selector):
        return FakeLocator(self._links)


class FakePageContext:
    def __init__(self, page):
        self.page = page

    def __enter__(self):
        return self.page

    def __exit__(self, *_args):
        return False


class FakeResponse:
    status_code = 200

    def __init__(self, url):
        self.url = url

    def json(self):
        return {"flyer": {"pdfUrl": self.url}}


def test_lidl_filtert_aktionsprospekt_und_aktualitaet(monkeypatch):
    page = FakePage([
        {"href": "https://www.lidl.de/l/prospekte/reise-highlights-20-07-2026-25-07-2026-x/ar/0", "text": "Reise"},
        {"href": "https://www.lidl.de/l/prospekte/aktionsprospekt-20-07-2026-25-07-2026-x/ar/0", "text": "Aktion"},
    ])
    monkeypatch.setattr(discover, "rendered_page", lambda *_args, **_kwargs: FakePageContext(page))
    monkeypatch.setattr(discover.httpx, "get", lambda *_args, **kwargs: FakeResponse("https://test/lidl.pdf"))

    assert discover.find_current_lidl_pdf_url() == "https://test/lidl.pdf"


def test_kaufland_nimmt_alle_prospekte_und_uebergibt_region(monkeypatch):
    page = FakePage([
        {"href": "https://leaflets.kaufland.com/de-DE/DE_de_Hyper1_3000_D30-H/ar/3000", "text": ""},
        {"href": "https://leaflets.kaufland.com/de-DE/DE_de_KDZ_3000/ar/3000", "text": ""},
    ])
    calls = []
    monkeypatch.setattr(discover, "rendered_page", lambda *_args, **_kwargs: FakePageContext(page))
    monkeypatch.setattr(discover.httpx, "get", lambda *_args, **kwargs: calls.append(kwargs["params"]) or FakeResponse("https://test/k.pdf"))

    assert discover.find_current_kaufland_pdf_urls() == ["https://test/k.pdf", "https://test/k.pdf"]
    assert calls[0] == {"flyer_identifier": "DE_de_Hyper1_3000_D30-H", "region_id": "3000", "region_code": "3000"}
