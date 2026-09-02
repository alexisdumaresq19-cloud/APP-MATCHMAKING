"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { SPRING_LAYOUT } from "@/lib/ease";
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
  const reduce = useReducedMotion();
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
                  "relative flex min-h-11 items-center px-3 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {active ? (
                  // The underline glides from the previous tab to the new one (shared layout).
                  <motion.span
                    layoutId="event-tab-indicator"
                    transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                    className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
