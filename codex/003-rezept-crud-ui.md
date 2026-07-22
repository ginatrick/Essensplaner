# Aufgabe: Rezept-CRUD-UI (+ minimale Magic-Link-Auth)

Roadmap Phase 1: "Rezept-CRUD-UI". Deckt Quelle 1 aus `docs/05-modul-rezepte.md`
ab (manuelles Formular). **Nicht** Teil dieser Aufgabe: URL-Import, Foto/Scan,
Haiku-Fallback, Bild-Upload (`image_path` bleibt unbefüllt/ungenutzt).

## Voraussetzung: Magic-Link-Login fehlt noch

Alle Tabellen haben RLS `auth.uid() = user_id` (siehe
`supabase/migrations/20260722120000_stammdaten_und_rezepte.sql`), aber es
gibt noch **keine Login-Seite** in `web/`. Ohne eingeloggten User ist die
CRUD-UI nicht nutzbar/testbar — deshalb minimal mit umsetzen:

1. `web/app/login/page.tsx`: E-Mail-Eingabe + Button "Link senden", ruft
   `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: \`${origin}/auth/confirm\` } })`
   über den Browser-Client (`web/lib/supabase/client.ts`, existiert bereits).
2. `web/app/auth/confirm/route.ts`: liest `token_hash` und `type` aus der
   Query, ruft `supabase.auth.verifyOtp({ token_hash, type })` über den
   Server-Client (`web/lib/supabase/server.ts`, existiert bereits), leitet
   bei Erfolg auf `/rezepte` weiter, sonst zurück auf `/login?error=1`.
   **Bitte vor Implementierung kurz `https://supabase.com/docs/guides/auth/server-side/nextjs.md`
   und `https://supabase.com/docs/guides/auth/auth-email-passwordless.md` prüfen** —
   Supabase-Auth-APIs ändern sich, nicht aus dem Training raten.
3. Server-seitiger Zugriffsschutz für `/rezepte/*`: Session serverseitig über
   `supabase.auth.getClaims()` prüfen (NICHT `getSession()` für Autorisierung —
   aktuelle Supabase-Empfehlung), ohne gültige Session redirect auf `/login`.
4. Ein simpler Logout-Button (z. B. im Layout-Header), ruft `signOut()`.

Kein Passwort-Flow, keine Registrierung, keine Rollen — nur dieser eine
Magic-Link-Pfad.

## CRUD

Routen (deutsch, Projektkonvention):
- `web/app/rezepte/page.tsx` — Liste der eigenen Rezepte (Titel, Aufwand
  `prep_min+cook_min`, `kid_friendly`-Badge), Button "+ Neues Rezept"
- `web/app/rezepte/neu/page.tsx` — Anlegen
- `web/app/rezepte/[id]/page.tsx` — Detailansicht (read-only), Links zu
  Bearbeiten/Löschen
- `web/app/rezepte/[id]/bearbeiten/page.tsx` — Bearbeiten

**Formular als wiederverwendbare Komponente bauen** (z. B.
`web/components/rezept-form.tsx`), die sowohl von "neu" als auch von
"bearbeiten" genutzt wird, und **Props für optionale Vorbefüllung**
akzeptiert (`defaultValues?: Partial<...>`) — eine spätere Aufgabe
(URL-Import) füllt dieses Formular mit einem vorab geparsten Entwurf vor,
ohne es zu duplizieren.

Felder aus `recipes` (siehe Migration 001): `title` (Pflicht), `source_url`
(optional), `servings_base` (Default 4), `prep_min`, `cook_min`,
`difficulty` (Select: `einfach`/`mittel`/`schwer`, nullable — exakt diese
drei Werte, CHECK-Constraint in der DB), `tags` (Komma-getrenntes Textfeld
→ `text[]`), `kid_friendly` (Checkbox), `is_experimental` (Checkbox).

**`recipe_steps`**: dynamische Liste von Textschritten (hinzufügen,
entfernen, Reihenfolge ändern reicht als Rauf/Runter-Buttons oder Drag ist
nicht nötig). Beim Speichern `step_no` fortlaufend neu vergeben.

**`recipe_ingredients`** — wichtiger Punkt, bitte genau lesen:
`recipe_ingredients.ingredient_id` ist `NOT NULL`, und `ingredients` ist
eine **globale Tabelle, die nur `service_role` beschreiben darf** (RLS,
Migration 001). Die UI kann und darf **keine neuen Zutaten anlegen**.
Deshalb pro Zutaten-Zeile:
- `amount` (Zahl-Input)
- `unit` (Text-Input, freie Eingabe wie im Originalrezept, z. B. `"EL"`)
- Zutat als Such-/Combobox-Feld gegen die vorhandene `ingredients`-Tabelle
  (einfache `.ilike('name', '%term%')`-Suche über den Supabase-Client
  reicht, **kein** Bedarf an der komplexeren Fuzzy-RPC aus
  `web/lib/recipes/lookupAlias.ts` — die ist für den automatisierten Import
  gedacht, hier sucht ein Mensch selbst). Auswahl liefert `ingredient_id`.
- Wird nichts Passendes gefunden: Zeile klar als "keine Zutat gefunden"
  markieren, **darf nicht gespeichert werden** — das Rezept kann trotzdem
  ohne diese eine Zeile gespeichert werden (kein Blocker fürs ganze Formular).
- Beim Speichern `amount`+`unit` über `toBaseUnit()` aus
  `web/lib/units/convert.ts` normalisieren (existiert bereits, nicht
  duplizieren). Wirft `toBaseUnit` einen Fehler (unbekannte Einheit), das
  dem Nutzer inline anzeigen statt die Seite crashen zu lassen.

Löschen (Rezept komplett) mit Bestätigungsdialog (`AlertDialog` aus
shadcn oder ein einfaches `confirm()`-Muster reicht).

## Technische Vorgaben

- Next.js 15 App Router, Server Components als Default, `"use client"` nur
  für interaktive Teile (Formular, Login).
- shadcn/ui ist bereits initialisiert (`web/components.json`), bisher nur
  `Button` installiert. Weitere Komponenten per
  `npx shadcn@latest add <name>` ergänzen (`input`, `textarea`, `select`,
  `checkbox`, `label`, `card`, ggf. `alert-dialog`).
- Datenzugriff über die vorhandenen Clients (`web/lib/supabase/client.ts`,
  `server.ts`) — nicht neu bauen. RLS ist bereits korrekt gesetzt, keine
  zusätzlichen `user_id`-Filter in Queries nötig (RLS übernimmt das), aber
  beim Insert `user_id: (await supabase.auth.getUser()).data.user!.id` bzw.
  äquivalent setzen, da die Spalte `not null` ist.
- Kein Storage-Upload, kein `image_path`.
- `docs/05-modul-rezepte.md` und `docs/03-datenmodell.md` bei Bedarf lesen.

## Definition of Done

- [ ] Magic-Link-Login funktioniert Ende-zu-Ende (E-Mail eingeben, Link
      klicken, landet eingeloggt auf `/rezepte`)
- [ ] `/rezepte/*` ohne Session redirected auf `/login`
- [ ] Rezept anlegen inkl. mind. 2 Schritten und mind. 1 Zutat, erscheint
      in der Liste
- [ ] Rezept bearbeiten, Rezept löschen (mit Bestätigung)
- [ ] Nicht gefundene Zutat blockiert nur die eine Zeile, nicht das
      Speichern des restlichen Rezepts
- [ ] `npx tsc --noEmit`, `npm test` (bestehende Tests dürfen nicht
      brechen) und `npm run build` in `web/` laufen fehlerfrei
