/** Initial sectors for a new organization (to confirm with the client). */
export const DEFAULT_SECTORS: { name: string; slug: string }[] = [
  { name: "Garderie / petite enfance", slug: "garderie-petite-enfance" },
  { name: "Entretien ménager et commercial", slug: "entretien-menager-commercial" },
  { name: "Ressources éducatives", slug: "ressources-educatives" },
  { name: "Restauration et traiteur", slug: "restauration-traiteur" },
  { name: "Construction et rénovation", slug: "construction-renovation" },
  { name: "Immobilier", slug: "immobilier" },
  { name: "Services financiers et assurance", slug: "services-financiers-assurance" },
  { name: "Comptabilité et fiscalité", slug: "comptabilite-fiscalite" },
  { name: "Juridique", slug: "juridique" },
  { name: "Marketing et communications", slug: "marketing-communications" },
  { name: "Technologies et web", slug: "technologies-web" },
  { name: "Santé et bien-être", slug: "sante-bien-etre" },
  { name: "Commerce de détail", slug: "commerce-detail" },
  { name: "Transport et logistique", slug: "transport-logistique" },
  { name: "Ressources humaines et formation", slug: "ressources-humaines-formation" },
  { name: "Événementiel", slug: "evenementiel" },
  { name: "Photographie et vidéo", slug: "photographie-video" },
  // From the client's guideline examples (garderie → animation, traiteur, formateurs; restaurant →
  // producteurs locaux, livraison, marketing, maintenance; cabinet d'avocats → secrétariat…).
  { name: "Animation et loisirs", slug: "animation-loisirs" },
  { name: "Agriculture et producteurs locaux", slug: "agriculture-producteurs-locaux" },
  { name: "Services administratifs et traduction", slug: "services-administratifs-traduction" },
  { name: "Entretien et réparation d'équipements", slug: "entretien-reparation-equipements" },
  { name: "Autre", slug: "autre" },
];

/** Plausible affinity scores between complementary sectors (0..100). Unlisted pairs default to 40–50. */
export const DEFAULT_AFFINITIES: [string, string, number][] = [
  ["garderie-petite-enfance", "entretien-menager-commercial", 85],
  ["garderie-petite-enfance", "ressources-educatives", 90],
  ["garderie-petite-enfance", "sante-bien-etre", 60],
  ["garderie-petite-enfance", "restauration-traiteur", 70],
  ["garderie-petite-enfance", "animation-loisirs", 85],
  ["garderie-petite-enfance", "ressources-humaines-formation", 65],
  ["restauration-traiteur", "agriculture-producteurs-locaux", 85],
  ["restauration-traiteur", "transport-logistique", 70],
  ["restauration-traiteur", "marketing-communications", 70],
  ["restauration-traiteur", "entretien-reparation-equipements", 75],
  ["juridique", "technologies-web", 65],
  ["juridique", "services-administratifs-traduction", 75],
  ["evenementiel", "animation-loisirs", 80],
  ["animation-loisirs", "ressources-educatives", 65],
  ["agriculture-producteurs-locaux", "commerce-detail", 75],
  ["entretien-reparation-equipements", "immobilier", 65],
  ["entretien-reparation-equipements", "construction-renovation", 60],
  ["services-administratifs-traduction", "comptabilite-fiscalite", 60],
  ["construction-renovation", "immobilier", 80],
  ["construction-renovation", "services-financiers-assurance", 70],
  ["immobilier", "juridique", 70],
  ["immobilier", "photographie-video", 75],
  ["immobilier", "services-financiers-assurance", 75],
  ["immobilier", "entretien-menager-commercial", 65],
  ["restauration-traiteur", "evenementiel", 85],
  ["restauration-traiteur", "commerce-detail", 60],
  ["evenementiel", "photographie-video", 80],
  ["evenementiel", "marketing-communications", 70],
  ["marketing-communications", "technologies-web", 75],
  ["marketing-communications", "commerce-detail", 75],
  ["marketing-communications", "photographie-video", 70],
  ["technologies-web", "commerce-detail", 70],
  ["technologies-web", "ressources-humaines-formation", 60],
  ["comptabilite-fiscalite", "juridique", 70],
  ["comptabilite-fiscalite", "commerce-detail", 60],
  ["comptabilite-fiscalite", "construction-renovation", 60],
  ["commerce-detail", "transport-logistique", 75],
  ["transport-logistique", "construction-renovation", 55],
  ["ressources-humaines-formation", "sante-bien-etre", 65],
  ["ressources-humaines-formation", "construction-renovation", 55],
  ["sante-bien-etre", "evenementiel", 55],
  ["ressources-educatives", "technologies-web", 55],
];

export const SAME_SECTOR_AFFINITY = 10;

/** Deterministic default affinity for pairs not listed above: 40..50. */
export function defaultAffinity(slugA: string, slugB: string): number {
  if (slugA === slugB) return SAME_SECTOR_AFFINITY;
  const [x, y] = [slugA, slugB].sort();
  let hash = 0;
  for (const char of `${x}|${y}`) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return 40 + (hash % 11);
}

export function affinityFor(slugA: string, slugB: string): number {
  const listed = DEFAULT_AFFINITIES.find(
    ([a, b]) => (a === slugA && b === slugB) || (a === slugB && b === slugA),
  );
  return listed ? listed[2] : defaultAffinity(slugA, slugB);
}
