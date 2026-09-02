import { cn } from "@/lib/utils";

export function PoweredBy({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)}>
      Propulsé par{" "}
      <a
        href="https://adcreation.co"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline-offset-4 hover:underline"
      >
        AD Création
      </a>
    </p>
  );
}
