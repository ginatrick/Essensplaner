# Aufgabe: Seed Top-200 `ingredients`

Roadmap Phase 0: "Seed: `departments`, Top-200 `ingredients` mit Nährwerten".
`departments` ist bereits in `supabase/migrations/20260722120000_stammdaten_und_rezepte.sql`
geseedet — hier geht es nur noch um `ingredients`.

## Kontrakt

**Input:** keine (statische Referenzdaten, von dir recherchiert/zusammengestellt).

**Output:** eine Datei `supabase/seed_ingredients.sql` mit `insert`-Statements für
genau die Spalten der Tabelle `ingredients` (siehe Migration 001):

```
name · slug · base_unit · department_id · density_g_ml ·
kcal_100 · protein_100 · carbs_100 · fat_100 · fiber_100 ·
iron_mg_100 · calcium_mg_100 · season_months · tags
```

## Vorgaben

1. **200 Zutaten**, alltagstauglich für eine deutsche Familie (Obst, Gemüse,
   Grundnahrungsmittel, Fleisch/Fisch, Milchprodukte, Trockenwaren, Gewürze).
   Keine Fantasie-/Nischenprodukte.
2. **Nährwertquelle:** Bundeslebensmittelschlüssel (BLS) oder USDA FoodData Central,
   pro Zutat als Tag vermerken, z. B. `tags = array['quelle:bls']`. Werte pro 100 g/ml.
   Fehlt ein Wert seriös, `null` lassen — nicht schätzen.
3. **`slug`:** lowercase, deutsche Umlaute transliteriert (ä→ae, ö→oe, ü→ue, ß→ss),
   Leerzeichen → `-`, muss unique sein (Tabellen-Constraint). Beispiel:
   `Rinderhack` → `rinderhack`, `Blumenkohl` → `blumenkohl`.
4. **`base_unit`:** nur `g`, `ml` oder `stk` (Tabellen-CHECK). Flüssigkeiten `ml`,
   Stückgut (Ei, Zwiebel, Zitrone) `stk` mit plausiblem `density_g_ml`/Referenzgewicht
   falls sinnvoll, sonst `null`.
5. **`department_id`:** nicht die ID raten — per Subquery auf den Namen mappen:
   ```sql
   (select id from departments where name = 'Obst & Gemüse')
   ```
   Abteilungsnamen exakt wie in Migration 001 verwenden (siehe dort die 10 Namen).
6. **`season_months`:** nur bei Obst/Gemüse mit echter Saison befüllen
   (`int[]`, Monate 1–12), sonst `null`.
7. **Idempotent:** `insert ... on conflict (slug) do nothing`, damit das Skript
   gefahrlos mehrfach laufen kann.
8. Keine Migration, kein Schema ändern — reine Datendatei. Kein Rollout durch dich.

## Definition of Done

- [ ] `supabase/seed_ingredients.sql` mit 200 Zeilen, lädt ohne Fehler gegen Migration 001
- [ ] Alle `department_id`-Werte lösen per Namens-Subquery auf (kein Abteilungsname-Tippfehler)
- [ ] Jede Zutat hat `tags` mit Quellenangabe
- [ ] Slugs sind eindeutig (keine Duplikate im Skript selbst)
