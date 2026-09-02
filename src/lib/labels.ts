import type { EventStatus, RegistrationSource, RegistrationStatus } from "@prisma/client";

export function registrationStatusLabel(status: RegistrationStatus): string {
  switch (status) {
    case "REGISTERED":
      return "Inscrit";
    case "CONFIRMED":
      return "Confirmé";
    case "CHECKED_IN":
      return "Présent";
    case "CANCELLED":
      return "Annulé";
    case "NO_SHOW":
      return "Absent";
  }
}

export function registrationSourceLabel(source: RegistrationSource): string {
  switch (source) {
    case "PLATFORM":
      return "En ligne";
    case "MANUAL":
      return "Ajout manuel";
    case "IMPORT":
      return "Importation";
  }
}

export function eventStatusLabel(status: EventStatus): string {
  switch (status) {
    case "DRAFT":
      return "Brouillon";
    case "OPEN":
      return "Inscriptions ouvertes";
    case "CLOSED":
      return "Inscriptions fermées";
    case "MATCHED":
      return "Jumelage calculé";
    case "PUBLISHED":
      return "Jumelages publiés";
    case "COMPLETED":
      return "Terminé";
    case "ARCHIVED":
      return "Archivé";
  }
}

export const REGISTRATION_STATUSES: RegistrationStatus[] = [
  "REGISTERED",
  "CONFIRMED",
  "CHECKED_IN",
  "CANCELLED",
  "NO_SHOW",
];

export const EVENT_STATUSES: EventStatus[] = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "MATCHED",
  "PUBLISHED",
  "COMPLETED",
  "ARCHIVED",
];
