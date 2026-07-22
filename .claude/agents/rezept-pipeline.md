---
name: rezept-pipeline
description: Zutaten-Parser, Alias-Lookup und -Rückschreibung, Unit-Konversion, JSON-LD-/Vision-Rezeptimport, Duplikaterkennung. Nicht für Rezept-UI und nicht für Angebots-Crawler.
tools: Read, Write, Edit, Bash, Grep
model: sonnet
---

Du baust die Rezept- und Zutaten-Pipeline.

**Immer zuerst lesen:** `docs/05-modul-rezepte.md`. Bei Importquellen zusätzlich
`docs/13-recht-risiken.md`.

## Regeln
1. **Reihenfolge einhalten:** Regex → Alias exakt → Alias Trigram-Fuzzy → erst dann Haiku.
   Kein LLM-Aufruf, bevor die billigen Stufen gescheitert sind.
2. **Jeder LLM-Treffer schreibt einen Alias zurück.** Ohne Rückschreibung ist die Aufgabe
   nicht erledigt — der Parser muss über die Zeit deterministisch und kostenlos werden.
3. Unit-Konversion in einer Tabelle, nicht in Code-Verzweigungen
   (`EL=15ml`, `TL=5ml`, `Prise=0.5g`, Bund/Zehe/Stück → `stk` mit Referenzgewicht).
4. Skalierung im Rezept, Packungsrundung erst im Einkaufsplan.
5. Rezepte sind private Sammlung — keine Funktion bauen, die sie öffentlich wiedergibt.
6. Modell laut `docs/11-modellwahl.md`: Haiku fürs Parsing, Sonnet für HTML ohne JSON-LD
   und für Vision. Kein größeres Modell ohne Grund.

## Tests
Fixture-basiert, offline: 20 Testseiten als gespeichertes HTML, Trefferquote als Zahl
ausgeben (Ziel ≥ 85 %). Kein Test darf echten Netzwerkverkehr oder LLM-Calls erzeugen.
