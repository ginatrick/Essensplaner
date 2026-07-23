# Aufgabe: Prospekt-PDF-Pipeline — Lidl & Kaufland (Schwarz-Gruppe-Plattform)

Roadmap Phase 4: "Prospekt-PDF-Pipeline mit Haiku" für die Ketten Lidl und
Kaufland. Deckt Stufe 2 aus `docs/06-modul-angebote.md` ab. Beide Ketten
gehören zur Schwarz Gruppe und laufen über dieselbe Prospekt-Plattform —
**ein** Modul für beide, nur die Einstiegs-URL unterscheidet sich.

**Nicht Teil dieser Aufgabe:** Matching gegen `ingredients` (Alias/Confidence)
und das Schreiben in die DB — das ist der nächste Roadmap-Schritt
("Matching + Confidence + Review-UI"), separat. Diese Aufgabe endet bei
`list[RawOffer]` als reinem Rückgabewert.

## Von Claude Code bereits verifiziert (live, nicht neu recherchieren)

Beide Ketten nutzen `endpoints.leaflets.schwarz` (Schwarz-Gruppe-eigene
"Leaflets"-Plattform) im Hintergrund:

```
GET https://endpoints.leaflets.schwarz/v4/flyer?flyer_identifier=<id>&region_id=<region>&region_code=<region>
```

Antwort (Ausschnitt, live getestet):
```json
{
  "flyer": {
    "title": "20.07.2026 – 25.07.2026",
    "pdfUrl": "https://object.storage.eu01.onstackit.cloud/leaflets/pdfs/<uuid>/<name>.pdf"
  }
}
```
`pdfUrl` ist ein direkter, unauthentifizierter Download-Link (live getestet,
83 MB PDF, HTTP 200 per normalem `GET`). Der `flyer_identifier` (+ `region_id`)
steht **nicht** im statischen HTML der Übersichtsseiten — die Seiten laden per
Client-JS nach, deshalb Playwright nötig (`ingest/sources/_browser.py`,
`rendered_page(url)` — liefert eine Playwright-`Page` nach JS-Rendering).

### Lidl — Einstieg

1. `rendered_page("https://www.lidl.de/c/online-prospekte/s10005610")` öffnen.
2. Links extrahieren, die zu `/l/prospekte/aktionsprospekt-*` führen (z. B.
   `https://www.lidl.de/l/prospekte/aktionsprospekt-20-07-2026-25-07-2026-9c5017/ar/0?...`).
   Es gibt mehrere Prospekte gleichzeitig (aktuell + nächste Woche + Themen
   wie "Reise-Highlights") — **nur den aktuell laufenden "Aktionsprospekt"**
   nehmen (Name enthält "aktionsprospekt", Datum im Namen deckt das heutige
   Datum ab). Andere Prospekt-Typen (Reise, Tarife, Rezeptmagazin) ignorieren
   — kein Lebensmittelbezug.
3. `flyer_identifier` = der Pfad-Teil zwischen `/prospekte/` und `/ar/0`
   (z. B. `aktionsprospekt-20-07-2026-25-07-2026-9c5017`), `region_id=0`,
   `region_code=0` (national, keine Filial-spezifische Auflösung in v1).
4. `v4/flyer`-Endpoint aufrufen (normaler `httpx`-GET reicht, kein Playwright
   nötig für diesen Schritt) → `pdfUrl` extrahieren.

### Kaufland — Einstieg

1. `rendered_page("https://filiale.kaufland.de/prospekte.html")` öffnen.
2. Links extrahieren, die zu `leaflets.kaufland.com/de-DE/<identifier>/ar/<region>`
   führen (z. B. `https://leaflets.kaufland.com/de-DE/DE_de_Hyper1_3000_D30-H/ar/3000`).
   Mehrere gleichzeitig aktive Prospekte möglich (z. B. Hyper-Prospekt +
   "KDZ"-Wochenend-Sonderprospekt) — **alle** mitnehmen, die zum jetzigen
   Zeitpunkt gültig sind (kein Filtern auf einen einzelnen wie bei Lidl,
   Kaufland-Prospekte überschneiden sich normal).
3. `flyer_identifier` = der Pfad-Teil zwischen `/de-DE/` und `/ar/`,
   `region_id` = der Wert nach `/ar/` in der URL, `region_code` = derselbe
   Wert (national/Default-Region, kein Filial-Bezug in v1).
4. `v4/flyer`-Endpoint aufrufen → `pdfUrl` extrahieren.

## PDF → Text → Haiku (docs/06, Schritt 2–3)

1. PDF herunterladen (`httpx`, normaler GET auf `pdfUrl`, kein Auth nötig).
   Die PDFs sind groß (Lidl-Testfall: 83 MB) — als Datei streamen, nicht
   komplett in den Speicher laden, wenn `httpx` das einfach hergibt
   (`httpx.stream`), sonst reicht für v1 auch ein normaler Download in eine
   Temp-Datei.
2. `pdfplumber` pro Seite: `page.extract_text()`. **Bestätigt:** Der Text ist
   real extrahierbar (kein reines Bild-PDF), aber layoutbedingt durcheinander
   (mehrspaltiges Flyer-Layout wird linear ausgelesen, Preis/Produktname/
   Grundpreis stehen nicht in lesbarer Reihenfolge nebeneinander) — genau
   deshalb Haiku pro Seite, nicht Regex.
