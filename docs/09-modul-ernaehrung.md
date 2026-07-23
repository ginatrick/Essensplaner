# 09 — Modul: Ernährung

## Zielgruppen-Profile

**Kind 12 J., Fußball 3–4×/Woche**
- Energie ~2400–2800 kcal/Tag (Trainingstage oberes Ende)
- Protein ~1,2–1,5 g/kg KG — über den Tag verteilt, nicht nur abends
- KH als Hauptenergiequelle: vor Training komplex, nach Training schnell + Protein
- Eisen ~12 mg/Tag (Wachstum + Sport) — Fleisch, Hülsenfrüchte **+ Vitamin C**
- Calcium ~1200 mg/Tag (Knochenwachstum) — Milchprodukte, Grünkohl, Mineralwasser

**Kind 8 J.**
- Energie ~1700–1900 kcal/Tag
- Fokus Akzeptanz: bekannte Formen, Komponenten sichtbar getrennt

## Wochen-Ampel — bewertet den **Plan**, nicht die Portion

Bewertet werden **Nährstoffe**, nicht Gerichtekategorien. Gezählt wird, an wie
vielen Tagen eine Portion den Richtwert erreicht — errechnet aus den
Zutatenmengen (`recipe_ingredients.amount` → Gramm → Nährwert je 100 g,
geteilt durch `recipes.servings_base`).

| Kriterium | Richtwert je Portion | Grün | Gelb | Rot |
|---|---|---|---|---|
| Protein | ≥ 20 g | ≥ 5 Tage | 3–4 | < 3 |
| Ballaststoffe | ≥ 7 g | ≥ 5 Tage | 3–4 | < 3 |
| Eisen | ≥ 2,5 mg | ≥ 4 Tage | 2–3 | < 2 |
| Calcium | ≥ 150 mg | ≥ 4 Tage | 2–3 | < 2 |
| Rotes Fleisch | — | ≤ 2 | 3 | > 3 |
| Frittiert / Fertigprodukt | — | ≤ 1 | 2 | > 2 |

Die letzten beiden bleiben bewusst **tag-basiert**: das ist Lebensmittelqualität
und lässt sich aus Nährwerten nicht ableiten. Die früheren Kategorie-Kriterien
(Gemüse-/Obstgerichte, Vollkorn, Hülsenfrüchte, Fisch) sind entfallen — sie
maßen, *woraus* ein Gericht besteht, statt *was es liefert*.

Die Richtwerte gelten je Portion einer Hauptmahlzeit und sind Plan-Ziele, **keine
Bedarfsangaben für eine bestimmte Person** — siehe `docs/13-recht-risiken.md`,
keine Personenbilanzen, insbesondere nicht für die Kinder.

Gesamtampel = schlechtestes Kriterium, **immer mit konkretem Tauschvorschlag**:
> *"Rot: nur an 2 Tag(en) erreicht eine Portion 20 g Protein (Ziel ≥ 5 Tage). Ergänze an einem dieser Tage eine reichere Beilage: Mi, Do, Fr."*

### Grenze: stückweise Mengen
Nährwerte hängen an 100 g. Zutaten mit `stk`-Menge ("2 Eier") brauchen ein
Gewicht — dafür gibt es `ingredients.piece_weight_g` (geschätzte mittlere
Stückgewichte, Migration `20260723250000`). Fehlt der Wert, steuert die Zeile
**0** bei: die Ampel unterschätzt dann lieber, statt eine Zahl zu erfinden.

## Trainingstag-Logik
Trainingstage aus `household_members.training_days`.
- **Vor Training (Mittag):** KH-betont, fettarm, gut verdaulich
- **Nach Training (Abend):** Protein + KH kombiniert
- **Spieltag:** kein `is_experimental` Rezept

## Umsetzung
Regeln deklarativ in `web/lib/plan/nutrition_rules.ts`, ausgewertet in
`nutritionEvaluator.ts` (TS-Konstante statt `.json`, Begründung im Dateikopf).
**Kein LLM für die Bewertung** — deterministisch, erklärbar, kostenlos.
LLM nur für die *Formulierung* des Verbesserungsvorschlags.

## Disclaimer
Planungshilfe, keine medizinische oder diätetische Beratung.
Bei besonderen Bedarfen: Kinderarzt / Ernährungsberatung.

## Definition of Done
- [ ] Ampel live während der Planbearbeitung
- [ ] Jede rote Bewertung liefert einen umsetzbaren Tauschvorschlag
- [ ] Nährwerte für Top-200-Zutaten gepflegt (BLS-/USDA-Basis)
