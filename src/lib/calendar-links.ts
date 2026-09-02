/** "Add to calendar" links (client guideline, section 3): Google Agenda URL; Apple/Outlook use .ics. */

export type CalendarLinkEvent = {
  title: string;
  start: Date;
  end?: Date | null;
  location?: string | null;
  details?: string | null;
};

const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

function compact(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** One-click "Google Agenda" link; dates are sent in UTC and shown in the viewer's time zone. */
export function googleCalendarUrl(event: CalendarLinkEvent): string {
  const end = event.end ?? new Date(event.start.getTime() + DEFAULT_DURATION_MS);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${compact(event.start)}/${compact(end)}`,
  });
  if (event.location) params.set("location", event.location);
  if (event.details) params.set("details", event.details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
