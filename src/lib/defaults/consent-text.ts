/** Annex A — default Law 25 notice. Placeholders are filled per organization. */
export function defaultConsentText(input: {
  organizationName: string;
  privacyOfficer: string;
  privacyEmail: string;
}): string {
  return `Avis de collecte de renseignements personnels

Les renseignements que vous fournissez dans ce formulaire (nom, entreprise, coordonnées, secteur d'activité, services offerts et besoins) sont recueillis par ${input.organizationName} afin de gérer votre inscription à l'événement et de vous jumeler avec d'autres participants dont les activités sont complémentaires aux vôtres. Votre nom, votre entreprise, votre secteur et vos besoins seront visibles par les participants avec lesquels vous serez jumelé.

Ces renseignements sont hébergés et traités pour le compte de ${input.organizationName} par AD Création (Gaspé, Québec), fournisseur de la plateforme, qui applique des mesures de sécurité raisonnables. Ils sont conservés tant que votre compte est actif et pour la durée nécessaire aux fins ci-dessus.

Vous pouvez en tout temps consulter, rectifier ou demander la suppression de vos renseignements en écrivant à ${input.privacyEmail}. Responsable de la protection des renseignements personnels : ${input.privacyOfficer} (${input.privacyEmail}).`;
}
