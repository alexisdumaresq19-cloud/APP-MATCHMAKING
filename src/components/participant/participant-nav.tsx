"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BuildingIcon,
  CalendarDaysIcon,
  ContactRoundIcon,
  MessageSquareIcon,
  UserRoundIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ParticipantNav({ token, unread = 0 }: { token: string; unread?: number }) {
  const pathname = usePathname();
  const base = `/p/${token}`;
  const items = [
    {
      href: base,
      label: "Événements",
      icon: CalendarDaysIcon,
      active: pathname === base || pathname.startsWith(`${base}/evenements`),
      badge: 0,
    },
    {
      href: `${base}/entreprises`,
      label: "Entreprises",
      icon: BuildingIcon,
      active: pathname.startsWith(`${base}/entreprises`),
      badge: 0,
    },
    {
      href: `${base}/messages`,
      label: "Messages",
      icon: MessageSquareIcon,
      active: pathname.startsWith(`${base}/messages`),
      badge: unread,
    },
    {
      href: `${base}/contacts`,
      label: "Contacts",
      icon: ContactRoundIcon,
      active: pathname.startsWith(`${base}/contacts`),
      badge: 0,
    },
    {
      href: `${base}/profil`,
      label: "Mon profil",
      icon: UserRoundIcon,
      active:
        pathname.startsWith(`${base}/profil`) ||
        pathname.startsWith(`${base}/donnees`) ||
        pathname.startsWith(`${base}/invitations`),
      badge: 0,
    },
  ];
  return (
    <nav aria-label="Navigation" className="mx-auto w-full max-w-2xl overflow-x-auto px-2 sm:px-4">
      <ul className="flex min-w-max">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-t-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                item.active
                  ? "bg-background text-foreground"
                  : "text-brand-foreground/90 hover:bg-white/10",
              )}
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
              {item.badge ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                    item.active ? "bg-brand text-brand-foreground" : "bg-white/90 text-brand",
                  )}
                  aria-label={`${item.badge} non lu${item.badge > 1 ? "s" : ""}`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
