import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

export type EmailBrand = {
  platformName: string;
  organizationName: string;
  primaryColor: string;
  replyToEmail: string;
};

const fontFamily =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const emailStyles = {
  paragraph: { fontSize: "16px", lineHeight: "24px", color: "#1f2937", margin: "0 0 16px" },
  muted: { fontSize: "14px", lineHeight: "20px", color: "#6b7280", margin: "0 0 12px" },
  button: (color: string) => ({
    backgroundColor: color,
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 600,
    padding: "14px 24px",
    borderRadius: "8px",
    textDecoration: "none",
    display: "inline-block",
  }),
  card: {
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "16px",
    margin: "0 0 16px",
  },
};

export function EmailLayout({
  brand,
  preview,
  title,
  children,
}: {
  brand: EmailBrand;
  preview: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Html lang="fr-CA">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f3f4f6", fontFamily, margin: 0, padding: "24px 0" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            maxWidth: "560px",
            margin: "0 auto",
            overflow: "hidden",
          }}
        >
          <Section style={{ backgroundColor: brand.primaryColor, padding: "20px 24px" }}>
            <Text style={{ color: "#ffffff", fontSize: "18px", fontWeight: 700, margin: 0 }}>
              {brand.platformName}
            </Text>
            <Text style={{ color: "#ffffff", fontSize: "13px", margin: "4px 0 0", opacity: 0.9 }}>
              {brand.organizationName}
            </Text>
          </Section>
          <Section style={{ padding: "24px" }}>
            <Heading
              as="h1"
              style={{ fontSize: "22px", lineHeight: "30px", margin: "0 0 16px", color: "#111827" }}
            >
              {title}
            </Heading>
            {children}
            <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 16px" }} />
            <Text style={emailStyles.muted}>
              Des questions? Écrivez-nous à{" "}
              <Link href={`mailto:${brand.replyToEmail}`} style={{ color: brand.primaryColor }}>
                {brand.replyToEmail}
              </Link>
              .
            </Text>
            <Text style={{ ...emailStyles.muted, margin: 0 }}>
              Propulsé par{" "}
              <Link href="https://adcreation.co" style={{ color: "#6b7280" }}>
                AD Création
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
