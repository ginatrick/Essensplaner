// Offline-Stand der Einkaufsliste in localStorage — kein IndexedDB/Sync-Queue,
// nur "letzten bekannten Stand pro Woche wieder anzeigen können".
// ponytail: einzelner localStorage-Eintrag pro Woche, kein Konfliktabgleich bei
// mehreren Geräten — ausreichend für den Einzelhaushalt-Anwendungsfall hier.
import type { GroupedDepartment, ShoppingItem } from "./aggregate";

type CachedList = { planId: string | null; groups: GroupedDepartment<ShoppingItem>[]; checked: string[] };

function key(weekStart: string): string {
  return `mealplanner:einkaufsliste:${weekStart}`;
}

export function saveShoppingListCache(weekStart: string, data: CachedList): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(weekStart), JSON.stringify(data));
  } catch {
    // Speicher voll o. ä. — Offline-Cache ist ein Komfort, kein Muss.
  }
}

export function loadShoppingListCache(weekStart: string): CachedList | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(weekStart));
    return raw ? (JSON.parse(raw) as CachedList) : null;
  } catch {
    return null;
  }
}
