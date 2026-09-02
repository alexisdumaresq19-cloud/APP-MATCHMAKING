import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type PublishedMatch = {
  name: string;
  company: string;
  sector: string | null;
  sentences: string[];
};

export type PublishedSeat = {
  round: number;
  time: string;
  table: string;
};

export type MatchesPublishedProps = {
  brand: EmailBrand;
  firstName: string;
  eventName: string;
  eventDate: string;
  venue: string | null;
  matches: PublishedMatch[];
  seats: PublishedSeat[];
  roundCount: number;
  participantUrl: string;
  /** True when this email replaces a previous one (matches or seats changed). */
  isUpdate: boolean;
};

export function MatchesPublishedEmail(props: MatchesPublishedProps) {
  const title = props.isUpdate ? "Vos jumelages ont été mis à jour" : "Vos jumelages sont prêts!";
  return (
    <EmailLayout brand={props.brand} preview={`${title} — ${props.eventName}`} title={title}>
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        Voici les entreprises que nous vous proposons de rencontrer à{" "}
        <strong>{props.eventName}</strong> ({props.eventDate}
        {props.venue ? `, ${props.venue}` : ""}).
      </Text>

      {props.matches.length ? (
        props.matches.map((match) => (
          <Section key={`${match.name}-${match.company}`} style={emailStyles.card}>
            <Text style={{ ...emailStyles.paragraph, margin: "0 0 2px", fontWeight: 600 }}>
              {match.name}
            </Text>
            <Text style={{ ...emailStyles.muted, margin: "0 0 8px" }}>
              {match.company}
              {match.sector ? ` · ${match.sector}` : ""}
            </Text>
            {match.sentences.map((sentence) => (
              <Text key={sentence} style={{ ...emailStyles.paragraph, margin: "0 0 4px" }}>
                {sentence}
              </Text>
            ))}
          </Section>
        ))
      ) : (
        <Section style={emailStyles.card}>
          <Text style={{ ...emailStyles.paragraph, margin: 0 }}>
            Vos jumelages vous seront présentés sur place : votre table réunit des entreprises
            complémentaires à la vôtre.
          </Text>
        </Section>
      )}

      {props.seats.length ? (
        <Section style={emailStyles.card}>
          <Text style={{ ...emailStyles.muted, margin: "0 0 8px" }}>
            {props.roundCount > 1 ? "Vos tables, ronde par ronde" : "Votre table"}
          </Text>
          {props.seats.map((seat) => (
            <Text
              key={seat.round}
              style={{ ...emailStyles.paragraph, margin: "0 0 4px", fontWeight: 600 }}
            >
              {props.roundCount > 1 ? `Ronde ${seat.round} · ${seat.time} · ` : ""}
              {seat.table}
            </Text>
          ))}
        </Section>
      ) : null}

      <Text style={emailStyles.paragraph}>
        Tout est aussi dans votre espace personnel, avec les détails de chaque entreprise :
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.participantUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Voir mes jumelages
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Ce lien est personnel : ne le partagez pas. Si le bouton ne fonctionne pas, copiez cette
        adresse dans votre navigateur : {props.participantUrl}
      </Text>
    </EmailLayout>
  );
}
