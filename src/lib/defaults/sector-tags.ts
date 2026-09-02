/** Coherent offers/needs per sector, used by the demo seed. */
export const SECTOR_TAGS: Record<string, { offers: string[]; needs: string[] }> = {
  "garderie-petite-enfance": {
    offers: ["garde d'enfants", "service de garde", "camp de jour", "halte-garderie"],
    needs: ["entretien ménager", "ressources éducatives", "traiteur", "assurance", "comptabilité"],
  },
  "entretien-menager-commercial": {
    offers: ["entretien ménager", "nettoyage commercial", "désinfection", "entretien de bureaux"],
    needs: ["garderies", "bureaux à entretenir", "recrutement", "comptabilité", "assurance"],
  },
  "ressources-educatives": {
    offers: [
      "ressources éducatives",
      "matériel pédagogique",
      "ateliers éducatifs",
      "jeux éducatifs",
    ],
    needs: ["garderies", "écoles", "impression", "site web", "marketing"],
  },
  "restauration-traiteur": {
    offers: ["traiteur", "boîtes à lunch", "service de bar", "repas corporatifs"],
    needs: ["événements corporatifs", "photographe", "marketing", "assurance", "livraison"],
  },
  "construction-renovation": {
    offers: ["rénovation", "construction", "menuiserie", "aménagement de bureaux"],
    needs: ["clients immobiliers", "financement", "sous-traitants", "comptabilité", "assurance"],
  },
  immobilier: {
    offers: ["courtage immobilier", "gestion immobilière", "locaux commerciaux"],
    needs: ["rénovation", "photographe", "notaire", "entretien ménager", "financement"],
  },
  "services-financiers-assurance": {
    offers: ["assurance", "planification financière", "financement", "assurance collective"],
    needs: ["références clients", "événements", "marketing", "site web"],
  },
  "comptabilite-fiscalite": {
    offers: ["comptabilité", "tenue de livres", "fiscalité", "paie"],
    needs: ["nouveaux clients PME", "logiciel", "site web", "marketing"],
  },
  juridique: {
    offers: ["services juridiques", "contrats", "notaire", "incorporation"],
    needs: ["clients PME", "comptabilité", "marketing", "site web"],
  },
  "marketing-communications": {
    offers: ["marketing", "réseaux sociaux", "stratégie de marque", "rédaction"],
    needs: ["clients PME", "photographe", "site web", "impression"],
  },
  "technologies-web": {
    offers: ["site web", "logiciel", "automatisation", "boutique en ligne"],
    needs: ["clients PME", "marketing", "comptabilité", "photographe"],
  },
  "sante-bien-etre": {
    offers: ["massothérapie", "coaching santé", "ateliers bien-être", "ergonomie"],
    needs: ["entreprises pour ateliers", "local", "marketing", "assurance collective"],
  },
  "commerce-detail": {
    offers: ["produits locaux", "boutique", "cadeaux corporatifs", "articles promotionnels"],
    needs: ["fournisseurs", "marketing", "site web", "comptabilité", "livraison"],
  },
  "transport-logistique": {
    offers: ["livraison", "transport", "entreposage", "déménagement commercial"],
    needs: ["commerces", "assurance", "recrutement", "financement"],
  },
  "ressources-humaines-formation": {
    offers: ["recrutement", "formation", "coaching", "gestion de la paie"],
    needs: ["entreprises en croissance", "site web", "marketing", "local"],
  },
  evenementiel: {
    offers: [
      "organisation d'événements",
      "location de salle",
      "événements corporatifs",
      "animation",
    ],
    needs: ["traiteur", "photographe", "service de bar", "marketing", "articles promotionnels"],
  },
  "photographie-video": {
    offers: ["photographe", "vidéo corporative", "photos de produits", "photos immobilières"],
    needs: ["événements", "immobilier", "marketing", "commerces"],
  },
  autre: {
    offers: ["services divers", "consultation"],
    needs: ["partenariats", "marketing", "comptabilité"],
  },
};
