# 12 — Roadmap

Checkboxen hier pflegen. `CLAUDE.md` bleibt unverändert.

## Phase 0 — Fundament
- [x] Next.js 15 + TS + Tailwind + shadcn Scaffold
- [x] Supabase-Projekt EU (eu-north-1), Magic Link Auth
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
- [ ] Regel-Hinweise (14-Tage, veg, Fisch, Aufwand)
- [ ] Templates
- [ ] PDF/PNG-Export *(→ Codex)*

## Phase 3 — Einkaufsliste (ohne Preise)
- [ ] Zutaten-Aggregation über die Woche
- [ ] Pantry-Modul + Abzug
- [ ] Packungsrundung
- [ ] Gruppierung nach Abteilung in Laufreihenfolge
- [ ] Abhaken, PWA-Offline

## Phase 4 — Angebote & Ingest
- [ ] FastAPI-Grundgerüst lokal, Shared-Secret-Auth, Cloudflare Tunnel für Supabase-Zugriff
- [ ] `stores` manuell pflegen (15–25 Märkte) + OSRM-Distanzen
- [ ] REWE-Preisabfrage *(→ Codex, klarer Kontrakt)*
- [ ] Prospekt-PDF-Pipeline mit Haiku *(→ Codex pro Kette)*
- [ ] Matching + Confidence + Review-UI
- [ ] Cron Mo/Do + advisory lock
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
