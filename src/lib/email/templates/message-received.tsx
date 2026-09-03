import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type MessageReceivedProps = {
  brand: EmailBrand;
  firstName: string;
  fromCompany: string;
  preview: string;
  threadUrl: string;
};

/** « Nouveau message » notification (at most one per hour per thread, Phase 2). */
export function MessageReceivedEmail(props: MessageReceivedProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`${props.fromCompany} vous a écrit`}
      title={`Nouveau message de ${props.fromCompany}`}
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        <strong>{props.fromCompany}</strong> vous a écrit dans votre espace{" "}
        {props.brand.platformName}:
      </Text>
      <Section style={emailStyles.card}>
        <Text style={{ ...emailStyles.paragraph, margin: 0, whiteSpace: "pre-line" }}>
          {props.preview}
        </Text>
      </Section>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.threadUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Répondre
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Les échanges restent dans la plateforme : votre courriel et votre téléphone ne sont pas
        transmis. Vous pouvez fermer une conversation à tout moment depuis le fil de discussion.
      </Text>
    </EmailLayout>
  );
}
