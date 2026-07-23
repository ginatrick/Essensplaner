// Regel-Hinweise für den Wochenplan, siehe docs/04-modul-speiseplan.md "Regeln".
// Nicht blockierend, nur Hinweis-Chips. Reine Funktionen, kein DB-/UI-Bezug.

export type RuleRecipe = {
  id: string;
  tags: string[] | null;
  prep_min: number | null;
  cook_min: number | null;
};

export type RuleEntry = {
  // Identität des Eintrags. Ohne sie ließ sich der Eintrag beim Wiederholungs-
  // Check nur über Objekt-Referenz von sich selbst unterscheiden — hielt der
  // Aufrufer eine Kopie statt der Originalreferenz, meldete jedes Gericht sich
  // selbst als Wiederholung.
  id: string;
  day: number;
  recipe: RuleRecipe;
  pinned: boolean;
};

function hasTagMatch(tags: string[] | null, needle: string | string[]): boolean {
  if (!tags) return false;
  const needles = Array.isArray(needle) ? needle : [needle];
  return tags.some((t) => needles.some((n) => t.toLowerCase().includes(n)));
}

export function isVegetarian(recipe: RuleRecipe): boolean {
  return hasTagMatch(recipe.tags, ["vegetarisch", "vegan"]);
}

export function isFish(recipe: RuleRecipe): boolean {
  return hasTagMatch(recipe.tags, "fisch");
}

export function isEffortHigh(recipe: RuleRecipe): boolean {
  return (recipe.prep_min ?? 0) + (recipe.cook_min ?? 0) > 60;
}

// Wiederholt sich das Rezept von `entry` innerhalb von 14 Tagen (rückwärts, inkl. Vorwoche)?
// `pinned` Einträge werden von der Prüfung ausgenommen (siehe Regel-Spec).
export function isRepeatedWithin14Days(
  entry: RuleEntry,
  currentWeekEntries: RuleEntry[],
  previousWeekEntries: RuleEntry[]
): boolean {
  if (entry.pinned) return false;
  const others = currentWeekEntries
    .filter((e) => e.id !== entry.id)
    .map((e) => ({ ...e, dayOffset: e.day }))
    .concat(previousWeekEntries.map((e) => ({ ...e, dayOffset: e.day - 7 })));

  return others.some(
    (o) =>
      o.recipe.id === entry.recipe.id &&
      !o.pinned &&
      Math.abs(entry.day - o.dayOffset) <= 13
  );
}

export type WeekRuleSummary = {
  missingVegetarian: boolean;
  missingFish: boolean;
};

// Wochen-weite Hinweise: gilt für die ganze angezeigte Woche, nicht pro Tag.
export function weekRuleSummary(entries: RuleEntry[]): WeekRuleSummary {
  return {
    missingVegetarian: entries.length > 0 && !entries.some((e) => isVegetarian(e.recipe)),
    missingFish: entries.length > 0 && !entries.some((e) => isFish(e.recipe)),
  };
}
