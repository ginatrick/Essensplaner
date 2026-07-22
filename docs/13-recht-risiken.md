# 13 — Recht & Risiken

> Kein Rechtsrat. Vor produktivem Betrieb mit externen Daten ggf. anwaltlich prüfen.

## Rezept-Import
- Zutatenlisten sind als reine Aufzählung meist nicht schutzfähig; **Anleitungstexte und Fotos schon**.
- Regel im Projekt: Import nur für die **private Sammlung**, kein öffentliches Teilen,
  Quell-URL immer speichern und in der UI verlinken.
- Kein Nachbau einer Rezeptdatenbank für Dritte.

## Angebots-Scraping
- ToS/robots.txt der jeweiligen Seite prüfen, **bevor** ein Crawler pro Kette gebaut wird.
- Prospekt-PDFs, die frei und ohne Login angeboten werden, sind das mildeste Mittel.
- Rate-Limit einhalten: max. 1 Crawl pro Kette pro Tag, User-Agent mit Kontaktangabe.
- Aggregatoren (Stufe 3) haben oft explizite Scraping-Verbote → nur nach Prüfung.
- Alternative wenn blockiert: manueller Prospekt-Upload durch den Nutzer.

## REWE-Abholservice
- Nicht-authentifizierte Endpunkte können sich jederzeit ändern → Pipeline muss
  bei Fehlern degradieren, nicht crashen. Vergleich dann als "unvollständig" kennzeichnen.
- Kein automatisierter Bestellabschluss, keine Kontoerstellung, keine Zahlungsdaten
  durch das Tool. Nur Liste / Deeplink.
- Preisangaben immer mit Zeitstempel + Hinweis "ohne Gewähr".

## DSGVO
- Es werden Daten über Kinder verarbeitet (Alter, Ernährung) → Datenminimierung:
  nur Alter + Aktivitätslevel, keine Gesundheitsdaten, keine Namen wenn vermeidbar.
- Single-User-System, Daten bleiben in EU-Region (Supabase EU-Central, Hetzner DE).
- Kein Tracking, keine Drittanbieter-Analytics.
- LLM-Calls: keine Klarnamen der Kinder an die API senden.

## Ernährung
- Disclaimer in der UI: Planungshilfe, keine medizinische Beratung.
- Keine Kalorien-Vorgaben pro Kind anzeigen (Risiko gestörtes Essverhalten) —
  bewusst nur Wochen-Ampel auf Plan-Ebene, keine Personenbilanz.

## Technische Risiken
| Risiko | Gegenmaßnahme |
|---|---|
| Scraper bricht bei Seitenänderung | Confidence-Flag, Degradation, Monitoring-Alert |
| LLM-Kosten laufen weg | Alias-Cache, Haiku statt Sonnet, Budget-Alert |
| Falsche Preise → falsche Empfehlung | `price_history`-Plausibilität, Zeitstempel, "ohne Gewähr" |
| Schlechte Vorschläge → Tool wird nicht genutzt | Cold-Start-Set, ε-Exploration, Akzeptanzrate messen |
