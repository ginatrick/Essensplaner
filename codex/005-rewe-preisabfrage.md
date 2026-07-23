# Aufgabe: REWE-Preisabfrage (Abholservice)

Roadmap Phase 4: "REWE-Preisabfrage". Deckt Stufe 1 aus
`docs/06-modul-angebote.md` für die Kette REWE ab, Grundlage für den
Vergleich in `docs/08-modul-rewe-vergleich.md`. Läuft im Ingest-Service
(`ingest/`, FastAPI-Grundgerüst aus Phase 4 Schritt 1 existiert bereits,
siehe `ingest/main.py`, `ingest/auth.py`, `ingest/clients/supabase.py`).

## Vorarbeit (bereits erledigt, nicht neu bauen)

- `stores.rewe_market_id` existiert (Migration `20260723120000_rewe_preisabfrage.sql`),
  enthält die REWE-eigene Markt-ID ("wwIdent", **nicht** `stores.id`). Aktuell befüllt
  für die REWE-Filialen Schmalkalden/Zella-Mehlis aus `20260723110000_seed_stores.sql`.
- Tabelle `rewe_prices` existiert (gleiche Migration), Schema siehe unten.

## Der API-Kontrakt (von Claude Code live gegen die echte REWE-Website verifiziert)

**Wichtig:** Das ist die normale REWE-Web-Shop-API, **nicht** die App-Backend-API.
Die App-API ist seit 2024 hinter Cloudflare mTLS (App-Zertifikat nötig) — diese hier
nicht, ein normaler HTTPS-Request mit Browser-User-Agent reicht.

```
GET https://shop.rewe.de/api/products
```

**Query-Parameter (alle erforderlich, sonst `NO_HIT`/leeres Ergebnis):**
- `market` — `stores.rewe_market_id` der Filiale
- `search` — Suchbegriff (siehe "Zutaten-Matching" unten)
- `serviceTypes` — **exakt** `PICKUP` (Abholservice). `DELIVERY` liefert bei unseren
  Filialen 0 Treffer (nicht enrollt), `PICKUP,DELIVERY` kombiniert → HTTP 400.
- `objectsPerPage` — z. B. `10` (wir brauchen nur den besten Treffer, siehe unten)
- `page` — `1`
- `sorting` — `RELEVANCE_DESC`

**Header:**
- `accept: application/vnd.rewe.productlist+json`
- Realistischer Browser-User-Agent (z. B. `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`)

**Beispiel (funktioniert, live getestet):**
```
GET https://shop.rewe.de/api/products?market=1469536&search=milch&serviceTypes=PICKUP&objectsPerPage=10&page=1&sorting=RELEVANCE_DESC
```

**Response-Form (relevanter Ausschnitt, ein Produkt aus `_embedded.products[]`):**
```json
{
  "productName": "REWE Frei von Fettarme H-Milch laktosefrei 1,5% 1l",
  "_embedded": {
    "articles": [{
      "_embedded": {
        "listing": {
          "pricing": {
            "currentRetailPrice": 109,
            "currency": "EUR",
            "basePrice": 109,
            "baseUnit": { "KG": 1 },
            "grammage": "1l",
            "discount": {
              "regularPrice": 129,
              "discountRate": 15.0,
              "validTo": "2026-07-25T00:00:00CEST"
            }
          }
        }
      }
    }]
  }
}
```
- `currentRetailPrice`: aktueller Preis in **Cent** (Integer, kein Float-Parsing nötig)
- `basePrice` + `baseUnit`: Grundpreis in Cent pro **kg** (`baseUnit: {"KG": 1}`) oder pro
  **Liter** (`baseUnit: {"L": 1}`) — **nur vorhanden bei Gewicht/Volumen-Artikeln**,
  fehlt bei reiner Stückware (z. B. "3 Stück Salatherzen")
- `discount`: **nur vorhanden**, wenn das Produkt gerade im Angebot ist. Vorhanden →
  `is_offer = true`.
- `grammage`: Freitext, **nicht parsen** (siehe unten, wir brauchen es nicht)

## Mapping auf `rewe_prices` — bewusst ohne Grammage-Text-Parsing

`grammage` ist ein unstrukturierter Freitext mit vielen Formen
(`"500g (1 kg = 3,38 €)"`, `"1 Stück ca. 200 g (1 kg = 1,79 €)"`, `"3 Stück"`, ...) —
das zuverlässig zu parsen ist unnötiger Aufwand, wenn `basePrice`/`baseUnit` bereits
einen sauberen, ganzzahligen Grundpreis liefern. Deshalb:

- **Wenn `baseUnit` vorhanden ist** (Gewicht/Volumen-Artikel):
  `amount = 1000`, `unit = 'g'` (bei `baseUnit.KG`) oder `'ml'` (bei `baseUnit.L`),
  `price_cent = basePrice` (Cent pro 1000 Basiseinheiten — direkt aus der API, keine
  Umrechnung nötig).
- **Wenn `baseUnit` fehlt** (Stückware): `amount = 1`, `unit = 'stk'`,
  `price_cent = currentRetailPrice`.
