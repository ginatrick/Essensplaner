# Aufgabe: Erweiterung `ingredients` um ~800 weitere Zutaten

Folgeauftrag zu `codex/001-seed-ingredients.md` (die ersten 200 Zutaten,
`supabase/seed_ingredients.sql`, bereits ausgerollt). Gleiche Konvention,
gleicher Kontrakt — nur diesmal ~800 zusätzliche Zutaten, damit die
Zutaten-Suche im Rezept-Formular (`web/components/rezept-form.tsx`) mehr
Treffer liefert und Nutzer seltener manuell neue Zutaten anlegen müssen.

## Kontrakt

**Input:** keine (statische Referenzdaten, von dir recherchiert/zusammengestellt).

**Output:** eine neue Datei `supabase/seed_ingredients_2.sql` (NICHT die
bestehende `supabase/seed_ingredients.sql` überschreiben oder anhängen —
eigene Datei, damit beide unabhängig voneinander review- und ausrollbar
bleiben) mit `insert`-Statements für genau die Spalten der Tabelle
`ingredients` (siehe Migration `20260722120000_stammdaten_und_rezepte.sql`):

```
name · slug · base_unit · department_id · density_g_ml ·
kcal_100 · protein_100 · carbs_100 · fat_100 · fiber_100 ·
iron_mg_100 · calcium_mg_100 · season_months · tags
```

## Vorgaben (identisch zu codex/001, hier nochmal vollständig)

1. **~800 Zutaten**, alltagstauglich für eine deutsche Familie. Diesmal auch
   etwas Breiteres/Spezielleres als die ersten 200 abdecken: mehr
   Gewürze/Kräuter, mehr internationale Küche (asiatisch, mediterran,
   orientalisch — was in einem gut sortierten deutschen Supermarkt/Asia-Laden
   zu finden ist), mehr Fertigprodukt-/Konserven-Varianten, mehr
   Getränke-Varianten, mehr Käse-/Wurstsorten. Weiterhin keine
   Fantasie-/Nischenprodukte, die realistisch niemand einkauft.
2. **Keine Duplikate zu den bestehenden 200 Zutaten.** Vollständige Liste der
   bereits vergebenen Slugs (nicht nochmal verwenden):
   ```
   agar-agar, ananas, apfel, apfelessig, apfelmus, apfelsaft, aprikosen, aubergine, avocado, backpulver, baguette-tiefgekuehlt, balsamicoessig, banane, basilikum-frisch, basilikum-getrocknet, basmatireis, beerenmischung-tiefgekuehlt, birne, blumenkohl, bohnen-gruen, bohnenkraut, bratwurst, brokkoli, brot-mischbrot, bruehe-instant, bulgur, butter, cashewkerne, cayennepfeffer, champignons, chiasamen, chiliflocken, couscous, creme-fraiche, currypulver, datteln, dill-frisch, dinkelmehl, ei, eisbergsalat, emmentaler, erbsen, erbsen-dose, erbsen-tiefgekuehlt, erdbeeren, erdnussbutter, feldsalat, feta, fischstaebchen, frischkaese, fruehlingszwiebel, garnelen, gelatine, gemuese-mix-tiefgekuehlt, gemuese-ravioli-dose, gemuesebruehe, gnocchi, gouda, griechischer-joghurt, gurke, haehnchenbrust, haehnchenschenkel, haferdrink, haferdrink-ungesuesst, haferflocken, haselnuesse, hefe-frisch, heidelbeeren, himbeeren, honig, ingwer, kaffee-gemahlen, kakao-getraenkepulver, kakaopulver, kardamom, karotte, kartoffel, kartoffelstaerke, kichererbsen-dose, kidneybohnen-dose, kirschen, kiwi, knoblauch, knoblauchpulver, kokosmilch, koriander-frisch, kreuzkuemmel, kuerbis, kuerbiskerne, kurkuma, lachs, lasagne-tiefgekuehlt, lauch, leinsamen, limette, linsen-dose, lorbeerblatt, mais, mais-dose, maisstaerke, majoran-getrocknet, mandarine, mandelmilch, mandeln, mango, marmelade, milch-15, milch-35, mineralwasser, mischgemuese-dose, mozzarella, muskatnuss, naturjoghurt-15, naturjoghurt-35, nektarine, nudeln-hartweizen, olivenoel, orange, orangensaft, oregano-getrocknet, paniermehl, paprika-rot, paprikapulver-edelsuess, parmesan, passierte-tomaten, petersilie-frisch, pfeffer-schwarz, pfirsich, pflaumen, piment, pizza-margherita-tiefgekuehlt, pizzagewuerz, pommes-frites-tiefgekuehlt, puderzucker, putenbrust, quark-20, quark-mager, quinoa, radieschen, rapsoel, ravioli-dose, rettich, rindergulasch, rinderhack, rindersteak, roggenmehl, rosenkohl, rosinen, rosmarin-frisch, rosmarin-getrocknet, rote-beete
   ```
   (Liste ist gekürzt dargestellt — die vollständigen 200 Slugs stehen in
   `supabase/seed_ingredients.sql`, dort **vor dem Schreiben unbedingt selbst
   nachschauen** und gegen die eigene Liste abgleichen, nicht nur gegen den
   Auszug oben.)
3. **Nährwertquelle:** Bundeslebensmittelschlüssel (BLS) oder USDA FoodData
   Central, pro Zutat als Tag vermerken, z. B. `tags = array['quelle:bls']`.
   Werte pro 100 g/ml. Fehlt ein Wert seriös, `null` lassen — nicht schätzen.
4. **`slug`:** lowercase, deutsche Umlaute transliteriert (ä→ae, ö→oe, ü→ue,
   ß→ss), Leerzeichen → `-`, muss unique sein (Tabellen-Constraint, auch
   gegen die bestehenden 200 aus Punkt 2).
5. **`base_unit`:** nur `g`, `ml` oder `stk` (Tabellen-CHECK). Flüssigkeiten
   `ml`, Stückgut (Ei, Zwiebel, Zitrone) `stk` mit plausiblem
   `density_g_ml`/Referenzgewicht falls sinnvoll, sonst `null`.
6. **`department_id`:** nicht die ID raten — per Subquery auf den Namen
   mappen: `(select id from departments where name = 'Obst & Gemüse')`.
   Exakte Abteilungsnamen (aus Migration 001):
   `Obst & Gemüse`, `Backwaren`, `Fleisch/Wurst`, `Käse/Theke`, `Kühlregal`,
   `Tiefkühl`, `Trockensortiment`, `Konserven`, `Getränke`, `Drogerie`.
7. **`season_months`:** nur bei Obst/Gemüse mit echter Saison befüllen
   (`int[]`, Monate 1–12), sonst `null`.
8. **Idempotent:** `insert ... on conflict (slug) do nothing`, damit das
   Skript gefahrlos mehrfach laufen kann.
9. Keine Migration, kein Schema ändern — reine Datendatei. Kein Rollout durch dich.

## Definition of Done

- [ ] `supabase/seed_ingredients_2.sql` mit ~800 Zeilen, lädt ohne Fehler
      gegen Migration 001 (und nach `supabase/seed_ingredients.sql`)
- [ ] Keine Slug-Duplikate — weder untereinander noch mit den bestehenden 200
      aus `supabase/seed_ingredients.sql`
- [ ] Alle `department_id`-Werte lösen per Namens-Subquery auf (kein
      Abteilungsname-Tippfehler)
- [ ] Jede Zutat hat `tags` mit Quellenangabe
