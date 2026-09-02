"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import type { OrganizerRole } from "@prisma/client";
import { AnimatedIcon, type AnimatedIconName } from "@/components/ui/animated-icon";
import { SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

const ITEMS: { href: string; label: string; icon: AnimatedIconName; exact: boolean }[] = [
  { href: "/admin", label: "Tableau de bord", icon: "layout-dashboard", exact: true },
  { href: "/admin/events", label: "Événements", icon: "calendar-days", exact: false },
  { href: "/admin/participants", label: "Participants", icon: "users", exact: false },
  { href: "/admin/settings", label: "Paramètres", icon: "settings", exact: false },
];

export function AdminNav({
  role: _role,
  showMailbox,
}: {
  role: OrganizerRole;
  showMailbox: boolean;
}) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const items = showMailbox
    ? [
        ...ITEMS,
        {
          href: "/admin/courriels",
          label: "Courriels (test)",
          icon: "inbox" as const,
          exact: false,
        },
      ]
    : ITEMS;
  return (
    <nav aria-label="Navigation principale" className="overflow-x-auto px-2 pb-2 lg:px-3 lg:pb-0">
      <ul className="flex gap-1 lg:flex-col">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "al-group relative isolate flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active ? (
                  // The active pill glides between destinations (shared layout).
                  <motion.span
                    layoutId="admin-nav-pill"
                    transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                    className="absolute inset-0 -z-10 rounded-lg bg-primary"
                    aria-hidden="true"
                  />
                ) : null}
                <AnimatedIcon
                  name={item.icon}
                  size={18}
                  primaryColor="currentColor"
                  secondaryColor="currentColor"
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
