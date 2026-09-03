import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { OUTCOME_LABELS, OUTCOMES } from "@/lib/feedback";
import type { SurveySummary as Summary } from "@/server/services/feedback";

const OUTCOME_CLASS: Record<string, string> = {
  DEAL: "bg-green-100 text-green-900",
  FOLLOW_UP: "bg-brand/10 text-brand",
  NO_FIT: "bg-muted text-muted-foreground",
  NOT_MET: "bg-amber-100 text-amber-900",
};

/** « Bilan des rencontres » on a completed event (P2-S3, D-38). */
export function SurveySummary({ summary }: { summary: Summary }) {
  const deals = summary.byOutcome.DEAL;
  const followUps = summary.byOutcome.FOLLOW_UP;
  const rated = summary.rated;
  const percent = (n: number) => (rated ? Math.round((100 * n) / rated) : 0);
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Bilan des rencontres</h2>
        <p className="text-sm text-muted-foreground">
          {summary.sent
            ? `${summary.sent} courriel${summary.sent > 1 ? "s" : ""} envoyé${summary.sent > 1 ? "s" : ""}, ${summary.responses} réponse${summary.responses > 1 ? "s" : ""}.`
            : "Envoyez le bilan pour savoir ce que les rencontres ont donné."}{" "}
          Les réponses nourrissent les suggestions de Réglages › Affinités.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon="users-round"
          label="Participants ayant répondu"
          value={summary.responses}
          hint={`sur ${summary.eligible} sondé${summary.eligible > 1 ? "s" : ""}`}
        />
        <StatCard
          icon="heart-handshake"
          label="Affaires ou partenariats"
          value={deals}
          hint={`${percent(deals)} % des rencontres évaluées`}
        />
        <StatCard
          icon="calendar-check"
          label="Suivis prévus"
          value={followUps}
          hint={`${percent(followUps)} % des rencontres évaluées`}
        />
      </div>
      {rated ? (
        <ul className="flex flex-wrap gap-2 text-sm">
          {OUTCOMES.map((outcome) => (
            <li key={outcome}>
              <Badge variant="outline" className={OUTCOME_CLASS[outcome]}>
                {OUTCOME_LABELS[outcome]} : {summary.byOutcome[outcome]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {summary.comments.length ? (
        <ul className="divide-y rounded-lg border bg-card text-sm">
          {summary.comments.map((entry, index) => (
            <li key={index} className="space-y-1 px-4 py-3">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{entry.company}</span> à propos de{" "}
                {entry.partner} ·{" "}
                <Badge variant="outline" className={OUTCOME_CLASS[entry.outcome]}>
                  {OUTCOME_LABELS[entry.outcome]}
                </Badge>
              </p>
              <p className="whitespace-pre-line">{entry.comment}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
