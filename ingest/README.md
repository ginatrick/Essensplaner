# Ingest-Service

Python 3.12 / FastAPI. Läuft lokal auf dem Entwickler-PC, siehe
`docs/02-architektur.md`. Crawler/Parser folgen in `sources/` und `parsing/`.

## Setup

```bash
cd ingest
python -m venv .venv
.venv\Scripts\activate        # Windows; unter Linux/Mac: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env        # Werte eintragen: INGEST_SHARED_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

`SUPABASE_SERVICE_ROLE_KEY` steht im Supabase-Dashboard unter
Project Settings → API. Niemals im Frontend/`NEXT_PUBLIC_*` verwenden.

## Starten

```bash
uvicorn main:app --reload --port 8000
```

`GET /health` ist öffentlich (Erreichbarkeits-Check). Alle anderen Endpoints
verlangen den Header `X-Ingest-Secret: <INGEST_SHARED_SECRET>`.

## Tests

```bash
pytest
```

Kein Test darf echten Netzwerkverkehr erzeugen (siehe `.claude/agents/ingest-entwickler.md`).

## Cloudflare Tunnel (macht die lokale API für Supabase erreichbar)

Einmalig, manuell auf dem Rechner, auf dem der Ingest-Service läuft — das
erfordert eine interaktive Browser-Anmeldung und kann nicht automatisiert
werden:

1. `cloudflared` installieren: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. `cloudflared tunnel login` — öffnet den Browser, Cloudflare-Account auswählen
3. `cloudflared tunnel create mealplanner-ingest`
4. In der Tunnel-Config (`~/.cloudflared/config.yml`) einen Hostname auf
   `http://localhost:8000` routen, z. B.:
   ```yaml
   tunnel: <tunnel-id-aus-schritt-3>
   credentials-file: <pfad-aus-schritt-3>
   ingress:
     - hostname: ingest.<deine-domain>
       service: http://localhost:8000
     - service: http_status:404
   ```
5. DNS-Route setzen: `cloudflared tunnel route dns mealplanner-ingest ingest.<deine-domain>`
6. Tunnel starten: `cloudflared tunnel run mealplanner-ingest`
7. Die resultierende `https://ingest.<deine-domain>`-URL + `INGEST_SHARED_SECRET`
   in die Supabase Edge Function (`price-compare` u. a.) als Secret eintragen.

Solange der Rechner aus ist, ist der Ingest-Service nicht erreichbar — für die
aktuelle Phase akzeptiert (siehe `docs/02-architektur.md`).
