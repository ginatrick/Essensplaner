# 07 — Modul: Einkaufsplan & Optimizer

## Ablauf
1. **Aggregation**: alle `recipe_ingredients` der Woche × Portionsfaktor summieren
2. **Pantry-Abzug**: vorhandene Mengen abziehen
3. **Packungsrundung**: 350 g Hack benötigt → 1× 500 g, Rest → Pantry-Prognose
4. **Preiszuordnung**: Angebote im Radius + REWE-Referenz je Zutat
5. **Optimierung** (unten)
6. **Gruppierung**: pro Markt → nach `departments.sort_order`

## Optimizer — Greedy + Constraints, kein ILP nötig
```
Kosten(Variante) = Σ Warenkosten
                 + Σ Fahrtkosten     # km × Satz, Default 0,30 €/km
                 + Σ Zeitkosten      # min × €/h, Default 0 (konfigurierbar)
```
Route = Rundreise Haushalt → Märkte → Haushalt.
≤ 4 Märkte: Brute Force. Darüber: 2-opt.

**Immer berechnete Varianten**
- `A` Multi-Markt (max. N Märkte, Default N=3)
- `B` Bester Einzelmarkt
- `C` REWE Abholservice komplett → `08-modul-rewe-vergleich.md`
- `D` Kompromiss, N=2

Ausgabe: Warenkosten · Fahrtkosten · Zeit · Gesamt · Δ zur billigsten.

## Abteilungs-Mapping
`ingredients.department_id` ist Default.
Chain-Overrides in `stores.department_layout` (jsonb) —
z. B. Käse bei Discountern im Kühlregal statt an der Theke.

## Einkaufsliste-UI
- Karte pro Markt, kollabierbar
- Innerhalb: Abteilungs-Überschriften in Laufreihenfolge
- Checkbox pro Position + Fortschrittsbalken
- Long-Press → "nicht bekommen" → Ersatzvorschlag + Merkposten
- Offline-fähig (PWA + IndexedDB)
- Jede Position mit `reason`: *"bei Netto 1,29 € statt 1,99 € REWE"*

## Definition of Done
- [ ] 4 Varianten in < 2 s berechnet
- [ ] Begründung pro Position sichtbar
- [ ] Abhaken funktioniert offline
