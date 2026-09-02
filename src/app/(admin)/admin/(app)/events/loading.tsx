import { Skeleton } from "@/components/ui/skeleton";

/** Streaming placeholder for the events list (S4-08): same shape as the loaded page. */
export default function EventsLoading() {
  return (
    <div aria-busy="true" aria-label="Chargement des événements">
      <div className="mb-6 flex items-start justify-between gap-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="mb-2 h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
