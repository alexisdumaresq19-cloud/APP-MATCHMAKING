"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

/**
 * Animated check box drawn over a native `<input type="checkbox">` (beUI "checkbox" motion:
 * draw-on checkmark). The input stays the real, focusable, submittable control; this is only the
 * visual. Usage: put both inside a `relative` wrapper, give the input `appearance-none` sizing.
 */
export function CheckMark({ checked, className }: { checked: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 grid place-items-center rounded-md border-2 transition-colors duration-200",
        checked
          ? "border-brand bg-brand text-brand-foreground"
          : "border-muted-foreground/50 bg-background",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {checked ? (
          <motion.svg
            key="check"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[70%]"
            initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.5, filter: "blur(4px)" }}
            transition={reduce ? { duration: 0 } : { duration: 0.16, ease: EASE_OUT }}
          >
            <motion.path
              d="M5 13l4 4L19 7"
              initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reduce ? { duration: 0 } : { duration: 0.3, ease: EASE_OUT, delay: 0.04 }}
            />
          </motion.svg>
        ) : null}
      </AnimatePresence>
    </span>
  );
}
