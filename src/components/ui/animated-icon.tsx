"use client";

import { useEffect, useState, type CSSProperties, type ComponentType, type SVGProps } from "react";
import Armchair from "@animated-color-icons/lucide-react/Armchair";
import Building2 from "@animated-color-icons/lucide-react/Building2";
import CalendarCheck from "@animated-color-icons/lucide-react/CalendarCheck";
import CalendarDays from "@animated-color-icons/lucide-react/CalendarDays";
import CalendarPlus from "@animated-color-icons/lucide-react/CalendarPlus";
import ChartColumn from "@animated-color-icons/lucide-react/ChartColumn";
import CircleCheck from "@animated-color-icons/lucide-react/CircleCheck";
import Download from "@animated-color-icons/lucide-react/Download";
import FileSpreadsheet from "@animated-color-icons/lucide-react/FileSpreadsheet";
import Handshake from "@animated-color-icons/lucide-react/Handshake";
import HeartHandshake from "@animated-color-icons/lucide-react/HeartHandshake";
import Inbox from "@animated-color-icons/lucide-react/Inbox";
import KeyRound from "@animated-color-icons/lucide-react/KeyRound";
import LayoutDashboard from "@animated-color-icons/lucide-react/LayoutDashboard";
import Lightbulb from "@animated-color-icons/lucide-react/Lightbulb";
import Mail from "@animated-color-icons/lucide-react/Mail";
import MailCheck from "@animated-color-icons/lucide-react/MailCheck";
import MapPin from "@animated-color-icons/lucide-react/MapPin";
import Megaphone from "@animated-color-icons/lucide-react/Megaphone";
import PartyPopper from "@animated-color-icons/lucide-react/PartyPopper";
import Printer from "@animated-color-icons/lucide-react/Printer";
import QrCode from "@animated-color-icons/lucide-react/QrCode";
import Rocket from "@animated-color-icons/lucide-react/Rocket";
import Search from "@animated-color-icons/lucide-react/Search";
import Send from "@animated-color-icons/lucide-react/Send";
import Settings from "@animated-color-icons/lucide-react/Settings";
import ShieldCheck from "@animated-color-icons/lucide-react/ShieldCheck";
import SlidersHorizontal from "@animated-color-icons/lucide-react/SlidersHorizontal";
import Sparkles from "@animated-color-icons/lucide-react/Sparkles";
import Table from "@animated-color-icons/lucide-react/Table";
import Target from "@animated-color-icons/lucide-react/Target";
import TrendingUp from "@animated-color-icons/lucide-react/TrendingUp";
import Trophy from "@animated-color-icons/lucide-react/Trophy";
import Upload from "@animated-color-icons/lucide-react/Upload";
import UserRoundPlus from "@animated-color-icons/lucide-react/UserRoundPlus";
import Users from "@animated-color-icons/lucide-react/Users";
import UsersRound from "@animated-color-icons/lucide-react/UsersRound";
import WandSparkles from "@animated-color-icons/lucide-react/WandSparkles";
import Zap from "@animated-color-icons/lucide-react/Zap";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    primaryColor?: string;
    secondaryColor?: string;
    title?: string;
  }
>;

/**
 * The animated icons used in the app, addressed by name so that server components can render them
 * (a component reference cannot cross the server/client boundary). Add here before using a new one.
 */
export const ANIMATED_ICONS = {
  armchair: Armchair,
  building: Building2,
  "calendar-check": CalendarCheck,
  "calendar-days": CalendarDays,
  "calendar-plus": CalendarPlus,
  "chart-column": ChartColumn,
  "circle-check": CircleCheck,
  download: Download,
  "file-spreadsheet": FileSpreadsheet,
  handshake: Handshake,
  "heart-handshake": HeartHandshake,
  inbox: Inbox,
  "key-round": KeyRound,
  "layout-dashboard": LayoutDashboard,
  lightbulb: Lightbulb,
  mail: Mail,
  "mail-check": MailCheck,
  "map-pin": MapPin,
  megaphone: Megaphone,
  "party-popper": PartyPopper,
  printer: Printer,
  "qr-code": QrCode,
  rocket: Rocket,
  search: Search,
  send: Send,
  settings: Settings,
  "shield-check": ShieldCheck,
  "sliders-horizontal": SlidersHorizontal,
  sparkles: Sparkles,
  table: Table,
  target: Target,
  "trending-up": TrendingUp,
  trophy: Trophy,
  upload: Upload,
  "user-round-plus": UserRoundPlus,
  users: Users,
  "users-round": UsersRound,
  "wand-sparkles": WandSparkles,
  zap: Zap,
} satisfies Record<string, IconComponent>;

export type AnimatedIconName = keyof typeof ANIMATED_ICONS;

type Props = {
  name: AnimatedIconName;
  size?: number;
  /** Plays the animation once when the icon appears (for phones, where hover does not exist). */
  play?: boolean;
  /** Replays every `loop` ms (e.g. a loading state). */
  loop?: number;
  primaryColor?: string;
  secondaryColor?: string;
  /** Accessible name; without it the icon is decorative (aria-hidden). */
  title?: string;
  className?: string;
};

/**
 * Wrapper for @animated-color-icons (Lucide, CSS-only animations). Hovering the icon, or an
 * ancestor with the `al-group` class (a button, a card), triggers the animation on desktop; `play`
 * triggers it on mount so it also shows on touch screens. Honours prefers-reduced-motion.
 */
export function AnimatedIcon({
  name,
  size = 24,
  play = false,
  loop,
  primaryColor,
  secondaryColor,
  title,
  className,
}: Props) {
  const Icon = ANIMATED_ICONS[name];
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!play && !loop) return;
    let timer = window.setTimeout(() => setPlaying(true), 50);
    let interval: number | undefined;
    if (loop) {
      interval = window.setInterval(() => {
        setPlaying(false);
        timer = window.setTimeout(() => setPlaying(true), 50);
      }, loop);
    }
    return () => {
      window.clearTimeout(timer);
      if (interval) window.clearInterval(interval);
    };
  }, [play, loop]);
  // The global brand variables win over the icon's own props, so colours are set on the wrapper.
  const style = {
    ...(primaryColor ? { "--animated-lucide-primary": primaryColor } : {}),
    ...(secondaryColor ? { "--animated-lucide-secondary": secondaryColor } : {}),
  } as CSSProperties;
  return (
    <span
      className={cn("al-icon-wrapper inline-flex shrink-0", playing && "al-play", className)}
      style={style}
      aria-hidden={title ? undefined : true}
    >
      <Icon size={size} title={title} />
    </span>
  );
}
