# 12 — Roadmap

Checkboxen hier pflegen. `CLAUDE.md` bleibt unverändert.

## Phase 0 — Fundament
- [x] Next.js 15 + TS + Tailwind + shadcn Scaffold
- [x] Supabase-Projekt EU (eu-north-1), Login *(zunächst Magic Link, wegen E-Mail-Rate-Limit auf Passwort-Login umgestellt)*
- [x] Schema-Migration 001 (Stammdaten + Rezepte) inkl. RLS
- [x] Seed: `departments`, Top-200 `ingredients` mit Nährwerten *(→ Codex)*
- [x] Unit-Konversionstabelle + Tests *(→ Codex, wegen Schreibrechte-Problem selbst umgesetzt)*
- [x] Vercel-Deployment + Env-Handling

## Phase 1 — Rezepte
- [x] Rezept-CRUD-UI *(→ Codex)*
- [x] Zutaten-Parser Regex + Alias-Lookup
- [x] Haiku-Fallback + Alias-Rückschreibung
- [x] URL-Import mit JSON-LD *(→ Codex; Fetch läuft in Next.js statt Ingest, Phase 4 existiert noch nicht)*
- [x] Testset 20 Rezeptseiten, Trefferquote messen (91,5 %, siehe docs/05)

## Phase 2 — Speiseplan
- [x] Wochenraster-UI *(ohne Drag & Drop — Zuweisung per Inline-Suche, mit Nutzer abgestimmt; nur 1 Slot/Tag vorerst, Schema trägt bereits Mittag+Abend)*
- [x] `meal_plans` / `meal_plan_entries` + RLS
- [x] Regel-Hinweise (14-Tage, veg, Fisch, Aufwand) *(Aufwand-Schwelle ist ein einfacher genereller Wert prep+cook > 60 ohne Trainingstag-Bezug — `household_members`/Trainingstage kommen erst Phase 6; veg/Fisch per Freitext-Tag-Match statt festem Vokabular)*
- [x] Templates *(kein Beispiel-Set, nur eigene Vorlagen: „Als Vorlage speichern“ kopiert den aktuellen Plan in `meal_plans.status='template'` + neue Spalte `template_name`; Liste mit „Auf diese Woche anwenden“ überschreibt die betroffenen Tage der aktuellen Woche, kein Merge-Dialog)*
- [ ] PDF/PNG-Export *(→ Codex)*

## Phase 3 — Einkaufsliste (ohne Preise)
- [x] Zutaten-Aggregation über die Woche *(recipe_ingredients.amount ist bereits Basiseinheit, daher reiner skalierter Summen-Join ohne Unit-Konvertierung)*
- [x] Pantry-Modul + Abzug *(/vorraete, Tabelle `pantry`; Abzug nur bei Einheiten-Match, sonst wird der Vorrat ignoriert statt falsch gerechnet)*
- [x] Packungsrundung *(`ingredients.pack_size`/`pack_unit` nullable — ohne Angabe bleibt der Bedarf ungerundet; noch keine Datenpflege/Seed für Packungsgrößen)*
- [x] Gruppierung nach Abteilung in Laufreihenfolge *(/einkaufslisten, `web/lib/plan/aggregate.ts`)*
- [x] Abhaken, PWA-Offline *(Tabelle `shopping_checked`, optimistisches Abhaken; Offline-Stand der Liste in localStorage statt IndexedDB — kein Multi-Geräte-Konfliktabgleich; Service Worker cached nur den App-Shell, keine Hintergrund-Synchronisierung)*

## Phase 4 — Angebote & Ingest
- [x] FastAPI-Grundgerüst lokal, Shared-Secret-Auth *(`ingest/`, `GET /health` offen, alles andere hinter `X-Ingest-Secret`; Cloudflare Tunnel manuell einzurichten, Anleitung in `ingest/README.md`)*
- [x] `stores` manuell pflegen (15–25 Märkte) + OSRM-Distanzen *(20 Filialen: Edeka, Norma, Lidl, Aldi, Rewe, Netto, Kaufland im 15-km-Umkreis um 98587 Steinbach-Hallenberg; Koordinaten aus OSM/Overpass, distance_km/drive_min per öffentlichem OSRM-Server einmalig berechnet und fest eingetragen — kein Live-Redeploy bei Straßenänderungen)*
- [x] REWE-Preisabfrage *(von Codex nach `codex/005-rewe-preisabfrage.md` umgesetzt; `GET /rewe/price` in `ingest/`, 24h-Cache in `rewe_prices`. Nachkorrektur: `httpx.get` folgt standardmäßig keinen Redirects, `shop.rewe.de` leitet aber 301 auf `www.rewe.de/shop` um — `follow_redirects=True` ergänzt, sonst lief jede Anfrage ins Leere. Live gegen Markt Schmalkalden (1469536) mit 3 Zutaten verifiziert)*
- [x] Prospekt-PDF-Pipeline mit Haiku *(Lidl+Kaufland von Codex nach `codex/006-...` umgesetzt, live gegen Discovery+PDF-Download geprüft — Haiku-Extraktion nur gegen Fixtures getestet, kein `ANTHROPIC_API_KEY` in der Dev-Sandbox. Aldi+Norma nach `codex/007-...`: Codex-Lauf brach nach >2h ohne Ergebnis ab (offene DOM-Erkundung ohne fertige Selektoren, siehe Kontrakt), von Claude Code fertiggestellt — dabei einen echten Bug in Codex' Norma-Entwurf gefunden und behoben: die pauschalen `[class*="price"]`-Selektoren trafen den Grundpreis statt des Angebotspreises (Bio-Zucchini 2,58€/kg statt 1,29€ tatsächlicher Preis). Beide live verifiziert: Aldi 246, Norma 27 plausible Angebote. EDEKA/Netto blocken aktiv, zurückgestellt, siehe docs/06)*
- [ ] Matching + Confidence + Review-UI
- [ ] Cron Mo/Mi + advisory lock
- [ ] `price_history` + Plausibilitätsfilter

## Phase 5 — Optimizer & REWE-Vergleich
- [ ] Varianten A/B/C/D berechnen
- [ ] Routen-/Fahrtkosten (Brute Force ≤ 4 Märkte)
- [ ] Vergleichstabelle + Empfehlungslogik
- [ ] Settings: €/km, €/h, Toleranzen
- [ ] Begründung pro Position

## Phase 6 — Ernährung
- [ ] `nutrition_rules.json` + Evaluator
- [ ] Wochen-Ampel live in der Planbearbeitung
- [ ] Tauschvorschläge bei Rot
- [ ] `household_members` + Trainingstage

## Phase 7 — Lernen
- [ ] `habit_events` überall instrumentieren
- [ ] Nightly Aggregation → `taste_profile`, `recipe_stats`
- [ ] Kandidatenpool + Constraint-Solver
- [ ] Exploration ε
- [ ] Haiku-Begründung
- [ ] Akzeptanzrate-Dashboard

## Reihenfolge-Logik
Phase 3 ist bewusst **vor** den Preisen: Eine sortierte Einkaufsliste ohne
Preisvergleich ist bereits im Alltag nutzbar. Alles danach ist Optimierung.
