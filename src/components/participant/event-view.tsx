import { ExternalLinkIcon, MailIcon, PhoneIcon } from "lucide-react";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { ContactActions } from "@/components/participant/contact-actions";
import { formatDate } from "@/lib/dates";
import type { ParticipantMatchCard, ParticipantSeat } from "@/server/queries/participant";

/** « Mes jumelages » : LinkedIn-style cards with the plain-French reasons (docs/REFERENCES_DESIGN). */
export function MatchCards({
  matches,
  token,
  eventId,
  contactIds,
}: {
  matches: ParticipantMatchCard[];
  token: string;
  eventId: string;
  contactIds: Set<string>;
}) {
  if (matches.length === 0) {
    return (
      <EmptyState
        icon="handshake"
        size="sm"
        title="Vos jumelages arrivent"
        description="Votre table réunit des entreprises complémentaires à la vôtre; les présentations se feront sur place."
      />
    );
  }
  return (
    <ul className="space-y-4">
      {matches.map((match, index) => (
        <ScrollReveal key={match.matchId} delay={Math.min(index, 4) * 0.08} amount={0.1}>
          <li className="al-group rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-base font-semibold text-brand">
                {match.name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase() ?? "")
                  .join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg leading-tight font-semibold">{match.name}</p>
                <p className="text-base text-muted-foreground">
                  {match.jobTitle ? `${match.jobTitle} · ` : ""}
                  {match.company}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[match.sector, match.city ?? match.region].filter(Boolean).join(" · ")}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-brand/5 p-3">
              <p className="mb-1 text-xs font-semibold tracking-wide text-brand uppercase">
                Pourquoi vous
              </p>
              <ul className="space-y-1 text-base">
                {match.sentences.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            </div>

            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {match.offers.length ? (
                <div>
                  <dt className="font-semibold">Ce qu'ils offrent</dt>
                  <dd className="text-muted-foreground">{match.offers.join(", ")}</dd>
                </div>
              ) : null}
              {match.needs.length ? (
                <div>
                  <dt className="font-semibold">Ce qu'ils cherchent</dt>
                  <dd className="text-muted-foreground">{match.needs.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
            {match.description ? (
              <p className="mt-3 text-sm leading-relaxed text-foreground/90">{match.description}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {match.website ? (
                <a
                  href={match.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand underline-offset-4 hover:underline"
                >
                  <ExternalLinkIcon className="size-4" aria-hidden="true" />
                  Site web
                </a>
              ) : null}
              {match.contact ? (
                <>
                  <a
                    href={`mailto:${match.contact.email}`}
                    className="inline-flex items-center gap-1 text-brand underline-offset-4 hover:underline"
                  >
                    <MailIcon className="size-4" aria-hidden="true" />
                    {match.contact.email}
                  </a>
                  {match.contact.phone ? (
                    <a
                      href={`tel:${match.contact.phone}`}
                      className="inline-flex items-center gap-1 text-brand underline-offset-4 hover:underline"
                    >
                      <PhoneIcon className="size-4" aria-hidden="true" />
                      {match.contact.phone}
                    </a>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="mt-4 border-t pt-3">
              <ContactActions
                token={token}
                participantId={match.participantId}
                eventId={eventId}
                isContact={contactIds.has(match.participantId)}
                compact
              />
            </div>
          </li>
        </ScrollReveal>
      ))}
    </ul>
  );
}

/** « Ma table » : one big card per round, readable standing in a noisy room (StubHub pattern). */
export function SeatCards({
  seats,
  roundCount,
  timezone,
}: {
  seats: ParticipantSeat[];
  roundCount: number;
  timezone: string;
}) {
  if (seats.length === 0) {
    return (
      <EmptyState
        icon="armchair"
        size="sm"
        title="Votre table sera indiquée ici"
        description="L'organisatrice finalise le plan de salle. Vous recevrez un courriel."
      />
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {seats.map((seat) => (
        <li
          key={seat.round}
          className="al-group rounded-xl border-2 border-brand/30 bg-card p-4 text-center shadow-sm"
        >
          {roundCount > 1 ? (
            <p className="text-sm font-medium text-muted-foreground">
              Ronde {seat.round} · {formatDate(seat.startsAt, timezone, "time")}
            </p>
          ) : null}
          <p className="mt-1 text-4xl font-bold tracking-tight text-brand">{seat.table}</p>
          <div className="mt-2 flex justify-center">
            <AnimatedIcon name="armchair" size={22} />
          </div>
          {seat.tablemates.length ? (
            <div className="mt-3 text-left text-sm">
              <p className="font-semibold">À votre table</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {seat.tablemates.map((mate) => (
                  <li key={`${mate.name}-${mate.company}`}>
                    {mate.name} <span className="opacity-80">· {mate.company}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
