# 06 — Modul: Angebote & Märkte

## Marktradius
- Startpunkt: Haushalts-Koordinate (Steinbach-Hallenberg)
- Radius konfigurierbar, Default 15 km
- Märkte **einmalig manuell gepflegt** (~15–25 Stück) — keine Auto-Discovery nötig
- Distanz/Fahrzeit per OSRM

## Angebotsquellen (einfach → aufwendig)
| Stufe | Quelle | Aufwand | Zuverlässigkeit |
|---|---|---|---|
| 1 | REWE nicht-authentifizierte Produkt-Endpunkte | niedrig | hoch |
| 2 | Prospekt-PDF direkt von Kettenseite | mittel | mittel |
| 3 | Aggregatoren (marktguru o. ä.) | mittel | ToS prüfen! |
| 4 | Playwright-Rendering | hoch | mittel |

**v1 = Stufe 1 + 2.** Stufe 3/4 nur bei Bedarf.

## PDF-Prospekt-Pipeline
1. PDF laden (URL pro Kette gepflegt in `stores`/Config)
2. `pdfplumber` → Text + Bounding Boxes pro Seite
3. Seitenweise an **Claude Haiku**: "extrahiere Angebote als JSON-Array"
   → `title · brand · amount · unit · price_cent · valid_from · valid_to`
4. Matching gegen `ingredients` (Alias, dann pgvector-Embedding-Fallback)
5. `confidence < 0.7` → Review-Queue, nicht in den Optimizer

## Scheduling
- Cron Mo 05:00 + Do 05:00 (typische Prospektwechsel)
- `pg_advisory_lock(hashtext(chain))` gegen Doppelläufe
- Angebote nie löschen → `price_history` für Plausibilität

## Preis-Plausibilität
Ein Angebot zählt nur als Ersparnis wenn
`price_cent < median(price_history, 90 Tage) × 0.9`
→ verhindert Schein-Angebote.

## Definition of Done
- [ ] ≥ 5 Ketten im Umkreis erfasst
- [ ] Review-UI für niedrige Confidence
- [ ] Preishistorie-Chart pro Zutat
