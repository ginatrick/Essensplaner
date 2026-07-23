-- Migration: Vorlagen-Name für meal_plans mit status='template'
-- Nur bei Vorlagen gepflegt, bei draft/final bleibt die Spalte leer.

alter table meal_plans add column template_name text;
