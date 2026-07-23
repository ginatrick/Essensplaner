-- Migration: Lock gegen Doppelläufe beim Prospekt-Ingest (docs/06-modul-angebote.md).
--
-- docs/06 nennt pg_advisory_lock(hashtext(chain)). Das ist sessiongebunden —
-- der Ingest-Service spricht Supabase aber über PostgREST/supabase-py
-- (zustandslose REST-Aufrufe, jeder Call kann aus dem Connection-Pool eine
-- andere Verbindung bekommen). Ein pg_advisory_lock würde spätestens beim
-- nächsten Request wieder freigegeben, bevor der eigentliche Crawl (der in
-- Python läuft, nicht in SQL) fertig ist — funktioniert über REST nicht.
-- Stattdessen: eine Lock-Tabelle mit Unique-Constraint, atomarer Insert als
-- Try-Lock, Delete als Unlock. Gleicher Zweck, funktioniert zustandslos.

create table ingest_locks (
  chain text primary key,
  locked_at timestamptz not null default now()
);

alter table ingest_locks enable row level security;

create policy ingest_locks_service on ingest_locks for all to service_role using (true) with check (true);
