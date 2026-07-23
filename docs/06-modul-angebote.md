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

## Status pro Kette (Stand Recherche 2026-07-23)

| Kette | Weg | Aufwand |
|---|---|---|
| REWE | Stufe 1, Live-API (`shop.rewe.de/api/products`) | erledigt, siehe `codex/005-rewe-preisabfrage.md` |
| Lidl, Kaufland | Stufe 2, PDF über gemeinsame Schwarz-Gruppe-Plattform (`endpoints.leaflets.schwarz`) | `codex/006-prospekt-schwarz-leaflets.md` |
| ALDI Nord, Norma | Angebote direkt strukturiert im HTML der eigenen Website, kein PDF/Haiku nötig | `codex/007-prospekt-aldi-norma.md` |
| EDEKA, Netto | Blocken automatisierte Zugriffe aktiv (HTTP 403, auch mit gerendertem Browser) — bewusst **nicht** verfolgt, das wäre aktives Umgehen von Bot-Schutz statt normales Scraping | zurückgestellt |

Aggregatoren (Stufe 3, z. B. marktguru) sind raus: AGB verbieten
automatisiertes Auslesen explizit ("Untersagt ist insbesondere auch der
Einsatz von Computerprogrammen zum automatischen Auslesen von Daten.").

## PDF-Prospekt-Pipeline
1. PDF laden (URL pro Kette gepflegt in `stores`/Config)
2. `pdfplumber` → Text + Bounding Boxes pro Seite
3. Seitenweise an **Claude Haiku**: "extrahiere Angebote als JSON-Array"
   → `title · brand · amount · unit · price_cent · valid_from · valid_to`
4. Matching gegen `ingredients` (Alias, dann pgvector-Embedding-Fallback)
5. `confidence < 0.7` → Review-Queue, nicht in den Optimizer

## Scheduling
- Cron Mo 05:00 + Mi 05:00 (reicht für den aktuellen Bedarf; nur internes Tool, siehe docs/13)
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
