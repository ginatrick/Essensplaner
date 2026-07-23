# Aufgabe: Angebots-Scraping — ALDI Nord & Norma (direkt im HTML, kein PDF)

Roadmap Phase 4: "Prospekt-PDF-Pipeline mit Haiku" — für ALDI Nord und Norma
**ohne PDF und ohne Haiku**, siehe Begründung unten. Deckt trotzdem denselben
Zweck aus `docs/06-modul-angebote.md` ab: Wochenangebote als strukturierte
Rohdaten.

**Nicht Teil dieser Aufgabe:** Matching gegen `ingredients` und DB-Schreiben —
separater, folgender Roadmap-Schritt. Diese Aufgabe endet bei `list[RawOffer]`.

## Warum kein PDF/Haiku nötig (von Claude Code live verifiziert)

Anders als bei Lidl/Kaufland (`codex/006-prospekt-schwarz-leaflets.md`) zeigen
ALDI Nord und Norma ihre Wochenangebote direkt als strukturiertes HTML auf der
eigenen Website — Produktname, Marke, Preis, Packungsgröße und Grundpreis
liegen als saubere, einzeln adressierbare DOM-Elemente vor. Ein LLM-Aufruf pro
Seite wäre hier unnötiger Aufwand (Kosten, Latenz, Fehlerquelle) für Daten,
die bereits strukturiert sind — deterministisches Parsen reicht.

Beide Seiten laden ihre Inhalte per Client-JS nach (kein Server-Side-Rendering,
im rohen HTML nicht sichtbar) → `ingest/sources/_browser.py`,
`rendered_page(url)` verwenden.

### ALDI Nord

Einstieg: `rendered_page("https://www.aldi-nord.de/angebote.html")`.

Produkt-Kacheln haben die CSS-Klasse `product-tile`, live verifiziertes
Beispiel-Markup (Auszug, ein einzelnes `.product-tile`):
```html
<h2 class="... product-tile__content__upper__product-name"
    data-testid="product-tile-grid-product-tile-1-product-name">Aubergine</h2>
<p class="product-tile__content__upper__brand-name"
   data-testid="product-tile-grid-product-tile-1-brand-name"></p>
<span class="tag__label tag__label--price"
      data-testid="product-tile-grid-product-tile-1-tag-current-price-amount">0.59<sup>**</sup></span>
<span class="tag__marker tag__marker--salesunit"
      data-testid="product-tile-grid-product-tile-1-tag-sales-unit">Stück</span>
```
- Produktname: `.product-tile__content__upper__product-name` (Text)
- Marke: `.product-tile__content__upper__brand-name` (Text, oft leer —
  `brand = None` wenn leer, kein Fehler)
