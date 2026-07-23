-- Migration: Märkte im 15-km-Radius um Steinbach-Hallenberg (98587) seeden.
-- Koordinaten aus OpenStreetMap (Overpass API), distance_km/drive_min per
-- OSRM-Routing (Auto) vom Haushalt aus berechnet — siehe docs/06-modul-angebote.md.
-- Max. 3 Filialen pro Kette, alle innerhalb 15 km Luftlinie vom Haushalt.

insert into stores (chain, name, lat, lng, address, distance_km, drive_min) values
  ('ALDI', 'ALDI Steinbach-Hallenberg (Bahnhofstraße 16)', 50.693703, 10.5608303, 'Bahnhofstraße 16, 98587 Steinbach-Hallenberg', 5.8, 13),
  ('ALDI', 'ALDI Zella-Mehlis (Industriestraße)', 50.6434654, 10.6894932, 'Industriestraße, 98544 Zella-Mehlis', 14.3, 23),
  ('ALDI', 'ALDI Schmalkalden (Kasseler Straße 42)', 50.7182274, 10.4304352, 'Kasseler Straße 42, 98574 Schmalkalden', 16.1, 26),
  ('EDEKA', 'EDEKA Steinbach-Hallenberg (Hauptstraße 92)', 50.7018284, 10.5702003, 'Hauptstraße 92, 98587 Steinbach-Hallenberg', 2.8, 12),
  ('EDEKA', 'EDEKA Zella-Mehlis (Talstraße 50)', 50.6568387, 10.6577901, 'Talstraße 50, 98544 Zella-Mehlis', 10.8, 17),
  ('EDEKA', 'EDEKA Schmalkalden (Allendestraße 8)', 50.7184544, 10.4667685, 'Allendestraße 8, 98574 Schmalkalden', 13.4, 22),
  ('Kaufland', 'Kaufland Schmalkalden (Steinerne Wiese 39)', 50.7226194, 10.4474952, 'Steinerne Wiese 39, 98574 Schmalkalden', 15.2, 25),
  ('Kaufland', 'Kaufland Suhl (Würzburger Straße 1)', 50.6044517, 10.6789615, 'Würzburger Straße 1, 98529 Suhl', 19.3, 29),
  ('Lidl', 'Lidl Zella-Mehlis (Talstraße 77a)', 50.654129, 10.6625139, 'Talstraße 77a, 98544 Zella-Mehlis', 11.2, 18),
  ('Lidl', 'Lidl Schmalkalden (Näherstiller Straße 41)', 50.7174171, 10.4674248, 'Näherstiller Straße 41, 98574 Schmalkalden', 13.1, 22),
  ('Lidl', 'Lidl Suhl (Mauerstraße 1)', 50.6155848, 10.6983941, 'Mauerstraße 1, 98527 Suhl', 17.3, 27),
  ('Netto', 'Netto Schmalkalden (Am Alten Graben 18)', 50.7263758, 10.4540721, 'Am Alten Graben 18, 98574 Schmalkalden', 15.7, 26),
  ('Netto', 'Netto Suhl (Große Beerbergstraße 95)', 50.6328179, 10.7050143, 'Große Beerbergstraße 95, 98528 Suhl', 15.9, 25),
  ('Netto', 'Netto Tambach-Dietharz (Hauptstraße 1)', 50.794547, 10.6149726, 'Hauptstraße 1, 99897 Tambach-Dietharz', 23.9, 35),
  ('Norma', 'Norma Steinbach-Hallenberg (Hammergasse 7)', 50.6997064, 10.5695298, 'Hammergasse 7, 98587 Steinbach-Hallenberg', 2.8, 12),
  ('Norma', 'Norma Zella-Mehlis (Otto-Keiner-Straße 79)', 50.6527644, 10.6041731, 'Otto-Keiner-Straße 79, 98544 Zella-Mehlis', 6.5, 12),
  ('Norma', 'Norma Suhl (Am Königswasser 7)', 50.638634, 10.6977064, 'Am Königswasser 7, 98528 Suhl', 15.5, 25),
  ('REWE', 'REWE Zella-Mehlis (Industriestraße 6)', 50.6439533, 10.6893818, 'Industriestraße 6, 98544 Zella-Mehlis', 14.0, 23),
  ('REWE', 'REWE Schmalkalden (Renthofstraße 8)', 50.7210724, 10.4579493, 'Renthofstraße 8, 98574 Schmalkalden', 14.1, 23),
  ('REWE', 'REWE Schmalkalden (Wilhelm-Külz-Straße 11)', 50.7298615, 10.4566072, 'Wilhelm-Külz-Straße 11, 98574 Schmalkalden', 16.2, 27);
