import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type ConsentPendingProps = {
  brand: EmailBrand;
  firstName: string;
  eventName: string;
  eventDate: string;
  participantUrl: string;
};

export function ConsentPendingEmail(props: ConsentPendingProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`Confirmez votre inscription à ${props.eventName}`}
      title="Confirmez votre inscription"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        {props.brand.organizationName} vous a inscrit à <strong>{props.eventName}</strong> (
        {props.eventDate}). Pour que nous puissions vous jumeler avec d'autres participants, nous
        avons besoin de votre consentement à l'utilisation de vos renseignements. Cela ne prend
        qu'une minute.
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.participantUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Confirmer et lire l'avis de confidentialité
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Vous pourrez aussi vérifier et compléter votre profil (secteur, offres, besoins). Adresse du
        lien : {props.participantUrl}
      </Text>
    </EmailLayout>
  );
}
