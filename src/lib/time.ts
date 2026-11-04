/**
 * Time helpers. Items store wall-clock times in the household timezone:
 *   all-day:  "YYYY-MM-DD"
 *   timed:    "YYYY-MM-DDTHH:mm"
 * These helpers convert between that representation, UTC instants and display strings
 * using only Intl (no tz database dependency).
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(date)) p[part.type] = part.value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: p.weekday,
  };
}

/** "YYYY-MM-DD" for an instant in tz. */
export function zonedDate(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "YYYY-MM-DDTHH:mm" for an instant in tz. */
export function zonedDateTime(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Convert a wall-clock "YYYY-MM-DDTHH:mm" in tz to a UTC Date. */
export function wallToUtc(wall: string, tz: string): Date {
  const [d, t = "00:00"] = wall.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, hh, mm);
  // Two passes handle DST boundaries.
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(ts), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts = ts + (guess - asUtc);
  }
  return new Date(ts);
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function dateOf(start: string): string {
  return start.slice(0, 10);
}

export function timeOf(start: string): string | null {
  return start.length > 10 ? start.slice(11, 16) : null;
}

export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function monthName(m: number, long = false) {
  return (long ? MONTHS_LONG : MONTHS)[m - 1];
}
export function dayName(dow: number, long = false) {
  return (long ? DAYS_LONG : DAYS)[dow];
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${pad(m)}${suffix}`;
}

/** "Fri 14 Nov" */
export function formatDay(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${dayName(weekdayOf(ymd))} ${d} ${monthName(m)}`;
}

/** Relative label against today: "Today", "Tomorrow", "Fri 14 Nov". */
export function relativeDay(ymd: string, today: string): string {
  if (ymd === today) return "Today";
  if (ymd === addDays(today, 1)) return "Tomorrow";
  if (ymd === addDays(today, -1)) return "Yesterday";
  return formatDay(ymd);
}

export function formatWhen(start: string, end: string | null, allDay: boolean, today?: string): string {
  const d = dateOf(start);
  const dayLabel = today ? relativeDay(d, today) : formatDay(d);
  if (allDay) {
    if (end && dateOf(end) !== d) return `${dayLabel} – ${formatDay(dateOf(end))}`;
    return dayLabel;
  }
  const t = timeOf(start);
  const et = end ? timeOf(end) : null;
  return `${dayLabel}, ${t ? formatTime(t) : ""}${et ? `–${formatTime(et)}` : ""}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
