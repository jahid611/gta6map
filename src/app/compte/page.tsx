import type { Metadata } from "next";
import { getCategories, getLocations } from "@/lib/data/locations";
import { AccountPanel } from "@/components/auth/AccountPanel";

export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };
export const revalidate = 3600;

export default async function AccountPage() {
  const [locations, categories] = await Promise.all([getLocations(), getCategories()]);
  const trackable = new Set(categories.filter((c) => c.trackable).map((c) => c.slug));
  const totals = categories
    .filter((c) => c.trackable)
    .map((c) => {
      const ids = locations.filter((l) => l.categorySlug === c.slug).map((l) => l.id);
      return { slug: c.slug, name: c.name, color: c.color, total: ids.length, ids };
    })
    .filter((c) => c.total > 0);
  const total = locations.filter((l) => trackable.has(l.categorySlug)).length;
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <AccountPanel totals={totals} total={total} />
    </main>
  );
}
