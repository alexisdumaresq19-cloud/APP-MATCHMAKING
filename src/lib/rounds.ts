/** Pure helpers about meeting rounds and tables (shared by admin, participant and emails). */

export const DEFAULT_ROUND_MINUTES = 20;

/** Start of a round: round 1 at the event start, then one after the other. */
export function roundStartsAt(
  event: { startsAt: Date; roundMinutes: number | null },
  round: number,
): Date {
  const minutes = event.roundMinutes ?? DEFAULT_ROUND_MINUTES;
  return new Date(event.startsAt.getTime() + (round - 1) * minutes * 60_000);
}

export function roundLabel(round: number, total: number): string {
  return total > 1 ? `Ronde ${round} de ${total}` : "Placement";
}

/** "Table 4" or the organizer's label ("Salon bleu"). */
export function tableName(table: { number: number; label: string | null }): string {
  return table.label?.trim() ? table.label.trim() : `Table ${table.number}`;
}

/** Stable seed for the seating algorithm of an event (same event → same plan, unless data changed). */
export function seatingSeed(eventId: string): number {
  let hash = 7;
  for (const char of eventId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash || 1;
}
