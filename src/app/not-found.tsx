import Link from "next/link";
import { getI18n } from "@/lib/i18n-server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <p className="font-display text-7xl font-bold text-court-900">Out!</p>
      <h1 className="mt-3 text-2xl font-semibold">{t.notFound.title}</h1>
      <p className="mt-2 text-muted">{t.notFound.body}</p>
      <Link href="/" className="btn btn-primary mt-8">
        {t.notFound.home}
      </Link>
    </main>
  );
}
