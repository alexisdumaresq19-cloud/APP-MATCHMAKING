import type { Event, EventRegistration } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { describeMatch, type MatchReasons } from "@/lib/matching";
import { formatPhone } from "@/lib/normalize";
import { roundStartsAt, tableName } from "@/lib/rounds";

export type ParticipantMatchCard = {
  matchId: string;
  name: string;
  jobTitle: string | null;
  company: string;
  sector: string | null;
  region: string | null;
  city: string | null;
  description: string | null;
  website: string | null;
  offers: string[];
  needs: string[];
  sentences: string[];
  /** Only once both people have checked in at the event (section 8). */
  contact: { email: string; phone: string } | null;
};

export type ParticipantSeat = {
  round: number;
  startsAt: Date;
  table: string;
  tableNumber: number;
  tablemates: { name: string; company: string }[];
};

export type ParticipantEventView = {
  matches: ParticipantMatchCard[];
  seats: ParticipantSeat[];
  published: boolean;
};

/** What one registrant sees on their event page: their matches and their seats (S3-05). */
export async function getParticipantEventView(
  registration: Pick<EventRegistration, "id" | "status">,
  event: Pick<Event, "id" | "publishedAt" | "startsAt" | "roundMinutes" | "roundCount">,
): Promise<ParticipantEventView> {
  const published = Boolean(event.publishedAt);
  if (!published) return { matches: [], seats: [], published };

  const [matches, assignments] = await Promise.all([
    prisma.match.findMany({
      where: {
        eventId: event.id,
        status: { not: "EXCLUDED" },
        OR: [{ aId: registration.id }, { bId: registration.id }],
      },
      include: {
        a: { include: { participant: { include: { sector: true } } } },
        b: { include: { participant: { include: { sector: true } } } },
      },
      orderBy: { score: "desc" },
    }),
    prisma.tableAssignment.findMany({
      where: { registrationId: registration.id },
      include: {
        table: {
          include: {
            assignments: {
              include: { registration: { include: { participant: true } } },
            },
          },
        },
      },
      orderBy: { round: "asc" },
    }),
  ]);

  const viewerCheckedIn = registration.status === "CHECKED_IN";
  const cards: ParticipantMatchCard[] = matches
    .map((match) => {
      const isA = match.aId === registration.id;
      const other = isA ? match.b : match.a;
      if (other.status === "CANCELLED" || other.participant.deletedAt) return null;
      const p = other.participant;
      const showContact = viewerCheckedIn && other.status === "CHECKED_IN";
      return {
        matchId: match.id,
        name: `${p.firstName} ${p.lastName}`,
        jobTitle: p.jobTitle,
        company: p.companyName,
        sector: p.sector?.name ?? null,
        region: p.region,
        city: p.city,
        description: p.description,
        website: p.website,
        offers: other.offersSnapshot.length ? other.offersSnapshot : p.offers,
        needs: other.needsSnapshot.length ? other.needsSnapshot : p.needs,
        sentences: describeMatch(match.reasons as unknown as MatchReasons, isA ? "a" : "b"),
        contact: showContact ? { email: p.email, phone: formatPhone(p.phone) } : null,
      };
    })
    .filter((card): card is ParticipantMatchCard => card !== null);

  const seats: ParticipantSeat[] = assignments
    .filter((a) => a.round <= event.roundCount)
    .map((assignment) => ({
      round: assignment.round,
      startsAt: roundStartsAt(event, assignment.round),
      table: tableName(assignment.table),
      tableNumber: assignment.table.number,
      tablemates: assignment.table.assignments
        .filter(
          (other) =>
            other.round === assignment.round &&
            other.registrationId !== registration.id &&
            other.registration.status !== "CANCELLED",
        )
        .map((other) => ({
          name: `${other.registration.participant.firstName} ${other.registration.participant.lastName}`,
          company: other.registration.participant.companyName,
        }))
        .sort((x, y) => x.name.localeCompare(y.name, "fr")),
    }));

  return { matches: cards, seats, published };
}
