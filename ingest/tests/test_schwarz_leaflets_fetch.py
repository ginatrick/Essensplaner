from sources.schwarz_leaflets import fetch as schwarz_fetch


class FakeStreamResponse:
    status_code = 200
    request = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def iter_bytes(self):
        return iter([b"fake-pdf"])


def test_fetch_orchestriert_download_und_extraktion(monkeypatch):
    monkeypatch.setattr(schwarz_fetch, "find_current_lidl_pdf_url", lambda: "https://test/lidl.pdf")
    monkeypatch.setattr(schwarz_fetch.httpx, "stream", lambda *_args, **_kwargs: FakeStreamResponse())
    monkeypatch.setattr(schwarz_fetch, "extract_offers_from_pdf", lambda _path, chain: [{
        "title": "Milch", "brand": None, "amount": 1000, "unit": "ml", "price_cent": 99,
        "valid_from": None, "valid_to": None, "source_chain": chain,
    }])

    result = schwarz_fetch.fetch("lidl")
    assert result[0]["title"] == "Milch"
    assert result[0]["source_chain"] == "lidl"


def test_unbekannte_kette_ist_programmierfehler():
    try:
        schwarz_fetch.fetch("rewe")
    except ValueError as error:
        assert "Unbekannte Kette" in str(error)
    else:
        raise AssertionError("ValueError erwartet")
