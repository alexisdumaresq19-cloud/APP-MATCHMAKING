import type { ReactNode } from "react";
import { AlertCircleIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optionalLabel,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string | string[];
  required?: boolean;
  optionalLabel?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-base font-medium">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        ) : null}
        {optionalLabel ? (
          <span className="font-normal text-muted-foreground"> (facultatif)</span>
        ) : null}
      </Label>
      {children}
      {hint && !message ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {message ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="flex items-start gap-1 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}

export function fieldAria(id: string, error?: string | string[], hint?: string) {
  const hasError = Array.isArray(error) ? error.length > 0 : Boolean(error);
  return {
    "aria-invalid": hasError || undefined,
    "aria-describedby": hasError ? `${id}-error` : hint ? `${id}-hint` : undefined,
  };
}

export function FormAlert({
  message,
  variant = "error",
  className,
}: {
  message?: string | null;
  variant?: "error" | "success" | "info";
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-base",
        variant === "error" && "border-destructive/40 bg-destructive/5 text-destructive",
        variant === "success" && "border-green-300 bg-green-50 text-green-900",
        variant === "info" && "border-border bg-muted text-foreground",
        className,
      )}
    >
      {message}
    </div>
  );
}
