# 10 — Modul: Gewohnheiten & Vorschlags-Engine

## Signale (`habit_events`)
| Event | Gewicht | Bedeutung |
|---|---|---|
| `recipe_kept` | +1.0 | Vorschlag unverändert übernommen |
| `suggestion_accepted` | +0.8 | Ganze Woche akzeptiert |
| `recipe_manual_add` | +0.5 | Aktive eigene Wahl |
| `item_unchecked` | −0.2 | Zutat nie gekauft |
| `recipe_swapped` | −0.6 | Ersetzt (Ersatzrezept = eigenes Positivsignal) |
| `recipe_rejected` | −1.0 | Explizit abgelehnt |

## Aggregation (nightly cron)
```
score = tanh( Σ(gewicht × decay(alter)) / sqrt(n_seen) )
decay(t) = 0.5 ^ (t_tage / 90)      # Halbwertszeit 90 Tage
```
Auf Zutaten- **und** Rezeptebene. Zutaten-Score vererbt sich anteilig auf neue Rezepte
(→ funktioniert auch für nie geplante Gerichte).

## Vorschlags-Algorithmus — hybrid, **nicht rein LLM**

**1. Kandidatenpool (SQL, deterministisch)**
- `last_planned > 14 Tage` oder nie geplant
- `taste_score > -0.3`
- Saisonalität: `ingredients.season_months` gegen aktuellen Monat

**2. Auswahl (Constraint-Solver, TypeScript)**
- Fülle 7 Tage unter Einhaltung der Ernährungs-Ampel (Ziel: grün)
- Varianz: max. 2 Gerichte gleicher Hauptzutat pro Woche
- Aufwand: Trainingstage → `prep+cook <= 40 min`
- **Exploration:** 1–2 Slots bewusst mit unbekanntem Rezept (ε = 0.2) → Varianz bleibt erhalten

**3. Begründung (Claude Haiku, nur Text)**
> *"Diese Woche mit mehr Hülsenfrüchten, weil letzte Woche wenig Eisen dabei war.
> Linsencurry ist neu, ähnelt aber deinem Favoriten Kichererbsen-Curry."*

> **Der LLM wählt nicht aus, er erklärt nur.** Das hält Vorschläge reproduzierbar,
> billig und debugbar.

## Cold Start
Erste 4 Wochen: kuratiertes Starter-Set (30 familientaugliche, ausgewogene Rezepte)
+ explizites Feedback nach jeder Woche.

## Definition of Done
- [ ] Score-Berechnung nachvollziehbar (Debug-View pro Rezept)
- [ ] Vorschlag in < 3 s
- [ ] Akzeptanzrate wird getrackt und angezeigt
