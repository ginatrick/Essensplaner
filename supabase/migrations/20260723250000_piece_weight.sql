-- Voraussetzung für die nährwertbasierte Wochen-Ampel: Zutaten, die stückweise
-- angegeben werden ("2 Eier", "1 Zwiebel"), hatten kein Gewicht. Nährwerte sind
-- aber je 100 g hinterlegt — solche Zeilen wären mit 0 in die Summe eingegangen
-- und hätten den Protein-/Ballaststoffgehalt systematisch zu niedrig gerechnet.
--
-- Werte sind übliche mittlere Stückgewichte des essbaren Anteils (Schale/Kern
-- abgezogen), bewusst gerundet. Keine Messwerte aus einer Nährwertdatenbank —
-- sie dienen der Größenordnung für die Ampel, nicht der exakten Bilanz.

alter table ingredients add column piece_weight_g numeric;

comment on column ingredients.piece_weight_g is
  'Mittleres Stückgewicht (essbarer Anteil) in g. Nur zur Nährwert-Hochrechnung bei stückweisen Mengenangaben, geschätzt.';

update ingredients set piece_weight_g = v.g from (values
  ('apfel', 150), ('birne', 150), ('banane', 120), ('orange', 150),
  ('mandarine', 70), ('kiwi', 75), ('pfirsich', 150), ('nektarine', 130),
  ('avocado', 140), ('zitrone', 100), ('limette', 65),
  ('kartoffel', 100), ('suesskartoffel', 200), ('karotte', 70),
  ('zwiebel', 110), ('tomate', 85), ('gurke', 400), ('zucchini', 200),
  ('aubergine', 300), ('paprika-rot', 150),
  ('ei', 55), ('eier', 55),
  ('scheiben-altbackenes-brot', 40), ('zartbitterschokolade', 100),
  -- Knoblauch wird in g geführt, in Rezepten aber zehenweise gezählt.
  ('knoblauch', 3)
) as v(slug, g)
where ingredients.slug = v.slug;
