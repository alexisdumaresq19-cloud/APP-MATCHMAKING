import type { EmailBrand } from "./templates/layout";

export type BrandSource = {
  name: string;
  platformName: string;
  primaryColor: string;
  replyToEmail: string;
};

export function emailBrandOf(organization: BrandSource): EmailBrand {
  return {
    platformName: organization.platformName,
    organizationName: organization.name,
    primaryColor: organization.primaryColor,
    replyToEmail: organization.replyToEmail,
  };
}