- `is_offer = "discount" in pricing`
- `product_name = productName`
- `market_id = <die abgefragte stores.rewe_market_id>`
- `fetched_at = now()`

Damit ist `price_cent` immer der Preis für `(amount, unit)`, konsistent mit dem Rest
des Schemas (`docs/03-datenmodell.md`), und lässt sich später 1:1 mit dem
Einkaufslisten-Bedarf (`web/lib/plan/aggregate.ts`, Basiseinheit g/ml/stk) multiplizieren.

## Zutaten-Matching (v1, bewusst einfach)

- Suchbegriff = `ingredients.name` direkt (kein Alias-Lookup in dieser Aufgabe —
  `ingredient_aliases.source = 'rewe'` ist im Schema vorgesehen, aber Befüllung ist
  ein separater Schritt für später, nicht Teil dieser Aufgabe).
- Bester Treffer = **erstes Element** aus `_embedded.products[]` (REWE sortiert selbst
  nach `RELEVANCE_DESC`). Kein Fuzzy-Matching, kein Confidence-Score in v1 — anders als
  bei der Prospekt-PDF-Pipeline ist das hier eine strukturierte Suche gegen einen
  sauberen Katalog, kein LLM-Extrakt.
- `NO_HIT`/leere `_embedded.products` → kein Treffer, kein Fehler (ist ein normaler
  Fall, kein Crash).

## Caching (siehe docs/08-modul-rewe-vergleich.md: "Cache 24 h in rewe_prices")

Vor jedem REWE-API-Call: prüfen, ob für `(ingredient_id, market_id)` bereits eine Zeile
in `rewe_prices` mit `fetched_at > now() - interval '24 hours'` existiert. Wenn ja: die
vorhandene Zeile zurückgeben, kein neuer API-Call. Sonst: API-Call, Ergebnis als neue
Zeile einfügen (alte Zeilen bleiben stehen, keine `upsert`/Überschreibung — Verlauf ist
für spätere Preishistorie nützlich, auch wenn `rewe_prices` selbst kein
Plausibilitäts-Feld hat).

## Dateiaufteilung

- `ingest/sources/rewe/fetch.py`:
  - `fetch_price(ingredient_name: str, market_id: str) -> ReweHit | None` — reiner
    HTTP-Call + Mapping (kein DB-Zugriff), `ReweHit` = `TypedDict` oder `dataclass`
    mit Feldern `product_name, amount, unit, price_cent, is_offer`.
  - Fehler (Netzwerk, HTTP != 200, unerwartetes JSON-Format) → `None` zurückgeben,
    nicht werfen. Degradation statt Crash (`docs/13-recht-risiken.md`).
- `ingest/main.py`: neuer Endpoint
  `GET /rewe/price?ingredient_id=<uuid>&market_id=<wwIdent>`, hinter
  `Depends(require_ingest_secret)` (siehe `ingest/auth.py`, gleiches Muster wie
  `/whoami`). Ablauf: Cache-Check in `rewe_prices` (siehe oben) → bei Miss
  `ingredients.name` per `ingredient_id` aus Supabase laden → `fetch_price()` →
  Ergebnis in `rewe_prices` einfügen (via `ingest/clients/supabase.py`) → Response
  zurückgeben. Kein Treffer → `{"hit": false}` mit HTTP 200 (kein 404/500, ist ein
  normaler Fall).

## Tests

Fixture-basiert, **kein echter Netzwerkverkehr** (Projekt-Regel, siehe
`.claude/agents/ingest-entwickler.md`). Mindestens:
- Zwei feste JSON-Response-Fixtures unter `ingest/tests/fixtures/rewe/`: eine mit
  Gewicht/Volumen-Artikel (`baseUnit` vorhanden), eine mit Stückware (kein `baseUnit`),
  eine mit `discount`. Mapping-Ergebnis pro Fixture prüfen (`amount`, `unit`,
  `price_cent`, `is_offer`).
- `NO_HIT`-Fixture (leeres `_embedded.products`) → `fetch_price()` gibt `None`.
- Fehlerfall (kaputtes/unerwartetes JSON) → `fetch_price()` gibt `None`, kein Crash.
- Cache-Verhalten des `/rewe/price`-Endpoints: zweiter Aufruf innerhalb 24h ruft
  `fetch_price()` nicht erneut auf (mocken/patchen, nicht per echtem Timing testen).

## Definition of Done

- [ ] `ingest/sources/rewe/fetch.py` mit `fetch_price()`, getestet gegen die
      Fixtures oben, kein Live-Netzwerkverkehr in Tests
- [ ] `GET /rewe/price` in `ingest/main.py`, hinter `X-Ingest-Secret`, mit
      24h-Cache-Verhalten über `rewe_prices`
- [ ] Manuell gegen die echte API geprüft: mind. 3 verschiedene Zutaten
      (`market=1469536`, das ist der aktuell aktive Testmarkt Schmalkalden),
      Preise stimmen mit `https://www.rewe.de/shop/` überein
- [ ] `pytest` in `ingest/` läuft grün (bestehende `test_auth.py` weiterhin auch)
