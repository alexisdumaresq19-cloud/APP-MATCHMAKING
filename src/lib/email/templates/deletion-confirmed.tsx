import { Text } from "@react-email/components";
import { EmailLayout, emailStyles, type EmailBrand } from "./layout";

export type DeletionConfirmedProps = {
  brand: EmailBrand;
  firstName: string;
  privacyEmail: string;
};

/** Sent to the participant's address right before it is anonymized (Law 25, section 8). */
export function DeletionConfirmedEmail(props: DeletionConfirmedProps) {
  return (
    <EmailLayout
      brand={props.brand}
      preview="Vos renseignements personnels ont été supprimés"
      title="Vos renseignements ont été supprimés"
    >
      <Text style={emailStyles.paragraph}>Bonjour {props.firstName},</Text>
      <Text style={emailStyles.paragraph}>
        Comme vous l'avez demandé, {props.brand.organizationName} a supprimé vos renseignements
        personnels de {props.brand.platformName} : nom, coordonnées, entreprise, profil et
        préférences de jumelage. Vos liens d'accès personnels ne fonctionnent plus.
      </Text>
      <Text style={emailStyles.paragraph}>
        Seules des données non identifiantes (par exemple le nombre de participants à un événement)
        sont conservées, comme la loi le permet. Ceci est le dernier courriel que vous recevrez de
        notre part.
      </Text>
      <Text style={emailStyles.muted}>
        Des questions? Écrivez au responsable de la protection des renseignements personnels :{" "}
        {props.privacyEmail}
      </Text>
    </EmailLayout>
  );
}
