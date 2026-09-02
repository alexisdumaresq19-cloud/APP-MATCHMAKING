export const DEFAULT_TIMEZONE = "America/Toronto";
export const LOCALE = "fr-CA";

const DAY_MS = 24 * 60 * 60 * 1000;

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function partsIn(date: Date, timeZone: string): Parts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) === 24 ? 0 : Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset of `timeZone` at `date`, in minutes east of UTC (e.g. -240 for EDT). */
export function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Parses an `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") expressed in `timeZone`. */
export function fromLocalInput(value: string, timeZone = DEFAULT_TIMEZONE): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
  if (Number.isNaN(naive)) return null;
  let guess = naive - timezoneOffsetMinutes(new Date(naive), timeZone) * 60_000;
  guess = naive - timezoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

/** Formats a Date for an `<input type="datetime-local">` in `timeZone`. */
export function toLocalInput(date: Date | null | undefined, timeZone = DEFAULT_TIMEZONE): string {
  if (!date) return "";
  const p = partsIn(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export type DateStyle = "full" | "long" | "date" | "time" | "short";

export function formatDate(
  date: Date | null | undefined,
  timeZone = DEFAULT_TIMEZONE,
  style: DateStyle = "long",
): string {
  if (!date) return "";
  const options: Intl.DateTimeFormatOptions = { timeZone };
  switch (style) {
    case "full":
      options.dateStyle = "full";
      options.timeStyle = "short";
      break;
    case "long":
      options.dateStyle = "long";
      options.timeStyle = "short";
      break;
    case "date":
      options.dateStyle = "long";
      break;
    case "time":
      options.timeStyle = "short";
      break;
    case "short":
      options.dateStyle = "short";
      options.timeStyle = "short";
      break;
  }
  return new Intl.DateTimeFormat(LOCALE, options).format(date);
}

/** "mercredi 15 octobre 2026, de 17 h 30 à 20 h 30" or "… à 17 h 30". */
export function formatDateRange(
  start: Date,
  end: Date | null | undefined,
  timeZone = DEFAULT_TIMEZONE,
): string {
  const dayPart = new Intl.DateTimeFormat(LOCALE, { timeZone, dateStyle: "full" }).format(start);
  const startTime = formatDate(start, timeZone, "time");
  if (!end) return `${dayPart}, à ${startTime}`;
  const sameDay =
    toLocalInput(start, timeZone).slice(0, 10) === toLocalInput(end, timeZone).slice(0, 10);
  const endTime = formatDate(end, timeZone, "time");
  if (sameDay) return `${dayPart}, de ${startTime} à ${endTime}`;
  return `Du ${formatDate(start, timeZone, "long")} au ${formatDate(end, timeZone, "long")}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function isPast(date: Date | null | undefined, now = new Date()): boolean {
  return !!date && date.getTime() < now.getTime();
}
