"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuildingIcon, CalendarDaysIcon, KeyRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Public navigation of an organization: events, companies directory, personal access. */
export function OrganizationNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const items = [
    {
      href: `/${slug}`,
      label: "Événements",
      icon: CalendarDaysIcon,
      active: pathname === `/${slug}` || pathname.startsWith(`/e/${slug}/`),
    },
    {
      href: `/${slug}/entreprises`,
      label: "Entreprises",
      icon: BuildingIcon,
      active: pathname.startsWith(`/${slug}/entreprises`),
    },
    {
      href: `/${slug}/connexion`,
      label: "Mon accès",
      icon: KeyRoundIcon,
      active: pathname.startsWith(`/${slug}/connexion`),
    },
  ];
  return (
    <nav aria-label="Navigation" className="mx-auto w-full max-w-3xl px-2 sm:px-4">
      <ul className="flex">
        {items.map((item) => (
          <li key={item.href} className="flex-1 sm:flex-none">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-t-lg px-3 text-sm font-medium transition-colors sm:px-4",
                item.active
                  ? "bg-background text-foreground"
                  : "text-brand-foreground/90 hover:bg-white/10",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
