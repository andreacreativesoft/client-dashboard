import { Skeleton } from "@/components/ui/skeleton";

export default function AISettingsLoading() {
  return (
    <div className="px-8 py-12">
      <div className="mb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-96" />
      </div>
      <Skeleton className="mb-6 h-12 w-full" />
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
