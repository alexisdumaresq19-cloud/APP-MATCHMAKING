"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "details", label: "Détails" },
  { segment: "inscrits", label: "Inscrits" },
  { segment: "matching", label: "Matching" },
  { segment: "tables", label: "Tables" },
  { segment: "publication", label: "Publication" },
  { segment: "jour-j", label: "Jour J" },
];

export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections de l'événement"
      className="-mx-4 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-1">
        {TABS.map((tab) => {
          const href = `/admin/events/${eventId}/${tab.segment}`;
          const active = pathname.startsWith(href);
          return (
            <li key={tab.segment} className="shrink-0">
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
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
