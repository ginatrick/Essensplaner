# MealPlanner — Projekt-Kontext

> **Regel für alle Agents:** Lade nur die MD-Dateien, die du für die aktuelle Aufgabe brauchst.
> Diese Datei ist der Index. Sie bleibt immer kurz.

## Was ist das Projekt?

Wochenspeiseplan-Tool für eine Familie (2 Erwachsene, Kinder 12 & 8 Jahre,
12-jähriger ist Fußballer). Standort: Steinbach-Hallenberg / Schmalkalden, Thüringen.

**Kernkette:**
`Speiseplan → Rezepte → Zutatenliste → Angebotsabgleich (lokale Märkte) → Einkaufsplan pro Markt (nach Abteilung sortiert) → Vergleich vs. REWE Abholservice → Ersparnis-Report`
**Parallel:** Gewohnheits-DB lernt mit → schlägt neue, variantenreiche & ernährungsphysiologisch sinnvolle Wochenpläne vor.

## Dokumenten-Index

| Datei | Inhalt | Wann laden |
|---|---|---|
| `docs/01-scope.md` | Ziele, Nicht-Ziele, Personas | Projektstart, Priorisierung |
| `docs/02-architektur.md` | Systemübersicht, Deployment | Vor jedem Modul-Bau |
| `docs/03-datenmodell.md` | Supabase-Schema, Tabellen | DB-Arbeit, Migrationen |
| `docs/04-modul-speiseplan.md` | Planer-UI, Slots, Templates | Frontend Speiseplan |
| `docs/05-modul-rezepte.md` | Rezeptquellen, Normalisierung, Zutaten-Parser | Rezept-Pipeline |
| `docs/06-modul-angebote.md` | Prospekt-/Angebots-Ingestion, Marktradius | Scraper/Crawler |
| `docs/07-modul-einkaufsplan.md` | Optimizer, Abteilungs-Mapping, Routenlogik | Einkaufslogik |
| `docs/08-modul-rewe-vergleich.md` | REWE Abholservice, TCO-Rechnung | Preisvergleich |
| `docs/09-modul-ernaehrung.md` | Nährwertregeln, Kinder/Sportler-Profile | Ernährungslogik |
| `docs/10-modul-lernen.md` | Gewohnheits-Tracking, Vorschlags-Engine | Empfehlungssystem |
| `docs/11-modellwahl.md` | Welches LLM für welche Aufgabe + Codex-Delegation | Task-Planung |
| `docs/12-roadmap.md` | Phasen 0–7, Definition of Done | Sprint-Planung |
| `docs/13-recht-risiken.md` | Scraping-Recht, ToS, DSGVO | Vor Ingestion-Bau |

## Tech-Stack (fix)

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- **DB/Auth:** Supabase (Postgres + RLS + Edge Functions), Magic Link
- **Ingestion:** Python 3.12 / FastAPI, aktuell lokal (Entwickler-PC) via Cloudflare Tunnel, vorbereitet für Homeserver-Umzug
- **Hosting Frontend:** Vercel
- **Job-Scheduler:** Supabase pg_cron + FastAPI APScheduler
- **LLM:** Anthropic API (Claude) für Parsing/Vorschläge, siehe `docs/11-modellwahl.md`

## Konventionen

- Sprache: Deutsch (UI, Kommentare, Commits)
- Alle Preise in Cent (integer), nie float
- Alle Mengen normalisiert auf Basiseinheit (g, ml, Stück)
- Keine Geheimnisse in `NEXT_PUBLIC_*`
- Jede neue Tabelle bekommt sofort RLS-Policy

## Subagenten

`db-architekt` · `speiseplan-frontend` · `rezept-pipeline` · `ingest-entwickler` ·
`optimizer-entwickler` · `ernaehrungs-logik` · `vorschlags-engine` · `scope-diff-reviewer`

Zuordnung und Regeln: `.claude/agents/README.md`. Jeder Agent lädt seine Docs selbst —
im Auftrag keine Doc-Inhalte mitschicken, nur die Aufgabe.

## Fortschritt

Siehe `docs/12-roadmap.md` — dort Checkboxen pflegen, nicht hier.
