import { Skeleton } from "@/components/ui/skeleton";

/** Streaming placeholder for an event's tabs (S4-08). */
export default function EventLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement de l'événement">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-2 h-9 w-2/3 max-w-md" />
      <Skeleton className="mb-6 h-4 w-1/2 max-w-sm" />
      <div className="mb-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64" />
    </div>
  );
}
