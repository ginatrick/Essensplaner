// Edge Function: ruft für eine Liste von Zutaten den lokalen Ingest-Service
// nach REWE-Preisen ab (docs/02-architektur.md: "Edge Fn price-compare ruft
// Ingest-API auf"). Der Shared Secret und die Tunnel-URL leben nur hier als
// Function-Secrets (`supabase secrets set`), nie im Browser-Client.
//
// Der Ingest-Service (ingest/main.py, GET /rewe/price) macht bereits den
// 24h-Cache-Check und das Zutaten-Matching selbst — diese Function ist ein
// dünner, parallelisierender Proxy, keine eigene Preislogik.

const CONCURRENCY = 5;

type ReweHit =
  | { ingredient_id: string; hit: true; product_name: string; amount: number; unit: string; price_cent: number; is_offer: boolean }
  | { ingredient_id: string; hit: false };

async function fetchOne(ingredientId: string, marketId: string, baseUrl: string, secret: string): Promise<ReweHit> {
  try {
    const url = `${baseUrl}/rewe/price?ingredient_id=${encodeURIComponent(ingredientId)}&market_id=${encodeURIComponent(marketId)}`;
    const response = await fetch(url, {
      headers: { "X-Ingest-Secret": secret },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return { ingredient_id: ingredientId, hit: false };
    const data = await response.json();
    return { ingredient_id: ingredientId, ...data };
  } catch {
    // Ingest-PC aus oder Tunnel down -> degradieren statt crashen (docs/13-recht-risiken.md).
    return { ingredient_id: ingredientId, hit: false };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: { ingredient_ids?: unknown; market_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "ungültiges JSON" }), { status: 400 });
  }

  const { ingredient_ids, market_id } = body;
  if (!Array.isArray(ingredient_ids) || typeof market_id !== "string") {
    return new Response(
      JSON.stringify({ error: "ingredient_ids (string[]) und market_id (string) erforderlich" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const baseUrl = Deno.env.get("INGEST_BASE_URL");
  const secret = Deno.env.get("INGEST_SHARED_SECRET");
  if (!baseUrl || !secret) {
    // Ingest-Anbindung noch nicht konfiguriert -> "unvollständig" statt Fehler,
    // damit die UI trotzdem ohne REWE-Preise weiterarbeiten kann.
    return new Response(
      JSON.stringify({ prices: ingredient_ids.map((id) => ({ ingredient_id: id, hit: false })) }),
      { headers: { "content-type": "application/json" } },
    );
  }

  const results: ReweHit[] = [];
  for (let i = 0; i < ingredient_ids.length; i += CONCURRENCY) {
    const batch = ingredient_ids.slice(i, i + CONCURRENCY) as string[];
    results.push(...(await Promise.all(batch.map((id) => fetchOne(id, market_id, baseUrl, secret)))));
  }

  return new Response(JSON.stringify({ prices: results }), {
    headers: { "content-type": "application/json" },
  });
});
