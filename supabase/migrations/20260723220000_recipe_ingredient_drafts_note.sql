-- Klammer-Zusätze wie "(à 140 g Abtropfgewicht)" wurden beim Parsen aus dem
-- Zutatennamen entfernt (Suchfähigkeit) und bisher komplett verworfen. Statt
-- Informationsverlust: als note aufheben, analog zu recipe_ingredients.note.

alter table recipe_ingredient_drafts add column note text;
