# Loi 25 — comment la plateforme respecte la protection des renseignements personnels

Ce document décrit, obligation par obligation, ce que Jumelage fait et ce qui reste à faire par
l'organisation (le « responsable » au sens de la Loi 25). Il ne constitue pas un avis juridique.

## Ce que nous collectons, et pourquoi

| Donnée | Finalité | Où |
| --- | --- | --- |
| Nom, courriel, téléphone, poste, entreprise, secteur, ville, région, site web | Identifier la personne, la contacter, la jumeler | `Participant` |
| Offres, besoins, secteurs recherchés, description | Calculer les jumelages | `Participant`, copie figée par événement dans `EventRegistration` |
| Objectifs pour l'événement, notes internes | Améliorer les rencontres; suivi par l'organisation | `EventRegistration` |
| Acceptation de l'avis (texte complet, version, date, adresse IP, navigateur) | Preuve du consentement | `ConsentLog` |
| Présence (heure d'arrivée) | Facturation, statistiques | `EventRegistration` |
| Courriels envoyés (destinataire, sujet, gabarit, statut) | Traçabilité des envois | `EmailLog` |

Aucune donnée n'est vendue ni transmise à un tiers autre que le fournisseur de courriel (Resend
ou SMTP) et l'hébergeur de la base (Neon ou Supabase).

## 1. Responsable de la protection des renseignements personnels

Réglages › Organisation : **Courriel du responsable de la confidentialité**. Cette adresse est
affichée sur la page publique `/<organisation>/confidentialite`, dans les courriels et dans
« Mes données ». C'est elle qui reçoit les demandes de suppression.

## 2. Avis de collecte et consentement (art. 8, 12, 14)

- L'avis complet est affiché au moment de l'inscription; la case n'est pas pré-cochée.
- Chaque acceptation est journalisée avec le **texte intégral** et sa **version** (hachage SHA-256).
- Réglages › Consentement conserve **toutes les versions** (`ConsentTextVersion`), avec l'auteur, la
  date, une note et le nombre d'acceptations. Un nouveau texte crée une nouvelle version; les
  participants qui n'ont accepté que l'ancienne ne sont plus jumelés tant qu'ils n'ont pas accepté
  la nouvelle (demande groupée depuis l'onglet Publication).
- Le consentement est demandé par organisation, pas par événement : une personne qui participe à
  plusieurs événements n'accepte le texte qu'une fois, jusqu'au prochain changement.

## 3. Droit d'accès et de portabilité (art. 27)

Depuis son lien personnel, « **Mes données** » montre ce que nous conservons et offre le
téléchargement en **JSON** et en **CSV** : profil, inscriptions, jumelages (noms et raisons),
consentements, demandes. L'organisation peut produire le même fichier depuis la fiche du
participant (« Exporter »). Chaque export est journalisé (`AuditLog`, action `EXPORT`).

## 4. Droit de rectification (art. 28)

« **Mon profil** » permet à la personne de corriger elle-même ses renseignements. L'organisation
peut aussi le faire depuis l'onglet Inscrits.

## 5. Droit à l'effacement et délai de réponse (art. 28.1, 32)

1. La personne clique « Demander la suppression de mes données » (limité à 3 demandes par jour).
2. Le responsable reçoit un courriel; la demande apparaît dans **Participants › Demandes de
   suppression** avec le décompte des **30 jours** légaux.
3. **Anonymiser** : un courriel de confirmation part d'abord, puis nom, coordonnées, entreprise,
   profil, textes libres et adresses IP des consentements sont effacés, et tous les liens
   personnels sont révoqués. Les inscriptions restent, sans nom, pour la facturation (section 9
   du cahier des charges); la preuve de consentement reste, sans identifiant technique.
4. **Refuser** exige un motif, conservé avec la demande.

L'anonymisation est irréversible et journalisée (`AuditLog`, action `DELETE`).

## 6. Conservation

- Profil : tant que la personne participe. Anonymisé sur demande, ou au moment que
  l'organisation choisit (fiche › Anonymiser).
- Journaux de courriels et d'audit : conservés avec l'organisation.
- Jetons de connexion (liens magiques, invitations, réinitialisations) : à usage unique, expirent
  en 15 minutes (connexion) ou 7 jours (invitation).

Une politique de purge automatique (par exemple 24 mois après le dernier événement) est prévue en
Phase 2 (`IDEES_PHASE2.md`).

## 7. Mesures de sécurité (art. 3.2, 10)

- Accès aux données personnelles réservé aux comptes de l'organisation; isolation par
  organisation vérifiée par test automatisé.
- Mots de passe hachés (argon2id); verrouillage progressif; sessions révoquées à la désactivation.
- Liens participants signés, à durée limitée, révocables (`tokenVersion`).
- HTTPS obligatoire, en-têtes de sécurité, limitation de débit sur toutes les entrées publiques.
- Aucune donnée personnelle dans les URL ni dans les journaux (champs masqués).
- Sauvegardes : gérées par l'hébergeur de la base; procédure manuelle dans le `README.md`.

## 8. Incident de confidentialité (art. 3.5 à 3.8)

En cas d'accès non autorisé :

1. Révoquer les accès : Réglages › Comptes (désactiver), changer `AUTH_SECRET` et
   `PARTICIPANT_TOKEN_SECRET` (toutes les sessions et tous les liens tombent).
2. Consigner l'incident (date, nature, personnes touchées) dans votre registre des incidents.
3. Évaluer le risque de préjudice sérieux; si présent, aviser la Commission d'accès à
   l'information et les personnes concernées (`Participants` › export des courriels touchés).

## 9. Ce qui reste à l'organisation

- Adopter et publier sa politique de confidentialité (le texte fourni par défaut est un point de
  départ; Réglages › Consentement).
- Tenir le registre des incidents et, le cas échéant, l'évaluation des facteurs relatifs à la vie
  privée pour tout nouveau traitement.
- Répondre aux demandes dans les 30 jours (la file affiche le compte à rebours).
