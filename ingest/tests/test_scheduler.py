import scheduler


def test_sync_chain_erfolgreich(monkeypatch):
    monkeypatch.setattr(scheduler, "try_lock_chain", lambda chain: True)
    released = []
    monkeypatch.setattr(scheduler, "release_lock_chain", lambda chain: released.append(chain))
    monkeypatch.setitem(scheduler.CHAIN_FETCHERS, "norma", lambda: [{"title": "Mango"}])
    monkeypatch.setattr(scheduler, "save_offers", lambda client, offers: len(offers))
    monkeypatch.setattr(scheduler, "get_service_client", lambda: "fake-client")

    result = scheduler.sync_chain("norma")

    assert result == {"chain": "norma", "offers_found": 1, "offers_saved": 1}
    assert released == ["norma"]  # Lock wird auch bei Erfolg freigegeben


def test_sync_chain_bereits_gesperrt_ueberspringt(monkeypatch):
    monkeypatch.setattr(scheduler, "try_lock_chain", lambda chain: False)
    called = []
    monkeypatch.setitem(scheduler.CHAIN_FETCHERS, "norma", lambda: called.append(True) or [])

    result = scheduler.sync_chain("norma")

    assert result == {"chain": "norma", "offers_found": 0, "offers_saved": 0, "error": "läuft bereits"}
    assert called == []  # Fetcher darf bei bestehendem Lock nicht aufgerufen werden


def test_sync_chain_unbekannte_kette_ohne_lock_versuch(monkeypatch):
    calls = []
    monkeypatch.setattr(scheduler, "try_lock_chain", lambda chain: calls.append(chain) or True)

    result = scheduler.sync_chain("nichtvorhanden")

    assert result == {"chain": "nichtvorhanden", "offers_found": 0, "offers_saved": 0, "error": "unbekannte Kette"}
    assert calls == []


def test_sync_chain_fehler_gibt_lock_trotzdem_frei(monkeypatch):
    monkeypatch.setattr(scheduler, "try_lock_chain", lambda chain: True)
    released = []
    monkeypatch.setattr(scheduler, "release_lock_chain", lambda chain: released.append(chain))

    def boom():
        raise RuntimeError("Playwright-Timeout")

    monkeypatch.setitem(scheduler.CHAIN_FETCHERS, "aldi_nord", boom)

    result = scheduler.sync_chain("aldi_nord")

    assert result == {"chain": "aldi_nord", "offers_found": 0, "offers_saved": 0, "error": "fehlgeschlagen"}
    assert released == ["aldi_nord"]


def test_run_scheduled_sync_deckt_alle_konfigurierten_ketten_ab(monkeypatch):
    calls = []
    monkeypatch.setattr(scheduler, "sync_chain", lambda chain: calls.append(chain) or {"chain": chain})

    result = scheduler.run_scheduled_sync()

    assert set(calls) == set(scheduler.CHAIN_FETCHERS)
    assert len(result) == len(scheduler.CHAIN_FETCHERS)
