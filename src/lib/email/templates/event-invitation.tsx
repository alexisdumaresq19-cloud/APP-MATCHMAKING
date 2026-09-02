import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type EventInvitationProps = {
  brand: EmailBrand;
  firstName: string;
  organizationName: string;
  eventName: string;
  eventDate: string;
  venue: string | null;
  spotsLeft: number | null;
  /** One-click registration with the existing profile. */
  actionUrl: string;
  /** Public page of the event. */
  eventUrl: string;
  /** « Ne plus recevoir d'invitations » (anti-spam law: one-click opt-out in every invitation). */
  optOutUrl: string;
};

export function EventInvitationEmail(props: EventInvitationProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`${props.organizationName} vous invite à ${props.eventName}`}
      title={`Vous êtes invité à ${props.eventName}`}
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        {props.organizationName} organise <strong>{props.eventName}</strong> et aimerait vous y
        retrouver. Comme vous avez déjà un profil chez nous, l&apos;inscription se fait en un clic :
        nous vous jumellerons avec des entreprises complémentaires à la vôtre.
      </Text>
      <Section style={emailStyles.card}>
        <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>Date</Text>
        <Text style={{ ...emailStyles.paragraph, margin: "0 0 12px" }}>{props.eventDate}</Text>
        {props.venue ? (
          <>
            <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>Lieu</Text>
            <Text style={{ ...emailStyles.paragraph, margin: "0 0 12px" }}>{props.venue}</Text>
          </>
        ) : null}
        {props.spotsLeft !== null ? (
          <Text style={{ ...emailStyles.muted, margin: 0 }}>
            {props.spotsLeft === 1 ? "Il reste 1 place." : `Il reste ${props.spotsLeft} places.`}
          </Text>
        ) : null}
      </Section>
      <Section style={{ textAlign: "center", margin: "8px 0 16px" }}>
        <Button href={props.actionUrl} style={emailStyles.button(props.brand.primaryColor)}>
          M&apos;inscrire en un clic
        </Button>
      </Section>
      <Text style={{ ...emailStyles.muted, textAlign: "center" }}>
        <a href={props.eventUrl}>Voir la page de l&apos;événement</a>
      </Text>
      <Text style={emailStyles.muted}>
        Vous recevez ce courriel parce que vous avez déjà participé à un événement de{" "}
        {props.organizationName}. Pour ne plus recevoir d&apos;invitations :{" "}
        <a href={props.optOutUrl}>ne plus recevoir d&apos;invitations</a>. Si le bouton ne
        fonctionne pas, copiez cette adresse dans votre navigateur : {props.actionUrl}
      </Text>
    </EmailLayout>
  );
}
