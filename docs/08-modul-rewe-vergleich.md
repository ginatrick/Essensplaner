# 08 — Modul: REWE-Abholservice-Vergleich

## Zweck
Beantwortet: *"Lohnen sich die Wege zu 3 Märkten, oder alles auf einmal bei REWE abholen?"*

## Datenbeschaffung
- REWE nicht-authentifizierte Produkt-/Such-Endpunkte, Marktkontext per `marketId`
- Pro Zutat: Suche → bestes Treffer-Produkt (Preis pro Basiseinheit)
- Cache 24 h in `rewe_prices` — kein Live-Call pro Seitenaufruf
- **Kein automatischer Bestellvorgang.** Nur Warenkorb-Deeplink / Liste zur manuellen Nutzung

## Vergleichsrechnung
| Position | A Multi-Markt | B Einzelmarkt | C REWE Abholung |
|---|---|---|---|
| Warenkosten | Σ Angebotspreise | Σ Preise Markt X | Σ REWE-Preise |
| Servicegebühr | 0 | 0 | Abholgebühr (konfig.) |
| Fahrtkosten | Rundreise × Satz | Hin/Rück × Satz | Hin/Rück REWE × Satz |
| Zeitaufwand | Σ Fahrt + 20 min/Markt | Fahrt + 25 min | Fahrt + 5 min |
| **Gesamt €** | | | |
| **Zeit (min)** | | | |

## Empfehlungslogik
```
if C.kosten <= A.kosten + TOLERANZ_EUR and C.zeit < A.zeit - 30:
    empfehle C          # Zeitersparnis rechtfertigt Mehrpreis
elif A.kosten < C.kosten - SCHWELLE_EUR:
    empfehle A
else:
    empfehle D          # Kompromiss 2 Märkte
```
`TOLERANZ_EUR` und `SCHWELLE_EUR` als Settings → Patrick stellt selbst ein,
was ihm seine Zeit wert ist.

## Darstellung
- Headline: *"REWE komplett kostet 12,40 € mehr, spart 55 Minuten (≈ 13,50 €/h)"*
- Aufklappbar: Positionsliste, größte Preisdifferenzen zuerst
- Warnung bei Zutaten ohne REWE-Match → Vergleich unvollständig (Confidence-Flag)

## Definition of Done
- [ ] ≥ 90 % der Zutaten mit REWE-Match
- [ ] Vergleich reproduzierbar (Preis-Snapshot mit Zeitstempel)
- [ ] Deeplink oder abtippbare Liste
