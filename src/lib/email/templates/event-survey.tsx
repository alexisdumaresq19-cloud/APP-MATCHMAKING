import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type EventSurveyProps = {
  brand: EmailBrand;
  firstName: string;
  eventName: string;
  surveyUrl: string;
};

/** Post-event survey invitation (P2-S3): two minutes, one answer per match. */
export function EventSurveyEmail(props: EventSurveyProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={`Comment se sont passées vos rencontres à ${props.eventName}?`}
      title="Comment se sont passées vos rencontres?"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        Merci d&apos;avoir participé à <strong>{props.eventName}</strong>. Pour chacune des
        entreprises que nous vous avions proposées, dites-nous en deux minutes si une affaire, un
        partenariat ou un suivi en est sorti. Vos réponses restent confidentielles et servent à
        mieux jumeler la prochaine fois.
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.surveyUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Faire mon bilan
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :{" "}
        {props.surveyUrl}
      </Text>
    </EmailLayout>
  );
}
