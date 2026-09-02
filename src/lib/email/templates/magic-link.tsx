import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type MagicLinkProps = {
  brand: EmailBrand;
  name: string;
  loginUrl: string;
  expiresMinutes: number;
};

export function MagicLinkEmail(props: MagicLinkProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview="Votre lien de connexion"
      title="Votre lien de connexion"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.name},</Text>
      <Text style={emailStyles.paragraph}>
        Cliquez sur le bouton ci-dessous pour vous connecter à l'espace organisateur. Ce lien est
        valide pendant {props.expiresMinutes} minutes et ne peut être utilisé qu'une seule fois.
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.loginUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Me connecter
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Si vous n'avez pas demandé ce lien, ignorez ce courriel. Adresse du lien : {props.loginUrl}
      </Text>
    </EmailLayout>
  );
}
