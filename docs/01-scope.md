# 01 — Scope

## Ziel
Wochenspeiseplan (Fokus warme Mahlzeiten) → automatisch Rezepte, Einkaufsplanung
nach Markt & Abteilung, Kostenvergleich gegen REWE Abholservice, lernende
Vorschlags-Engine mit Ernährungsfokus.

## Personas
| Person | Rolle | Bedarf |
|---|---|---|
| Patrick | Planer/Einkäufer | Schnell, wenig Klicks, Zeit-/Geldersparnis sichtbar |
| Kind A (12) | Fußballer | Erhöhter Energie-, Protein-, Eisen-, Ca-Bedarf |
| Kind B (8) | Grundschule | Ausgewogen, kindgerecht, Akzeptanz wichtig |

## In Scope (v1)
- Wochenplan-Editor: 7 Tage × Slot "Mittag/Abend warm"
- Rezeptverwaltung: eigene Rezepte + Import per URL
- Zutaten-Normalisierung + Skalierung auf Portionen
- Angebots-Ingestion für Märkte im Umkreis (Default 15 km)
- Einkaufsplan pro Markt, gruppiert nach Abteilung (in Laufreihenfolge)
- REWE-Abholservice-Vergleich inkl. Fahrtkosten & Zeitbewertung
- Gewohnheits-Tracking + Wochenplan-Vorschläge
- Nährwert-Ampel pro Woche (keine Gramm-Bilanzierung)

## Out of Scope (v1)
- Automatischer Bestellabschluss (nur Warenkorb-Deeplink / Liste)
- Frühstück/Snacks als Planungsobjekt (nur Staples-Liste)
- Native Mobile App (PWA reicht)
- Multi-Haushalt / Mandantenfähigkeit
- Kalorien-Tracking pro Person

## Erfolgskriterien
- Wochenplan in < 3 Minuten erstellt
- Einkaufsliste ohne manuelle Nacharbeit brauchbar
- Ersparnis-Aussage nachvollziehbar (Positionsliste mit Begründung)
- Nach 6 Wochen: ≥ 60 % der Vorschläge ohne Änderung übernommen
