# Edge Functions

## price-compare

Ruft für eine Liste von Zutaten den lokalen Ingest-Service (`GET /rewe/price`)
ab und gibt die Treffer gesammelt zurück. Läuft mit begrenzter Parallelität
(5 gleichzeitige Requests), damit der lokale Ingest-Prozess nicht überlastet
wird.

**Request:**
```json
{ "ingredient_ids": ["<uuid>", "<uuid>"], "market_id": "1469536" }
```

**Response:**
```json
{ "prices": [
  { "ingredient_id": "<uuid>", "hit": true, "product_name": "...", "amount": 1000, "unit": "ml", "price_cent": 109, "is_offer": false },
  { "ingredient_id": "<uuid>", "hit": false }
] }
```

Kein Treffer/Ingest-Service nicht erreichbar → `hit: false` statt Fehler
(Degradation, siehe `docs/13-recht-risiken.md`).

## Deployment (einmalig, manuell — braucht dein Supabase-Projekt)

```bash
npm install -g supabase   # falls noch nicht vorhanden
supabase login
supabase link --project-ref <dein-projekt-ref>   # Project Settings -> General

supabase functions deploy price-compare

# Secrets setzen (INGEST_BASE_URL = die Cloudflare-Tunnel-URL aus ingest/README.md):
supabase secrets set INGEST_BASE_URL=https://ingest.<deine-domain>
supabase secrets set INGEST_SHARED_SECRET=<derselbe Wert wie ingest/.env INGEST_SHARED_SECRET>
```

Ohne gesetzte Secrets liefert die Function für jede Zutat `hit: false` statt
eines Fehlers — die Web-App bleibt nutzbar, nur ohne REWE-Preise.
