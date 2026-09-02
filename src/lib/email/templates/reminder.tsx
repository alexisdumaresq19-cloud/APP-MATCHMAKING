import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";
import type { PublishedSeat } from "./matches-published";

export type ReminderProps = {
  brand: EmailBrand;
  firstName: string;
  eventName: string;
  eventDate: string;
  venue: string | null;
  mapsUrl: string | null;
  seats: PublishedSeat[];
  roundCount: number;
  matchCount: number;
  participantUrl: string;
};

export function ReminderEmail(props: ReminderProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`C'est demain : ${props.eventName}`}
      title="C'est bientôt : on vous attend!"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        Petit rappel pour <strong>{props.eventName}</strong>. Voici l'essentiel à retenir.
      </Text>
      <Section style={emailStyles.card}>
        <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>Quand</Text>
        <Text style={{ ...emailStyles.paragraph, margin: "0 0 12px" }}>{props.eventDate}</Text>
        {props.venue ? (
          <>
            <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>Où</Text>
            <Text style={{ ...emailStyles.paragraph, margin: "0 0 12px" }}>
              {props.venue}
              {props.mapsUrl ? (
                <>
                  {" "}
                  ·{" "}
                  <a href={props.mapsUrl} style={{ color: props.brand.primaryColor }}>
                    Itinéraire
                  </a>
                </>
              ) : null}
            </Text>
          </>
        ) : null}
        {props.seats.length ? (
          <>
            <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>
              {props.roundCount > 1 ? "Vos tables" : "Votre table"}
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
          </>
        ) : null}
      </Section>
      <Text style={emailStyles.paragraph}>
        {props.matchCount > 0
          ? `Vous avez ${props.matchCount} jumelage${props.matchCount > 1 ? "s" : ""} à découvrir dans votre espace personnel. Relisez-les avant d'arriver : c'est votre meilleur brise-glace.`
          : "Consultez votre espace personnel avant d'arriver : vous y trouverez tout ce qu'il faut."}
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.participantUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Ouvrir mon espace
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Ce lien est personnel : ne le partagez pas. À très bientôt!
      </Text>
    </EmailLayout>
  );
}
