import { Skeleton } from "@/components/ui/skeleton";

export default function BusinessProfileLoading() {
  return (
    <div className="p-4 md:p-6">
      <Skeleton className="mb-6 h-8 w-48" />

      {/* Header controls */}
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-6 w-56" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-20" />
        </div>
      </div>

      {/* Interaction cards */}
      <div className="mb-6 grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Impression cards */}
      <div className="mb-6 grid gap-3 grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>

      {/* Daily chart */}
      <Skeleton className="mb-6 h-48 rounded-lg" />

      {/* Bottom grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
