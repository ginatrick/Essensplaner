# Aufgabe: Unit-Konversionstabelle + Tests

Roadmap Phase 0: "Unit-Konversionstabelle + Tests". Baustein für den
Zutaten-Parser aus Phase 1 (`docs/05-modul-rezepte.md`), aber eigenständig
und ohne Abhängigkeit auf Alias-Lookup/LLM — reine, deterministische
Konversionslogik.

## Scope

**Nur** die Umrechnung einer freien Mengenangabe (Zahl + Einheiten-Text) auf
die Basiseinheit. **Nicht** Teil dieser Aufgabe: Regex-Split aus dem
Rezepttext, Alias-Lookup, Haiku-Fallback, Schreiben nach `recipe_ingredients`
— das kommt in Phase 1.

## Kontrakt

**Input:** `{ amount: number, unit: string }` — `unit` als roher Text aus dem
Rezept (z. B. `"EL"`, `"Esslöffel"`, `"TL"`, `"Prise"`, `"g"`, `"kg"`, `"ml"`,
`"l"`, `"cl"`, `"Bund"`, `"Zehe"`, `"Stück"`, `"Stk"`, `"Dose"`, `"Packung"`).

**Output:** `{ amount: number, unit: 'g' | 'ml' | 'stk' }`

**Datei:** `web/lib/units/convert.ts`, exportiert eine Funktion
`toBaseUnit(input: { amount: number; unit: string }): { amount: number; unit: 'g' | 'ml' | 'stk' }`.

## Regeln

1. Umrechnungstabelle exakt nach `docs/05-modul-rezepte.md`:
   `EL = 15 ml · TL = 5 ml · Prise = 0.5 g`. Gewichts-/Volumeneinheiten
   (`g`, `kg`, `ml`, `l`, `cl`) linear auf `g`/`ml` normalisieren.
2. **Stückgut-Einheiten** (`Bund`, `Zehe`, `Stück`/`Stk`, `Dose`, `Packung`,
   und offensichtliche Synonyme) werden **nicht** in Gramm umgerechnet,
   sondern durchgereicht als `unit: 'stk'` mit unverändertem `amount`.
   Ein Referenzgewicht pro Zutat existiert in diesem Schritt noch nicht
   (`ingredients` hat kein Referenzgewicht-Feld) — das ist bewusst außerhalb
   des Scopes, nicht nachbauen.
3. Einheiten-Erkennung **case-insensitive** und mit gängigen Schreibweisen/
   Abkürzungen als Aliase in derselben Tabelle (z. B. `"EL"`/`"Esslöffel"`/
   `"esslöffel"` → dieselbe Regel). Liste der abgedeckten Aliase in der Datei
   dokumentieren (Kommentar reicht, kein separates Doc).
4. Unbekannte Einheit → Funktion wirft einen Fehler (kein stiller Fallback,
   kein Raten). Aufrufer entscheidet in Phase 1, was damit passiert.
5. Keine neue Abhängigkeit für die Umrechnung selbst — reine Funktion,
   kein externes Package nötig.
6. **Tests:** Node's eingebauter Test-Runner (`node:test` + `node:assert/strict`),
   **keine** neue Test-Framework-Abhängigkeit (kein vitest/jest). Node 24 in
   diesem Projekt unterstützt `.ts`-Dateien nativ — `node --test` muss ohne
   zusätzliches Build/Transpile-Tooling laufen. Datei: `web/lib/units/convert.test.ts`.
   `package.json`-Script `"test": "node --test lib/units/*.test.ts"` ergänzen
   (bestehende Scripts nicht anfassen).
7. Testfälle mindestens: alle Tabellenwerte aus Regel 1, mind. 2 Aliase pro
   Stückgut-Einheit, ein Groß-/Kleinschreibungs-Fall, ein Fehlerfall
   (unbekannte Einheit wirft).

## Definition of Done

- [ ] `web/lib/units/convert.ts` mit `toBaseUnit()`, keine neue Dependency
- [ ] `web/lib/units/convert.test.ts`, läuft über `npm test` in `web/`
- [ ] `npm test` grün, `npx tsc --noEmit` weiterhin fehlerfrei
