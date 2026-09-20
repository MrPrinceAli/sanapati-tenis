import { LoadingShell, Skeleton } from "@/components/Skeleton";
import { getI18n } from "@/lib/i18n-server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <LoadingShell label={t.loading.label}>
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-3 h-9 w-1/2 max-w-sm" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64" />
    </LoadingShell>
  );
}
