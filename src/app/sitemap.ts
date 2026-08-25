import type { MetadataRoute } from "next";
import { getLocations } from "@/lib/data/locations";
import { SITE_URL } from "./layout";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locations = await getLocations();
  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: SITE_URL + "/map", lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    ...locations.map((l) => ({
      url: `${SITE_URL}/location/${l.slug}`,
      lastModified: new Date(l.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
