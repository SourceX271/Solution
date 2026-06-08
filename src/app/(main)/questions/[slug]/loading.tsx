import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="h-96 rounded-xl bg-muted" />
      </div>
    </div>
  );
}