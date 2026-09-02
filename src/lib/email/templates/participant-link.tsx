import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type ParticipantLinkProps = {
  brand: EmailBrand;
  firstName: string;
  participantUrl: string;
};

export function ParticipantLinkEmail(props: ParticipantLinkProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview="Votre lien d'accès personnel"
      title="Votre lien d'accès"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        Voici votre nouveau lien personnel pour accéder à votre profil, à vos événements, à vos
        jumelages et à votre table.
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.participantUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Accéder à mon espace
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Ce lien est personnel : ne le partagez pas. Si vous n'avez pas demandé ce lien, ignorez ce
        courriel. Adresse du lien : {props.participantUrl}
      </Text>
    </EmailLayout>
  );
}
