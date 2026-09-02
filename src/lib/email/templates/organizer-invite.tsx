import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type OrganizerInviteProps = {
  brand: EmailBrand;
  name: string;
  invitedBy: string;
  role: "OWNER" | "STAFF";
  acceptUrl: string;
  expiresDays: number;
};

export function OrganizerInviteEmail(props: OrganizerInviteProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`${props.invitedBy} vous invite à gérer ${props.brand.organizationName}`}
      title="Vous êtes invité à rejoindre l'équipe"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.name},</Text>
      <Text style={emailStyles.paragraph}>
        {props.invitedBy} vous donne accès à l'espace organisateur de{" "}
        <strong>{props.brand.organizationName}</strong> sur {props.brand.platformName}
        {props.role === "OWNER" ? " avec tous les droits (propriétaire)" : " (membre de l'équipe)"}.
        Choisissez votre mot de passe pour activer votre compte. Ce lien est valide pendant{" "}
        {props.expiresDays} jours.
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.acceptUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Activer mon compte
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Si vous n'attendiez pas cette invitation, ignorez ce courriel. Adresse du lien :{" "}
        {props.acceptUrl}
      </Text>
    </EmailLayout>
  );
}
