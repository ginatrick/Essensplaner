# 04 — Modul: Speiseplan

## UI
- Wochenraster 7 × 2 Slots (Mittag / Abend)
- Drag & Drop aus Rezept-Schublade, Klick → Rezeptsuche
- Portionsanzahl pro Eintrag (Default aus `household_members`)
- Tages-Badge: Ernährungs-Ampel → siehe `09-modul-ernaehrung.md`
- Button **"Woche vorschlagen"** → siehe `10-modul-lernen.md`
- Button **"Einkaufsliste erzeugen"** → Plan auf `final`

## Regeln (nicht blockierend, nur Hinweis)
- Kein Rezept zweimal in 14 Tagen (außer `pinned`)
- ≥ 1 vegetarischer Tag/Woche (konfigurierbar)
- ≥ 1 Fischgericht/Woche
- Trainingstage: `prep_min + cook_min <= 40`
- Spieltag: kein `is_experimental` Rezept
- Resteverwertung: `servings > Haushalt` → Slot-Vorschlag "Reste" am Folgetag

## Templates
`meal_plans.status = 'template'` — z. B. "Trainingswoche", "Ferienwoche", "Wenig-Zeit-Woche".

## Definition of Done
- [ ] Plan anlegen / bearbeiten / duplizieren / als Template speichern
- [ ] Regelverstöße als Hinweis-Chip
- [ ] Export PDF/PNG für den Kühlschrank
