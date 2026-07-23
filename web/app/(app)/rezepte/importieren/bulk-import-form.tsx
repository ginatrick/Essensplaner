"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importRecipesBulk, type BulkImportResult } from "./actions";

// Serverless-Funktionen haben ein Zeitlimit (Vercel: je nach Plan 10-60s+).
// Ein einzelner Aufruf mit z.B. 483 URLs (je ~2-4s durch Fetch + Haiku-Calls
// + 1,5s Pause) würde das reißen. Deshalb hier in kleinen Häppchen aufrufen,
// Ergebnisse laufen mit rein statt am Ende alles auf einmal.
const CHUNK_SIZE = 10;

export function BulkImportForm() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<BulkImportResult[] | null>(null);

  async function run() {
    const urls = text.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!urls.length) return;
    setPending(true);
    setResults([]);
    setProgress({ done: 0, total: urls.length });
    for (let i = 0; i < urls.length; i += CHUNK_SIZE) {
      const chunk = urls.slice(i, i + CHUNK_SIZE);
      const chunkResult = await importRecipesBulk(chunk);
      setResults((prev) => [...(prev ?? []), ...chunkResult]);
      setProgress({ done: Math.min(i + CHUNK_SIZE, urls.length), total: urls.length });
    }
    setPending(false);
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">Mehrere URLs auf einmal importieren</summary>
      <div className="mt-3 space-y-2">
        <Textarea rows={6} placeholder={"https://…\nhttps://…"} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="button" onClick={run} disabled={pending}>{pending ? "Importiere …" : "Bulk-Import starten"}</Button>
        {progress && <p className="text-xs text-muted-foreground">{progress.done} / {progress.total}</p>}
        {results && (
          <ul className="space-y-1 text-sm">
            {results.map((r) => (
              <li key={r.url} className={r.status === "imported" ? "text-green-700" : r.status === "duplicate" ? "text-amber-700" : "text-destructive"}>
                {r.status === "imported" && `✓ ${r.title}`}
                {r.status === "duplicate" && `↷ übersprungen (Duplikat): ${r.title}`}
                {r.status === "error" && `✗ ${r.url} — ${r.error}`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
