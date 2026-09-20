import { LoadingShell, Skeleton } from "@/components/Skeleton";
import { getI18n } from "@/lib/i18n-server";

export default async function Loading() {
  const { t } = await getI18n();
  return (
    <div className="container-page pt-10">
      <LoadingShell label={t.loading.label}>
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="mt-3 h-10 w-2/3 max-w-lg" />
        <Skeleton className="mt-3 h-4 w-1/2 max-w-md" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      </LoadingShell>
    </div>
  );
}
