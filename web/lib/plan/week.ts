// Reine Datumslogik für den Wochenplan, kein DB-/UI-Bezug (testbar ohne Mocks).

const DAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
const MONTH_LABELS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Montag der Woche, die `date` enthält (day-Konvention 0=Montag..6=Sonntag).
export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const weekday = (d.getUTCDay() + 6) % 7; // 0=Montag
  d.setUTCDate(d.getUTCDate() - weekday);
  return d;
}

export function weekStartIso(date: Date = new Date()): string {
  return toIsoDate(mondayOf(date));
}

export function addWeeks(weekStart: string, delta: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return toIsoDate(d);
}

export function dateForDay(weekStart: string, day: number): Date {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + day);
  return d;
}

export function dayLabel(day: number): string {
  return DAY_LABELS[day];
}

export function formatShortDate(date: Date): string {
  return `${date.getUTCDate()}. ${MONTH_LABELS[date.getUTCMonth()]}`;
}

export function formatWeekRange(weekStart: string): string {
  const start = dateForDay(weekStart, 0);
  const end = dateForDay(weekStart, 6);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = sameMonth ? `${start.getUTCDate()}.` : formatShortDate(start);
  return `${startLabel} – ${formatShortDate(end)} ${end.getUTCFullYear()}`;
}
