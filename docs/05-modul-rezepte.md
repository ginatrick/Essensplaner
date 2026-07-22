# 05 — Modul: Rezepte

## Quellen
1. Manuell (Formular)
2. **URL-Import**: Ingest holt Seite → JSON-LD `schema.org/Recipe`
3. **LLM-Fallback** wenn kein JSON-LD: HTML→Text→Claude Haiku strukturiert
4. **Foto/Scan**: Rezeptbild → Claude Vision → strukturiertes Rezept

> Nur private Sammlung, keine öffentliche Wiedergabe. Siehe `13-recht-risiken.md`.

## Zutaten-Parser (Kernstück)
Input: `"2 EL Olivenöl"` · `"500g Rinderhack"` · `"1 Bund glatte Petersilie"`

Pipeline:
1. Regex-Split → `amount | unit | rest`
2. Alias-Lookup gegen `ingredient_aliases` (exakt, dann Trigram-Fuzzy)
3. Miss → Claude Haiku klassifiziert → **schreibt Alias zurück**
4. Unit-Konversion auf Basiseinheit
   `EL=15ml · TL=5ml · Prise=0.5g · Bund/Zehe/Stück → stk mit Referenzgewicht`
5. → `recipe_ingredients`

**Wichtig:** Jeder LLM-Treffer erzeugt einen Alias → der Parser wird über die Zeit
deterministisch, schnell und kostenlos.

## Skalierung
`amount_final = amount_base × (servings_wanted / servings_base)`
Packungsrundung erst im Einkaufsplan, nie im Rezept.

## Definition of Done
- [ ] URL-Import ≥ 85 % korrekte Zutatenerkennung auf 20 Testseiten
- [ ] Alias-Tabelle wächst automatisch, Trefferquote messbar
- [ ] Duplikaterkennung per Titel-Fuzzy + Zutaten-Overlap
