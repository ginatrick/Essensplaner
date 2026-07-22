# Agenten

Sieben Implementierer entlang der Modul-Docs plus ein read-only Reviewer.

| Agent | Zuständig für | Docs, die er selbst lädt |
|---|---|---|
| `db-architekt` | Schema, Migrationen, RLS, Edge Functions | 03, (02) |
| `speiseplan-frontend` | Next.js-UI: Plan, Rezepte, Einkaufsliste | 04 / 05 / 07 |
| `rezept-pipeline` | Zutaten-Parser, Alias-DB, Rezeptimport | 05, (13) |
| `ingest-entwickler` | FastAPI-Crawler, PDF-Parser, REWE-Abfrage | 06, 08, 13 |
| `optimizer-entwickler` | Varianten A/B/C/D, Routen, Kostenvergleich | 07, 08 |
| `ernaehrungs-logik` | Regelwerk, Wochen-Ampel, Tauschvorschläge | 09 |
| `vorschlags-engine` | habit_events, Scores, Constraint-Solver | 10 |
| `scope-diff-reviewer` | read-only Scope-Prüfung nach größeren Diffs | — |

## Token-Regel

Jeder Agent lädt **nur** die in seinem Frontmatter genannten Docs, nicht den ganzen
`docs/`-Ordner. Neue projektweite Regeln gehören in die Modul-Docs, nicht zusätzlich
in die Agenten-Dateien — sonst stehen sie doppelt im Kontext.

Fortschritt ausschließlich in `docs/12-roadmap.md` abhaken.