- Preis: `[data-testid$="-tag-current-price-amount"]` — Text wie `"0.59"`,
  ggf. mit `<sup>` (Fußnoten-Sternchen wie `**`) davor/danach im Text, das
  muss beim Parsen ignoriert werden (Regex auf die erste Dezimalzahl im
  Text reicht, kein voller HTML-Parser für die `<sup>`-Behandlung nötig).
  Format ist deutsches Komma **im Rohtext steht ein Punkt** (z. B. `"0.59"`,
  nicht `"0,59"") — trotzdem als Cent-Integer speichern: `price_cent =
  round(float(text) * 100)`.
- Menge/Einheit: `.tag__marker--salesunit`, Rohtext wie `"Stück"`,
  `"500-g-Schale"`, `"kg-Preis"` — **als Rohtext in `unit` übernehmen, nicht
  parsen** (Format ist uneinheitlich genug, dass ein Parser hier mehr Fehler
  produziert als er löst; Parsing/Normalisierung ist Aufgabe des separaten
  Matching-Schritts, nicht dieser Aufgabe).
- `amount`: in dieser Aufgabe **immer `None`** — die Menge steckt im
  `unit`-Rohtext (siehe oben), eine saubere Trennung amount/unit ist beim
  ALDI-Rohtext ohne Zusatzwissen nicht zuverlässig möglich. Der spätere
  Matching-Schritt parst `unit` bei Bedarf weiter.
- `valid_from`/`valid_to`: Es gibt auf der Seite Abschnitts-Überschriften wie
  `"Ab Do, 23.7"`/`"Ab Mo, 20.7"` (siehe Anker-Links
  `#Ab-Do--23-7--...`/`#Ab-Mo--20-7--...` in der Seiten-Navigation) — jede
  Produkt-Kachel gehört zum nächstgelegenen vorherigen Abschnitt in der
  DOM-Reihenfolge. Jahr: aktuelles Jahr (Seite zeigt nur Tag.Monat).
  `valid_to`: nicht zuverlässig aus der Seite ableitbar in v1 → `None` ist
  ok, kein Raten.

### Norma

Einstieg: `rendered_page("https://www.norma-online.de/de/angebote/obst-und-gemuese/")`
als Startpunkt (Lebensmittel-Kategorie, live verifiziert — enthält
Produkttext wie `"Bio-Zucchini · je 500 g · 1 kg = 2,58 · 1,29*"` direkt im
sichtbaren Text). **Die genaue DOM-Struktur (CSS-Klassen/`data-testid`) ist
in dieser Aufgabe noch nicht reverse-engineert — das ist Teil der Aufgabe.**
Vorgehen: mit `page.content()`/Chrome DevTools (lokal, manuell) die
Kachel-Struktur identifizieren, analog zum ALDI-Muster oben (Name, Marke,
Preis, Mengenangabe als einzelne Elemente, keine freie Text-Extraktion über
`inner_text()` der ganzen Seite — das mischt Navigation/Werbetext mit
Produktdaten und ist nicht zuverlässig parsbar).

Preisformat bei Norma ist deutsches Komma (`"1,29*"` statt `"0.59"` wie bei
ALDI) — beim Parsen beachten (`.` vs `,` als Dezimaltrenner ist
Ketten-spezifisch, nicht raten, sondern für jede Kette einzeln fest
kodieren).

Norma hat neben der Obst-&-Gemüse-Seite weitere Themen-Kategorien
(`https://www.norma-online.de/de/angebote/` verlinkt sie) — **in dieser
Aufgabe reicht die eine Kategorie "Obst & Gemüse"** (einzige mit
garantiertem Lebensmittelbezug, live verifiziert). Weitere Kategorien sind
ein möglicher Folgeschritt, nicht Teil dieser Aufgabe.

## Dateiaufteilung

- `ingest/sources/aldi_nord/fetch.py`: `fetch() -> list[RawOffer]`
- `ingest/sources/norma/fetch.py`: `fetch() -> list[RawOffer]`
- `RawOffer` (TypedDict/dataclass, identisch zur Definition in
  `codex/006-prospekt-schwarz-leaflets.md` — **dieselbe Form wiederverwenden,
  z. B. aus einem gemeinsamen `ingest/sources/_types.py`, nicht duplizieren**):
  `title, brand, amount, unit, price_cent, valid_from, valid_to, source_chain`
- Fehler (Netzwerk, Playwright-Timeout, Seitenstruktur hat sich geändert und
  0 Kacheln gefunden) → leere Liste, kein Crash (`docs/13-recht-risiken.md`).
  Speziell "0 Kacheln gefunden, obwohl Seite lud" ist ein normaler
  Degradations-Fall (Website-Struktur hat sich geändert) — kein Retry-Loop,
  einfach leere Liste + (optional) ein Log-Hinweis.

## Tests

Kein echter Netzwerk-/Browser-Zugriff in Tests:
- Gemockte `rendered_page`: eine kleine, selbst geschriebene HTML-Fixture
  pro Kette mit 2–3 Produkt-Kacheln im oben beschriebenen Muster (nicht die
  echte, riesige Seite als Fixture speichern — nur das Nötigste
  nachbauen). Playwright kann eine Fixture-HTML-Datei auch direkt laden
  (`page.goto("data:text/html," + html)` oder `page.set_content(html)`)
  statt eine echte URL zu mocken.
- Erwartetes `RawOffer`-Array pro Fixture prüfen, inkl. Preis-Parsing
  (Punkt bei ALDI, Komma bei Norma) und leerer `brand`.
- Kaputte/fehlende Kachel-Struktur (0 Treffer) → leere Liste, kein Crash.

## Definition of Done

- [ ] `fetch()` für beide Ketten liefert `list[RawOffer]`, getestet gegen
      Fixtures, kein Live-Netzwerk in Tests
- [ ] Manuell einmal live geprüft: mind. 15 plausible Angebote pro Kette,
      Preise stimmen mit der echten Website überein
- [ ] `pytest` in `ingest/` läuft grün (bestehende Tests weiterhin auch)
