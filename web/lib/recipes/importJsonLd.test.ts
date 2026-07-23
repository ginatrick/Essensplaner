import { test } from "node:test";
import assert from "node:assert/strict";
import { extractRecipeFromHtml, RecipeJsonLdError } from "./importJsonLd.ts";

test("mappt einfaches Recipe-Objekt, Dauer und Yield", () => {
  const data = { "@type": "Recipe", name: "Suppe", recipeIngredient: ["2 EL Öl", "3 Möhren"], recipeInstructions: "Öl erhitzen\nMöhren schneiden", prepTime: "PT15M", cookTime: "PT1H30M", recipeYield: "4 Portionen" };
  const draft = extractRecipeFromHtml(`<script type="application/ld+json">${JSON.stringify(data)}</script>`);
  assert.deepEqual(draft, { title: "Suppe", servings_base: 4, prep_min: 15, cook_min: 90, steps: ["Öl erhitzen", "Möhren schneiden"], ingredients: ["2 EL Öl", "3 Möhren"] });
});

test("findet Recipe im @graph und verarbeitet HowToStep/HowToSection", () => {
  const data = { "@graph": [{ "@type": "WebSite" }, { "@type": ["Recipe", "Thing"], name: "Pasta", recipeIngredient: ["250 g Nudeln"], recipeInstructions: [{ "@type": "HowToSection", itemListElement: [{ "@type": "HowToStep", text: "Kochen" }, { "@type": "HowToStep", text: "Abgießen" }] }], recipeYield: [{ "@type": "QuantitativeValue", value: "6 Portionen" }] }] };
  const html = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  assert.deepEqual(extractRecipeFromHtml(html), { title: "Pasta", servings_base: 6, prep_min: undefined, cook_min: undefined, steps: ["Kochen", "Abgießen"], ingredients: ["250 g Nudeln"] });
});

test("dekodiert HTML-Entities in Titel, Zutaten und Schritten (manche Seiten liefern sie unkonvertiert im JSON-LD)", () => {
  const data = { "@type": "Recipe", name: "K&auml;sesuppe", recipeIngredient: ["200 g K&auml;se", "1 Prise Salz &amp; Pfeffer"], recipeInstructions: ["K&auml;se reiben"] };
  const html = `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  const result = extractRecipeFromHtml(html);
  assert.equal(result.title, "Käsesuppe");
  assert.deepEqual(result.ingredients, ["200 g Käse", "1 Prise Salz & Pfeffer"]);
  assert.deepEqual(result.steps, ["Käse reiben"]);
});

test("kein Recipe liefert definierten Fehler", () => {
  assert.throws(() => extractRecipeFromHtml("<html></html>"), RecipeJsonLdError);
});

test("akzeptiert Top-Level-Array und numerischen Yield", () => {
  const html = `<script type="application/ld+json">${JSON.stringify([{ "@type": "BreadcrumbList" }, { "@type": "Recipe", name: "Salat", recipeYield: 3, recipeInstructions: [{ "@type": "HowToStep", text: "Mischen" }] }])}</script>`;
  assert.deepEqual(extractRecipeFromHtml(html), { title: "Salat", servings_base: 3, prep_min: undefined, cook_min: undefined, steps: ["Mischen"], ingredients: [] });
});
