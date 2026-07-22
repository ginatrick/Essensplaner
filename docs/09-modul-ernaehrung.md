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
| Kriterium | Grün | Gelb | Rot |
|---|---|---|---|
| Gemüse-/Obstgerichte | ≥ 5 Tage | 3–4 | < 3 |
| Vollkorn / komplexe KH | ≥ 4 | 2–3 | < 2 |
| Hülsenfrüchte | ≥ 2 | 1 | 0 |
| Fisch | 1–2 | 0 | > 3 |
| Rotes Fleisch | ≤ 2 | 3 | > 3 |
| Frittiert / Fertigprodukt | ≤ 1 | 2 | > 2 |
| Eisenquellen | ≥ 4 | 2–3 | < 2 |
| Calciumquellen | ≥ 5 | 3–4 | < 3 |

Gesamtampel = schlechtestes Kriterium, **immer mit konkretem Tauschvorschlag**:
> *"Rot: nur 1 Hülsenfrucht-Gericht. Vorschlag: Donnerstag Nudeln Bolognese → Linsenbolognese, gleiche Zubereitungszeit."*

## Trainingstag-Logik
Trainingstage aus `household_members.training_days`.
- **Vor Training (Mittag):** KH-betont, fettarm, gut verdaulich
- **Nach Training (Abend):** Protein + KH kombiniert
- **Spieltag:** kein `is_experimental` Rezept

## Umsetzung
Regeln als deklaratives `nutrition_rules.json`, ausgewertet in TypeScript.
**Kein LLM für die Bewertung** — deterministisch, erklärbar, kostenlos.
LLM nur für die *Formulierung* des Verbesserungsvorschlags.

## Disclaimer
Planungshilfe, keine medizinische oder diätetische Beratung.
Bei besonderen Bedarfen: Kinderarzt / Ernährungsberatung.

## Definition of Done
- [ ] Ampel live während der Planbearbeitung
- [ ] Jede rote Bewertung liefert einen umsetzbaren Tauschvorschlag
- [ ] Nährwerte für Top-200-Zutaten gepflegt (BLS-/USDA-Basis)
