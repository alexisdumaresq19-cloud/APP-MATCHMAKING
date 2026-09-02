/** Time zones an organizer can pick (Canada first; the rest of the world through "Autre"). */
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Toronto", label: "Québec, Ontario (heure de l'Est)" },
  { value: "America/Halifax", label: "Maritimes (heure de l'Atlantique)" },
  { value: "America/St_Johns", label: "Terre-Neuve" },
  { value: "America/Winnipeg", label: "Manitoba (heure du Centre)" },
  { value: "America/Regina", label: "Saskatchewan" },
  { value: "America/Edmonton", label: "Alberta (heure des Rocheuses)" },
  { value: "America/Vancouver", label: "Colombie-Britannique (heure du Pacifique)" },
  { value: "America/Moncton", label: "Nouveau-Brunswick" },
  { value: "Europe/Paris", label: "France, Belgique, Suisse" },
];

export function isKnownTimezone(value: string): boolean {
  return TIMEZONES.some((tz) => tz.value === value);
}
