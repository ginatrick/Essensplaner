# 11 — Modellwahl & Aufgabenverteilung

## Grundsatz
**So wenig LLM wie möglich.** Alles Deterministische (Ampel, Optimizer, Score)
läuft in Code — reproduzierbar, kostenlos, debugbar.
LLM nur für: unstrukturierten Input → Struktur, und Struktur → Text.

## Laufzeit-LLM (Anthropic API, im Produkt)
| Aufgabe | Modell | Warum |
|---|---|---|
| Zutaten-String-Parsing (Fallback) | **Haiku 4.5** | Hochfrequent, einfache Klassifikation, muss billig sein |
| Prospekt-PDF → Angebots-JSON | **Haiku 4.5** | Volumen (viele Seiten), klar strukturierte Extraktion |
| Rezept-URL ohne JSON-LD | **Sonnet 5** | Verschachteltes HTML, mehr Reasoning nötig |
| Rezeptfoto → Rezept (Vision) | **Sonnet 5** | Vision + Struktur |
| Vorschlags-Begründung | **Haiku 4.5** | Kurzer Text aus fertiger Struktur |
| Zutaten-Matching Embedding-Fallback | Embedding-Modell + pgvector | Kein Chat-LLM nötig |
| Ampel-Bewertung | **kein LLM** | Deterministische Regeln |
| Optimizer / Routen | **kein LLM** | Reine Rechnung |

**Kostenanker:** Ziel < 2 € / Monat Laufzeitkosten. Wird überschritten → Alias-Cache prüfen.

## Entwicklungs-LLM (wer baut was)

### Claude Code — Architektur & Zusammenhänge
- Supabase-Schema + Migrationen + RLS-Policies
- Edge Functions (`price-compare`, `plan-suggest`)
- Optimizer-Logik & Constraint-Solver
- Ernährungs-Regelwerk
- Alles, was mehrere Module berührt
- Review von Codex-Output

### Codex — abgegrenzte, gut spezifizierte Einzelaufgaben
- CRUD-UI-Komponenten (Rezeptformular, Rezeptliste, Settings)
- Unit-Konversionstabelle + Tests
- FastAPI-Endpoints mit fixem Kontrakt
- Playwright/pdfplumber-Scraper pro Kette (isoliert, klarer Input/Output)
- Test-Suites zu bestehenden Modulen
- Tailwind/shadcn-Styling-Feinschliff
- Seed-Skripte (Zutaten-Stammdaten, Nährwerte)

**Regel für Codex-Delegation:** Die Aufgabe muss in eine Datei/ein Modul passen und
einen schriftlich fixierten Input/Output-Kontrakt haben.
Ist der Kontrakt unklar → erst Claude Code, dann Codex.

## Arbeitsteilung konkret
```
Claude Code   →  schreibt docs/ + Schema + Kontrakte
     ↓
Codex         →  implementiert gegen Kontrakt
     ↓
Claude Code   →  Integration + Review + Fix
```
