"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { EASE_OUT, SPRING_SWAP } from "@/lib/ease";
import { cn } from "@/lib/utils";

/**
 * Swaps its content with a blur/roll when `id` changes (beUI "action-swap-roll" pattern), for
 * button labels that move from "Enregistrer" to "Enregistrement…" to "Enregistré". Layout width
 * follows the new content; reduced motion falls back to a plain crossfade.
 */
export function ActionSwap({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("relative inline-grid place-items-center", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={id}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -10, filter: "blur(6px)" }}
          transition={
            reduce
              ? { duration: 0.12 }
              : { ...SPRING_SWAP, opacity: { duration: 0.16, ease: EASE_OUT } }
          }
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
