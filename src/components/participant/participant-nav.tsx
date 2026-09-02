"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDaysIcon, UserRoundIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ParticipantNav({ token }: { token: string }) {
  const pathname = usePathname();
  const base = `/p/${token}`;
  const items = [
    {
      href: base,
      label: "Mes événements",
      icon: CalendarDaysIcon,
      active: pathname === base || pathname.startsWith(`${base}/evenements`),
    },
    {
      href: `${base}/profil`,
      label: "Mon profil",
      icon: UserRoundIcon,
      active: pathname.startsWith(`${base}/profil`),
    },
  ];
  return (
    <nav aria-label="Navigation" className="mx-auto w-full max-w-2xl px-2 sm:px-4">
      <ul className="flex">
        {items.map((item) => (
          <li key={item.href} className="flex-1">
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-t-lg px-3 text-sm font-medium transition-colors",
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
