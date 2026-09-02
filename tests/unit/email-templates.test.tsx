import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
import { ConsentPendingEmail } from "@/lib/email/templates/consent-pending";
import { ExistingProfileLinkEmail } from "@/lib/email/templates/existing-profile-link";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset";
import { RegistrationConfirmedEmail } from "@/lib/email/templates/registration-confirmed";

const brand = {
  platformName: "Jumelage",
  organizationName: "Démo Réseautage",
  primaryColor: "#1F3864",
  replyToEmail: "bonjour@demo.local",
};

describe("email templates", () => {
  it("renders the registration confirmation in HTML and plain text", async () => {
    const element = (
      <RegistrationConfirmedEmail
        brand={brand}
        firstName="Alexis"
        eventName="Soirée réseautage"
        eventDate="jeudi 15 octobre 2026, à 18 h 00"
        venue="Salle A, Montréal"
        companyName="AD Création"
        sectorName="Technologies et web"
        offers={["sites web"]}
        needs={["comptabilité"]}
        participantUrl="https://example.com/p/token123"
      />
    );
    const html = await render(element);
    const text = await render(element, { plainText: true });
    expect(html).toContain("Merci, votre inscription est confirmée!");
    expect(html).toContain("https://example.com/p/token123");
    expect(html).toContain("Propulsé par");
    expect(html).not.toMatch(/<img/i); // no tracking pixel
    expect(text).toContain("Bonjour Alexis");
    expect(text).toContain("https://example.com/p/token123");
    expect(text).toContain("bonjour@demo.local");
  });

  it("renders the other transactional templates", async () => {
    const outputs = await Promise.all([
      render(
        <ExistingProfileLinkEmail
          brand={brand}
          firstName="Marie"
          eventName="Soirée"
          alreadyRegistered={false}
          actionUrl="https://example.com/x"
        />,
      ),
      render(
        <ExistingProfileLinkEmail
          brand={brand}
          firstName="Marie"
          eventName="Soirée"
          alreadyRegistered
          actionUrl="https://example.com/y"
        />,
      ),
      render(
        <MagicLinkEmail
          brand={brand}
          name="Allyson"
          loginUrl="https://example.com/l"
          expiresMinutes={15}
        />,
      ),
      render(
        <PasswordResetEmail
          brand={brand}
          name="Allyson"
          resetUrl="https://example.com/r"
          expiresMinutes={60}
        />,
      ),
      render(
        <ConsentPendingEmail
          brand={brand}
          firstName="Jean"
          eventName="Soirée"
          eventDate="15 octobre"
          participantUrl="https://example.com/c"
        />,
      ),
    ]);
    expect(outputs[0]).toContain("inscrire avec mon profil");
    expect(outputs[1]).toContain("Vous êtes déjà inscrit");
    expect(outputs[2]).toContain("Me connecter");
    expect(outputs[3]).toContain("Choisir un nouveau mot de passe");
    expect(outputs[4]).toContain("avis de confidentialité");
  });
});
