import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type RetentionNoticeProps = {
  brand: EmailBrand;
  firstName: string;
  organizationName: string;
  deleteAfterLabel: string;
  keepUrl: string;
};

/** 30-day notice before an inactive profile is anonymized (P2-S3, D-39). */
export function RetentionNoticeEmail(props: RetentionNoticeProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview="Votre profil sera supprimé dans 30 jours, sauf si vous souhaitez le garder"
      title="Votre profil sera supprimé dans 30 jours"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        Cela fait plus de deux ans que vous n&apos;avez pas participé à un événement de{" "}
        {props.organizationName}. Conformément à notre politique de conservation, votre profil sera
        anonymisé le <strong>{props.deleteAfterLabel}</strong> : vos coordonnées et votre
        description seront effacées.
      </Text>
      <Text style={emailStyles.paragraph}>
        Vous souhaitez rester dans le réseau et recevoir les prochaines invitations? Un clic suffit
        :
      </Text>
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.keepUrl} style={emailStyles.button(props.brand.primaryColor)}>
          Conserver mon profil
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Si vous ne faites rien, la suppression se fera automatiquement et vous recevrez une
        confirmation. Si le bouton ne fonctionne pas, copiez cette adresse dans votre navigateur :{" "}
        {props.keepUrl}
      </Text>
    </EmailLayout>
  );
}
