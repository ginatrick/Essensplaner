# Setup

## 1. Struktur
```
mealplanner/
├── CLAUDE.md              Index, bleibt kurz
├── SETUP.md
├── docs/                  Modul-Docs 01–13
├── .claude/
│   ├── settings.json
│   ├── agents/            8 Agents, siehe agents/README.md
│   └── skills/            supabase · supabase-postgres-best-practices
│                          nextjs-best-practices · writing-plans
└── codex/                 Aufgabenpakete
```

## 2. Erster Claude-Code-Aufruf
```
Lies CLAUDE.md und docs/12-roadmap.md.
Starte Phase 0. Nutze den Subagent db-architekt fuer Schema und RLS.
Arbeite die Checkboxen der Reihe nach ab und hake sie in docs/12-roadmap.md ab.
Frage nach, bevor du eine Entscheidung triffst, die von den docs abweicht.
```

## 3. Kontext klein halten
- `CLAUDE.md` ist der Index, keine Inhalte dort einbauen
- Immer nur die 1–2 relevanten `docs/NN-*.md` in den Kontext geben
- Fortschritt ausschließlich in `docs/12-roadmap.md` pflegen
- Agents laden ihre Docs selbst (siehe Frontmatter-Hinweis in jedem Agent)

## 4. Reihenfolge-Hinweis
Phase 3 (Einkaufsliste ohne Preise) ist bewusst vor den Preisen —
danach ist das Tool bereits im Alltag nutzbar. Alles Weitere ist Optimierung.
