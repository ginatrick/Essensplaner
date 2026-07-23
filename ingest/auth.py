"""Shared-Secret-Auth: alle Ingest-Endpoints sind ausschließlich für Supabase
Edge Functions gedacht, nie öffentlich erreichbar (siehe docs/02-architektur.md)."""

import os

from fastapi import Header, HTTPException


def require_ingest_secret(x_ingest_secret: str | None = Header(default=None)) -> None:
    expected = os.environ.get("INGEST_SHARED_SECRET")
    if not expected:
        raise HTTPException(status_code=500, detail="INGEST_SHARED_SECRET ist nicht gesetzt")
    if x_ingest_secret != expected:
        raise HTTPException(status_code=401, detail="Ungültiges oder fehlendes X-Ingest-Secret")
