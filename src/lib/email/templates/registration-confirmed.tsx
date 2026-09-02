import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type RegistrationConfirmedProps = {
  brand: EmailBrand;
  firstName: string;
  eventName: string;
  eventDate: string;
  venue: string | null;
  companyName: string;
  sectorName: string | null;
  offers: string[];
  needs: string[];
  soughtSectorNames?: string[];
  participantUrl: string;
  /** « Ajouter à mon calendrier » (guideline, section 3): .ics for Apple/Outlook, Google Agenda. */
  calendarIcsUrl?: string;
  googleCalendarUrl?: string;
};

export function RegistrationConfirmedEmail(props: RegistrationConfirmedProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`Votre inscription à ${props.eventName} est confirmée`}
      title="Merci, votre inscription est confirmée!"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        Nous avons bien reçu votre inscription à <strong>{props.eventName}</strong>.
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
        <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>Votre profil</Text>
        <Text style={{ ...emailStyles.paragraph, margin: "0 0 4px" }}>
          {props.companyName}
          {props.sectorName ? ` · ${props.sectorName}` : ""}
        </Text>
        <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>
          Vous offrez : {props.offers.join(", ")}
        </Text>
        {props.soughtSectorNames?.length ? (
          <Text style={{ ...emailStyles.muted, margin: "0 0 4px" }}>
            Vous souhaitez rencontrer : {props.soughtSectorNames.join(", ")}
          </Text>
        ) : null}
        {props.needs.length ? (
          <Text style={{ ...emailStyles.muted, margin: 0 }}>
            Vous cherchez : {props.needs.join(", ")}
          </Text>
        ) : null}
      </Section>
      {props.calendarIcsUrl || props.googleCalendarUrl ? (
        <Text style={emailStyles.paragraph}>
          Ajouter à mon calendrier :{" "}
          {props.calendarIcsUrl ? <a href={props.calendarIcsUrl}>Apple, Outlook (.ics)</a> : null}
          {props.calendarIcsUrl && props.googleCalendarUrl ? " · " : null}
          {props.googleCalendarUrl ? <a href={props.googleCalendarUrl}>Google Agenda</a> : null}
        </Text>
      ) : null}
      <Text style={emailStyles.paragraph}>
        Vos jumelages vous seront envoyés avant l'événement. D'ici là, vous pouvez consulter et
        modifier votre profil à tout moment grâce à votre lien personnel :
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.participantUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Accéder à mon espace
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Ce lien est personnel : ne le partagez pas. Si le bouton ne fonctionne pas, copiez cette
        adresse dans votre navigateur : {props.participantUrl}
      </Text>
    </EmailLayout>
  );
}
