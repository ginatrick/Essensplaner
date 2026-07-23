"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { importRecipesBulk, type BulkImportResult } from "./actions";

export function BulkImportForm() {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<BulkImportResult[] | null>(null);

  async function run() {
    const urls = text.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!urls.length) return;
    setPending(true);
    setResults(null);
    const result = await importRecipesBulk(urls);
    setResults(result);
    setPending(false);
  }

  return (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-sm font-medium">Mehrere URLs auf einmal importieren</summary>
      <div className="mt-3 space-y-2">
        <Textarea rows={6} placeholder={"https://…\nhttps://…"} value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="button" onClick={run} disabled={pending}>{pending ? "Importiere …" : "Bulk-Import starten"}</Button>
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
