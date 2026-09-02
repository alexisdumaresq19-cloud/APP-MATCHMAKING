import type { MatchReasons } from "./types";

function quote(tag: string): string {
  return `« ${tag} »`;
}

function list(tags: string[]): string {
  const quoted = tags.slice(0, 2).map(quote);
  return quoted.length === 2 ? `${quoted[0]} et ${quoted[1]}` : quoted[0];
}

/**
 * Two to three plain-French sentences explaining a match from one side's point of view.
 * Never mentions a numeric score (participants must not see it).
 */
export function describeMatch(reasons: MatchReasons, viewer: "a" | "b"): string[] {
  const theyOfferForMe =
    viewer === "a" ? reasons.complementarity.bOffersANeeds : reasons.complementarity.aOffersBNeeds;
  const iOfferForThem =
    viewer === "a" ? reasons.complementarity.aOffersBNeeds : reasons.complementarity.bOffersANeeds;
  const sentences: string[] = [];

  const theirSectorSoughtByMe =
    viewer === "a"
      ? reasons.complementarity.bSectorSoughtByA
      : reasons.complementarity.aSectorSoughtByB;
  const mySectorSoughtByThem =
    viewer === "a"
      ? reasons.complementarity.aSectorSoughtByB
      : reasons.complementarity.bSectorSoughtByA;
  const theirSector =
    viewer === "a" ? reasons.sectorAffinity.sectors[1] : reasons.sectorAffinity.sectors[0];

  if (theyOfferForMe.length)
    sentences.push(`Ils offrent ${list(theyOfferForMe)}, que vous recherchez.`);
  if (iOfferForThem.length)
    sentences.push(`Vous offrez ${list(iOfferForThem)}, qu'ils recherchent.`);
  if (theirSectorSoughtByMe && sentences.length < 3)
    sentences.push(
      theirSector
        ? `Vous souhaitiez rencontrer le secteur ${quote(theirSector)}.`
        : "Vous souhaitiez rencontrer leur secteur.",
    );
  if (mySectorSoughtByThem && sentences.length < 3)
    sentences.push("Ils cherchaient justement des entreprises de votre secteur.");

  if (reasons.sectorAffinity.score >= 85) sentences.push("Vos secteurs sont très complémentaires.");
  else if (reasons.sectorAffinity.score >= 65)
    sentences.push("Vos secteurs se complètent souvent.");

  if (sentences.length < 3) {
    if (reasons.region.same) sentences.push("Vous êtes dans la même région.");
    else if (reasons.region.neighbors) sentences.push("Vous êtes dans des régions voisines.");
  }
  if (sentences.length < 3 && reasons.novelty.previouslyMet) {
    sentences.push("Vous vous êtes déjà croisés à un événement précédent.");
  }
  if (sentences.length === 0)
    sentences.push("Vos profils sont compatibles selon les critères de l'organisatrice.");
  return sentences.slice(0, 3);
}
