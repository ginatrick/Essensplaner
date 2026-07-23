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
- [x] Matching + Confidence + Review-UI *(Tabelle `offers` + RPC `resolve_offer_match`; ingest/matching/ nutzt dieselbe Alias-Fuzzy-RPC wie der Rezept-Import (`match_ingredient_alias_fuzzy`), kein Embedding-Fallback in v1 — reicht, Miss landet einfach in der Review-Queue statt zweiter Matching-Stufe. Prospekt-Angebote gelten kettenweit, werden aber pro Filiale gefan-outet, damit `offers.store_id` wie im Schema strikt gesetzt bleibt. `/angebote`-Seite zum manuellen Zuordnen, schreibt dabei automatisch den Alias zurück)*
- [x] Cron Mo/Mi + advisory lock *(APScheduler in `ingest/main.py`, `ingest/scheduler.py` orchestriert alle 4 Prospekt-Ketten. Statt `pg_advisory_lock` (sessiongebunden, funktioniert nicht über die zustandslose PostgREST/supabase-py-API) eine Lock-Tabelle `ingest_locks` mit atomarem Insert als Try-Lock — gleicher Zweck, siehe Kommentar in der Migration. Manueller Trigger (`POST /offers/sync`) läuft über denselben `sync_chain()`-Pfad, damit der Lock auch bei Cron+manuell gleichzeitig greift)*
- [x] `price_history` + Plausibilitätsfilter *(Tabelle + RPC `is_plausible_offer` nach der Formel aus docs/06: `price_cent < median(90 Tage) × 0.9`; bei < 3 Preispunkten gilt ein Angebot als plausibel, sonst würde jedes neue Angebot mangels Historie fälschlich abgelehnt. Wird beim Schreiben von Angeboten/REWE-Preisen automatisch befüllt — noch kein UI-Preisverlauf-Chart, das ist Teil der Definition of Done fürs Gesamtmodul, nicht dieser Schritt)*

## Phase 5 — Optimizer & REWE-Vergleich
- [x] Varianten A/B/C/D berechnen *(`web/lib/optimizer/`, reine TS-Logik, 19 Tests via `npm test`. Preisvergleich als Preis-pro-benötigter-Menge, keine Pack-Rundung pro Angebot — das ist ein Bin-Packing-Problem, das für einen Kosten-VERGLEICH nicht nötig ist, siehe pricing.ts)*
- [x] Routen-/Fahrtkosten (Brute Force ≤ 4 Märkte) *(route.ts: echte Haushalt→Markt-Distanz aus `stores`, Haversine-Näherung für Markt-zu-Markt-Strecken statt echter OSRM-Distanzmatrix — bewusste Vereinfachung, siehe Kommentar im Code)*
- [x] Vergleichstabelle + Empfehlungslogik *(`/preisvergleich`. REWE-Preise über neue Edge Function `supabase/functions/price-compare` — ruft den Ingest-Service auf, Secrets/Deployment noch manuell nötig, siehe `supabase/functions/README.md`)*
- [x] Settings: €/km, €/h, Toleranzen *(`/einstellungen`, Tabelle `user_settings`)*
- [x] Begründung pro Position *(aufklappbare Positionsliste zur empfohlenen Variante, sortiert nach größter Ersparnis, „bei X 1,29 € statt 1,99 € REWE" wenn REWE-Referenzpreis vorliegt)*

## Phase 6 — Ernährung
- [x] `nutrition_rules.json` + Evaluator *(als `web/lib/plan/nutrition_rules.ts` — TS-Konstante statt .json, JSON-Imports brauchen unter node:test Import-Attribute, unter Next.js nicht; genauso deklarativ. 8 Kriterien, Eisen/Calcium nährwertbasiert über `ingredients.iron_mg_100`/`calcium_mg_100`, Rest tag-basiert)*
- [x] Wochen-Ampel live in der Planbearbeitung *(`wochenplan-view.tsx`, läuft bei jeder Änderung der Wocheneinträge)*
- [x] Tauschvorschläge bei Rot *(deterministisch generiert — nennt die Tage, die das Kriterium (noch) nicht erfüllen, kein LLM, keine konkrete Rezept-Erfindung wie im docs/09-Beispiel, das wäre Phase-7-Vorschlags-Engine-Aufgabe)*
- [x] `household_members` + Trainingstage *(`/ernaehrung`, Tabelle `household_members`; bewusst ohne `nutrition_targets` — docs/13 untersagt Kalorien-Vorgaben pro Person in der UI, YAGNI ohne Verwendungszweck)*

## Phase 7 — Lernen
- [x] `habit_events` überall instrumentieren *(recipe_manual_add + recipe_swapped bei manueller Planbearbeitung, suggestion_accepted + recipe_rejected beim Wochenvorschlag. Bewusst NICHT instrumentiert: recipe_kept — es gibt keinen "unverändert übernommen"-Moment außerhalb des Vorschlags-Flows; item_unchecked — bräuchte einen "Einkauf abschließen"-Flow, den es noch nicht gibt)*
- [x] Nightly Aggregation → `taste_profile`, `recipe_stats` *(Postgres-Funktion `aggregate_habit_scores()` + pg_cron 03:00 täglich. `recipe_stats` aus der tatsächlichen Planungshistorie (meal_plans/meal_plan_entries), nicht aus habit_events — zuverlässiger. pg_cron muss im Supabase-Dashboard aktiviert sein, siehe Migrationskommentar)*
- [x] Kandidatenpool + Constraint-Solver *(`web/lib/suggestions/`: candidates.ts + solver.ts, greedy statt volles Backtracking — Ergebnis geht in die normale Planbearbeitung, wo die Wochen-Ampel aus Phase 6 live weiterhilft, falls nicht schon grün)*
- [x] Exploration ε *(1-2 Slots mit unbekanntem Rezept, ε=0.2, im Solver)*
- [x] Haiku-Begründung *(`explain.ts`, nur auf übergebene Fakten gestützt — keine erfundenen Rezept-Ähnlichkeiten wie im docs/10-Beispiel, weil wir keine echte Ähnlichkeitsmetrik haben)*
- [x] Akzeptanzrate-Dashboard *(`/auswertungen`: Akzeptanzrate, Rezept-Planungshistorie als Score-Debug-View, beliebte/unbeliebte Zutaten aus `taste_profile`)*

## Reihenfolge-Logik
Phase 3 ist bewusst **vor** den Preisen: Eine sortierte Einkaufsliste ohne
Preisvergleich ist bereits im Alltag nutzbar. Alles danach ist Optimierung.
