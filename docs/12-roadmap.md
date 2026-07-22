# 12 — Roadmap

Checkboxen hier pflegen. `CLAUDE.md` bleibt unverändert.

## Phase 0 — Fundament
- [x] Next.js 15 + TS + Tailwind + shadcn Scaffold
- [ ] Supabase-Projekt EU-Central, Magic Link Auth
- [x] Schema-Migration 001 (Stammdaten + Rezepte) inkl. RLS
- [x] Seed: `departments`, Top-200 `ingredients` mit Nährwerten *(→ Codex)*
- [ ] Unit-Konversionstabelle + Tests *(→ Codex)*
- [ ] Vercel-Deployment + Env-Handling

## Phase 1 — Rezepte
- [ ] Rezept-CRUD-UI *(→ Codex)*
- [ ] Zutaten-Parser Regex + Alias-Lookup
- [ ] Haiku-Fallback + Alias-Rückschreibung
- [ ] URL-Import mit JSON-LD *(→ Codex)*
- [ ] Testset 20 Rezeptseiten, Trefferquote messen

## Phase 2 — Speiseplan
- [ ] Wochenraster-UI mit Drag & Drop
- [ ] `meal_plans` / `meal_plan_entries` + RLS
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
