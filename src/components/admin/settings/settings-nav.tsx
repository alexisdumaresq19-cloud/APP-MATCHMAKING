"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { segment: "organisation", label: "Organisation" },
  { segment: "secteurs", label: "Secteurs" },
  { segment: "affinites", label: "Affinités" },
  { segment: "regles", label: "Règles de matching" },
  { segment: "consentement", label: "Consentement" },
  { segment: "comptes", label: "Comptes" },
  { segment: "facturation", label: "Facturation" },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections des paramètres"
      className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-1">
        {ITEMS.map((item) => {
          const href = `/admin/settings/${item.segment}`;
          const active = pathname.startsWith(href);
          return (
            <li key={item.segment} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
