import { Button, Section, Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type ExistingProfileLinkProps = {
  brand: EmailBrand;
  firstName: string;
  eventName: string;
  alreadyRegistered: boolean;
  actionUrl: string;
};

export function ExistingProfileLinkEmail(props: ExistingProfileLinkProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview={
        props.alreadyRegistered
          ? `Vous êtes déjà inscrit à ${props.eventName}`
          : `Inscrivez-vous à ${props.eventName} en un clic`
      }
      title={
        props.alreadyRegistered ? "Vous êtes déjà inscrit!" : "Vous avez déjà un profil chez nous"
      }
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      {props.alreadyRegistered ? (
        <Text style={emailStyles.paragraph}>
          Bonne nouvelle : vous êtes déjà inscrit à <strong>{props.eventName}</strong>. Voici votre
          lien personnel pour consulter votre profil, vos jumelages et votre table.
        </Text>
      ) : (
        <Text style={emailStyles.paragraph}>
          Vous avez déjà un profil dans notre plateforme. Pas besoin de tout ressaisir : cliquez
          ci-dessous pour vous inscrire à <strong>{props.eventName}</strong> avec votre profil
          existant. Vous pourrez le mettre à jour au passage.
        </Text>
      )}
      <Section style={{ textAlign: "center", margin: "8px 0 24px" }}>
        <Button href={props.actionUrl} style={emailStyles.button(props.brand.primaryColor)}>
          {props.alreadyRegistered ? "Accéder à mon espace" : "M'inscrire avec mon profil"}
        </Button>
      </Section>
      <Text style={emailStyles.muted}>
        Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel. Si le
        bouton ne fonctionne pas, copiez cette adresse dans votre navigateur : {props.actionUrl}
      </Text>
    </EmailLayout>
  );
}
