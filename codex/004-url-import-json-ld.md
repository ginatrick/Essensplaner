# Aufgabe: URL-Import mit JSON-LD

Roadmap Phase 1: "URL-Import mit JSON-LD". Deckt Quelle 2 aus
`docs/05-modul-rezepte.md` ab: Ingest holt Seite → JSON-LD
`schema.org/Recipe`. **Abweichung von `docs/02-architektur.md` bewusst
abgestimmt:** Der Python-Ingest-Service existiert noch nicht (Phase 4) —
der Fetch läuft für diese Aufgabe direkt serverseitig in Next.js
(kein Crawler/Playwright nötig, JSON-LD steht bei den allermeisten
Rezeptseiten im initialen HTML). Kann später bei Bedarf nach `ingest/`
verschoben werden, ist aber nicht Teil dieser Aufgabe.

**Baut auf `codex/003-rezept-crud-ui.md` auf — diese Aufgabe muss danach
laufen.** Verwendet `web/components/rezept-form.tsx` (wiederverwendbare
Formular-Komponente mit `defaultValues`-Prop, dort gebaut) sowie
`web/lib/recipes/parseLine.ts` und `web/lib/recipes/lookupAlias.ts`
(bereits vorhanden, nicht duplizieren).

## Ablauf

1. `web/app/rezepte/importieren/page.tsx`: Eingabefeld für eine Rezept-URL,
   Button "Importieren".
2. Server-seitig (Server Action, kein Client-Fetch — CORS/robots-freundlicher
   und die URL bleibt nicht im Browser-Netzwerk-Log sichtbar):
   a. Seite per `fetch()` holen, angemessenes Timeout (z. B.
      `AbortSignal.timeout(10000)`), aussagekräftiger User-Agent.
      Fehler (Netzwerk, 4xx/5xx) → klare Fehlermeldung an den Nutzer,
      kein Crash, kein leeres Formular ohne Erklärung.
   b. JSON-LD extrahieren: alle `<script type="application/ld+json">`-Blöcke
      der Seite parsen (reines Regex/String-Parsing reicht, **keine neue
      HTML-Parser-Abhängigkeit** wie cheerio/jsdom für diesen einen Zweck).
      JSON-LD kann als einzelnes Objekt, Array oder mit `@graph`-Wrapper
      vorliegen — den ersten Knoten suchen, dessen `@type` (String oder
      Array) `"Recipe"` enthält. Kein Treffer → klare Fehlermeldung
      ("Kein Rezept auf dieser Seite gefunden"), kein Crash.
   c. Schema.org-Felder auf unser Formular-Modell mappen:
      - `name` → `title`
      - `recipeIngredient` (string[]) → pro Zeile durch
        `parseIngredientLine()` + `lookupIngredientAlias()` schicken
        (**nicht** `resolveRecipeLine`, das normalisiert die Einheit schon
        zu früh — das Formular übernimmt die `toBaseUnit()`-Normalisierung
        selbst beim Speichern, identisch zur manuellen Eingabe aus
        Aufgabe 003). Ergebnis pro Zeile: `amount`, `unit` (Rohtext),
        `ingredient_id` (falls Alias-Treffer, sonst `null` → in der UI
        genauso als "keine Zutat gefunden" markiert wie bei manueller
        Eingabe, blockiert nur diese eine Zeile).
      - `recipeInstructions` → `recipe_steps`-Texte. Schema.org erlaubt
        hier: einzelner String, Array von Strings, oder Array von
        `HowToStep`/`HowToSection`-Objekten mit `.text` (bei
        `HowToSection` rekursiv über `itemListElement`). Einzelner String
        ohne Struktur: an Zeilenumbrüchen aufteilen als bester Kompromiss,
        keine Satzsegmentierung o. ä. bauen.
      - `prepTime`/`cookTime` (ISO-8601-Dauer wie `"PT15M"`, `"PT1H30M"`)
        → `prep_min`/`cook_min` als Minuten. Kleiner Parser reicht
        (Regex auf `PT(\d+H)?(\d+M)?`), keine Dependency dafür.
      - `recipeYield` → `servings_base`: kann Zahl, String ("4 Portionen"),
        Array oder `QuantitativeValue` sein — erste erkennbare Ganzzahl
        extrahieren, sonst `undefined` lassen (Nutzer füllt manuell aus,
        nicht raten).
      - `source_url` = die vom Nutzer eingegebene URL (nicht zwingend das
        `url`-Feld aus dem JSON-LD).
      - `difficulty`, `tags`, `kid_friendly`, `is_experimental`,
        `image_path`: kein Schema.org-Äquivalent nötig, leer lassen.
3. Ergebnis als vorausgefüllter Entwurf an `web/components/rezept-form.tsx`
   übergeben (`defaultValues`-Prop) — der Nutzer sieht das normale
   Bearbeiten-Formular, prüft/korrigiert und speichert explizit über den
   bestehenden Save-Pfad aus Aufgabe 003. **Kein automatisches Speichern.**

## Dateiaufteilung (für Tests wichtig)

- `web/lib/recipes/importJsonLd.ts`: reine Funktion(en) ohne Netzwerk-/
  DB-Zugriff, z. B. `extractRecipeFromHtml(html: string): RawRecipeDraft`
  (JSON-LD-Extraktion + Schema.org-Mapping, exkl. Alias-Lookup). Voll
  testbar mit fest hinterlegten HTML-Fixtures (2–3 Beispiele mit
  unterschiedlichen JSON-LD-Formen: einfaches Objekt, `@graph`-Wrapper,
  `HowToStep`-Array).
- Server Action (z. B. `web/app/rezepte/importieren/actions.ts`): dünner
  Wrapper — `fetch()`, ruft `extractRecipeFromHtml`, dann pro Zutatenzeile
  `parseIngredientLine`/`lookupIngredientAlias` (DB-Zugriff, braucht
  Supabase-Client aus `web/lib/supabase/server.ts`).

## Tests

`node:test` wie in den bestehenden Dateien unter `web/lib/recipes/`,
gleiches Muster. Mindestens: die drei genannten JSON-LD-Formen korrekt
gemappt, Dauer-Parsing (`PT15M`, `PT1H30M`, fehlend), `recipeYield` in
den genannten Varianten, kein Treffer → definierter Fehlerfall statt Crash.
package.json-Test-Glob erweitern (nicht ersetzen).

## Definition of Done

- [ ] `web/app/rezepte/importieren` funktioniert mit mind. 2 echten,
      unterschiedlich strukturierten Rezeptseiten (manuell mit zwei realen
      URLs geprüft, nicht nur Fixtures)
- [ ] Ergebnis landet vorausgefüllt im bestehenden `rezept-form.tsx`,
      kein separates/zweites Formular
- [ ] Fehlerfälle (kein JSON-LD, Netzwerkfehler) zeigen eine verständliche
      Meldung, kein Crash
- [ ] `npx tsc --noEmit`, `npm test` (inkl. neuer Tests, bestehende dürfen
      nicht brechen) und `npm run build` in `web/` laufen fehlerfrei
