import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type DeletionRequestedProps = {
  brand: EmailBrand;
  participantName: string;
  participantEmail: string;
  queueUrl: string;
};

/** Sent to the privacy officer when a participant asks for deletion (Law 25: 30 days to answer). */
export function DeletionRequestedEmail(props: DeletionRequestedProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`Demande de suppression : ${props.participantName}`}
      title="Nouvelle demande de suppression"
    >
      <Text style={emailStyles.paragraph}>
        <strong>{props.participantName}</strong> ({props.participantEmail}) demande la suppression
        de ses renseignements personnels. La loi vous laisse 30 jours pour y répondre.
      </Text>
      <Text style={emailStyles.paragraph}>
        Ouvrez la file des demandes pour anonymiser le profil (irréversible) ou refuser la demande
        avec une note.
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.queueUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Traiter la demande
        </Button>
      </Section>
    </EmailLayout>
  );
}
