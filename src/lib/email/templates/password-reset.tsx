import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type PasswordResetProps = {
  brand: EmailBrand;
  name: string;
  resetUrl: string;
  expiresMinutes: number;
};

export function PasswordResetEmail(props: PasswordResetProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview="Réinitialisation de votre mot de passe"
      title="Réinitialiser votre mot de passe"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.name},</Text>
      <Text style={emailStyles.paragraph}>
        Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous pour
        en choisir un nouveau. Ce lien est valide pendant {props.expiresMinutes} minutes.
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.resetUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Choisir un nouveau mot de passe
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Si vous n'avez pas fait cette demande, ignorez ce courriel : votre mot de passe restera
        inchangé. Adresse du lien : {props.resetUrl}
      </Text>
    </EmailLayout>
  );
}
