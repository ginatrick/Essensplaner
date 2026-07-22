# 02 — Architektur

## Drei Deployments

```
┌─ web (Vercel) ──────────────┐   Next.js 15 App Router, TS, Tailwind, shadcn
│  app.mealplan.de            │   Planer · Rezepte · Einkaufsliste · Reports
└──────────┬──────────────────┘
           │ supabase-js (RLS, anon key)
┌──────────▼──────────────────┐
│  Supabase (EU, eu-north-1)  │   Postgres · Auth · Storage · Edge Functions
│  RLS auf allen Tabellen     │   Edge Fn: recipe-import · plan-suggest
│  pg_cron Jobs               │            price-compare · nightly-aggregate
└──────────┬──────────────────┘
           │ HTTPS + Shared Secret (nur Server→Server), via Cloudflare Tunnel
┌──────────▼──────────────────┐
│  ingest (lokal)             │   Python 3.12 / FastAPI
│  aktuell: Entwickler-PC     │   Angebots-Crawler · PDF-Parser
│  vorbereitet für Homeserver │   REWE-Preisabfrage · Rezept-Extractor
└─────────────────────────────┘
```

## Warum getrennt?
- Crawler brauchen persistente Erreichbarkeit, Playwright, lange Laufzeiten → nicht Vercel
- Prospekt-PDFs brauchen Minuten → Vercel-Timeout
- Supabase bleibt einzige Wahrheitsquelle

## Ingest-Hosting
Läuft aktuell auf dem Entwickler-PC, keine öffentliche IP. Erreichbarkeit für
Supabase über einen **Cloudflare Tunnel** (stabile Tunnel-URL statt Portforwarding/DynDNS,
kein offener Port am Router). Bewusst so gebaut, dass ein Umzug auf einen
immer laufenden Homeserver später nur der Tunnel-Ziel-Host wechselt — kein Code,
keine Schema-Änderung. Solange der PC aus ist, laufen die Mo/Do-Cronjobs nicht;
das ist für die aktuelle Phase akzeptiert, nicht automatisch nachgeholt.

## Datenfluss "Woche planen"
1. User füllt Slots → `meal_plans`, `meal_plan_entries`
2. Aggregation Rezept-Zutaten → `shopping_items` (normalisiert, Pantry-bereinigt)
3. Edge Fn `price-compare` ruft Ingest-API → Angebotstreffer je Markt + REWE-Preise
4. Optimizer erzeugt Varianten A/B/C/D → `shopping_lists`
5. UI: Vergleichstabelle + Empfehlung + Einkaufsliste pro Markt

## Sicherheitsprinzipien
1. Ingest-API nur mit `X-Ingest-Secret`, kein öffentlicher Endpoint
2. Service-Role-Key nur im Ingest-Prozess/Edge, nie im Client
3. RLS: Nutzertabellen `auth.uid() = user_id`
4. Globale Tabellen (`offers`, `stores`, `ingredients`): SELECT für `authenticated`, Schreiben nur `service_role`
5. `pg_advisory_lock` pro Kette gegen Doppel-Crawls
