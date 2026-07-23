import type { StoreInfo } from "./types.ts";

const EARTH_RADIUS_KM = 6371;

// ponytail: Haversine-Näherung für Markt-zu-Markt-Strecken statt einer echten
// OSRM-Distanzmatrix zwischen allen Marktpaaren (nur Haushalt→Markt ist eine
// echte Fahrstrecke, siehe supabase/migrations/20260723110000_seed_stores.sql).
// Annahme 30 km/h aus den beobachteten Haushalt→Markt-Verhältnissen in den
// Thüringer Mittelgebirgs-Strecken. Upgrade-Pfad: einmalig eine echte
// OSRM-Distanzmatrix zwischen allen Marktpaaren berechnen und cachen.
const ASSUMED_SPEED_KMH = 30;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) {
      result.push([items[i]!, ...perm]);
    }
  }
  return result;
}

export type Route = { order: StoreInfo[]; distanceKm: number; minutes: number };

// Rundreise Haushalt -> Märkte -> Haushalt, beste Reihenfolge per Brute-Force
// (docs/07-modul-einkaufsplan.md: "≤ 4 Märkte: Brute Force").
export function bestRoute(stores: StoreInfo[]): Route {
  if (stores.length === 0) return { order: [], distanceKm: 0, minutes: 0 };
  if (stores.length === 1) {
    const store = stores[0]!;
    return { order: [store], distanceKm: store.distance_km * 2, minutes: store.drive_min * 2 };
  }

  let best: Route | null = null;
  for (const order of permutations(stores)) {
    let distanceKm = order[0]!.distance_km;
    let minutes = order[0]!.drive_min;
    for (let i = 0; i < order.length - 1; i++) {
      const legKm = haversineKm(order[i]!, order[i + 1]!);
      distanceKm += legKm;
      minutes += (legKm / ASSUMED_SPEED_KMH) * 60;
    }
    distanceKm += order[order.length - 1]!.distance_km;
    minutes += order[order.length - 1]!.drive_min;
    if (!best || distanceKm < best.distanceKm) {
      best = { order, distanceKm, minutes };
    }
  }
  return best!;
}
