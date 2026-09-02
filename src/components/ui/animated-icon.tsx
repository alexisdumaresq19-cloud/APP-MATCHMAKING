"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import { cn } from "@/lib/utils";

type IconComponent = ComponentType<
  SVGProps<SVGSVGElement> & {
    size?: number | string;
    primaryColor?: string;
    secondaryColor?: string;
    title?: string;
  }
>;

type Props = {
  icon: IconComponent;
  size?: number;
  /** Plays the animation once when the icon appears (for phones, where hover does not exist). */
  play?: boolean;
  /** Replays every `loop` ms (e.g. a loading state). */
  loop?: number;
  primaryColor?: string;
  secondaryColor?: string;
  title?: string;
  className?: string;
};

/**
 * Wrapper for @animated-color-icons (Lucide, CSS-only animations). Hover triggers the animation on
 * desktop; `play` triggers it on mount so it also shows on touch screens.
 */
export function AnimatedIcon({
  icon: Icon,
  size = 24,
  play = false,
  loop,
  primaryColor,
  secondaryColor,
  title,
  className,
}: Props) {
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
  return (
    <span
      className={cn("al-icon-wrapper inline-flex shrink-0", playing && "al-play", className)}
      aria-hidden={title ? undefined : true}
    >
      <Icon size={size} primaryColor={primaryColor} secondaryColor={secondaryColor} title={title} />
    </span>
  );
}