3. Pro Seite an **Claude Haiku 4.5** (siehe `docs/11-modellwahl.md`):
   Prompt in etwa: "Das ist der durcheinandergewürfelte Text einer
   Prospekt-Seite von {chain}. Extrahiere alle erkennbaren Angebote als
   JSON-Array mit den Feldern title, brand (nullable), amount (Zahl,
   nullable wenn nicht erkennbar), unit (Roh-Text wie im Prospekt, z. B.
   'g', 'kg', 'Stück', '100 g', nullable), price_cent (Integer, der
   *aktuelle* Angebotspreis, nicht der durchgestrichene alte Preis),
   valid_from, valid_to (ISO-Datum, aus dem Prospekt-Titel/-Header
   übernehmen, nicht pro Seite neu raten). Kein Angebot erkennbar → leeres
   Array, keine Erfindung." Leere/kaputte Seiten (z. B. reine Werbe-/
   Rückseiten ohne Produkte) → leeres Array ist ein normaler, kein
   Fehler-Fall.
4. Seiten mit vielen Nicht-Lebensmitteln (Kleidung, Elektronik, Deko) liefern
   erwartbar wenig/keine Treffer — das ist gewollt, kein Bug, kein
   Vor-Filtern der Seiten nötig (Haiku sortiert implizit aus, indem es dort
   nichts extrahiert).

## Rate-Limit (docs/13-recht-risiken.md)

Max. 1 Lauf pro Kette pro Tag — das ist die Aufgabe des Aufrufers (Cron,
kommt in einem späteren Schritt), **nicht** hier hart im Modul verdrahten.
Trotzdem: `ingest/sources/_browser.py` nutzt bereits einen Kontakt-User-Agent,
nicht verändern.

## Dateiaufteilung

- `ingest/sources/schwarz_leaflets/discover.py`:
  - `find_current_lidl_pdf_url() -> str | None`
  - `find_current_kaufland_pdf_urls() -> list[str]`
  - Playwright-Teil (Link-Extraktion) + `v4/flyer`-Call. Kein Netzwerk in
    Tests — Playwright-Teil mit einer gemockten `rendered_page`
    (`monkeypatch`), `v4/flyer`-Call mit gemocktem `httpx.get` und einer
    festen JSON-Fixture (Struktur oben, exakt wie live beobachtet).
- `ingest/sources/schwarz_leaflets/extract.py`:
  - `RawOffer` (TypedDict/dataclass): `title, brand, amount, unit,
    price_cent, valid_from, valid_to, source_chain`.
  - `extract_offers_from_pdf(pdf_path: str, chain: str) -> list[RawOffer]` —
    pdfplumber + Haiku-Call pro Seite, Ergebnisse aller Seiten zusammenführen.
    Haiku-Call über die Anthropic-SDK, **kein neuer API-Wrapper** — direkter
    Client-Call reicht für dieses eine Modul.
  - Haiku-Call in Tests mocken (feste Fixture-Response), **kein** echter
    API-Call in Tests (kostet Geld, ist außerdem Netzwerk).
- `ingest/sources/schwarz_leaflets/fetch.py`:
  - `fetch(chain: str) -> list[RawOffer]` — orchestriert discover → Download
    → extract, für `chain in ("lidl", "kaufland")`. Bei unbekannter Kette:
    Fehler (Programmierfehler des Aufrufers, kein Degradations-Fall).
  - Fehler in `discover`/Download (Netzwerk, kein aktueller Prospekt
    gefunden) → leere Liste zurückgeben, kein Crash (`docs/13`).

## Tests

Fixture-basiert, kein echter Netzwerk-/Browser-Zugriff in Tests:
- `discover`: gemockte `rendered_page`-Rückgabe mit festen Links (Lidl- und
  Kaufland-Beispiel-HTML/Linkliste aus diesem Dokument), gemockter
  `v4/flyer`-JSON-Response → korrekte `pdfUrl`.
- `extract`: eine kleine Test-PDF (2–3 Seiten, im Repo unter
  `ingest/tests/fixtures/schwarz_leaflets/`, z. B. mit `reportlab` oder von
  Hand erzeugt — muss keine echte Prospekt-Seite sein, nur Text mit
  erkennbaren Produkt/Preis-Mustern enthalten) + gemockter Haiku-Response
  → erwartetes `RawOffer`-Array.
- Leere Haiku-Antwort/kaputtes JSON vom Modell → keine Exception, Seite wird
  übersprungen (leere Liste für diese Seite).

## Definition of Done

- [ ] `fetch("lidl")` und `fetch("kaufland")` liefern `list[RawOffer]`,
      getestet gegen Fixtures, kein Live-Netzwerk in Tests
- [ ] Manuell einmal live geprüft (echter Playwright-Lauf + echter
      Haiku-Call, **nicht** in der automatisierten Testsuite): mind. 10
      plausible Angebote pro Kette, Preise stimmen mit der echten
      Prospekt-Ansicht überein
- [ ] `pytest` in `ingest/` läuft grün (bestehende Tests weiterhin auch)
- [ ] Kein hartcodiertes Datum — `flyer_identifier`/Prospekt-Auswahl muss
      auch nächste Woche noch den dann aktuellen Prospekt finden
