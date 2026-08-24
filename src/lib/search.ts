import type { Location, LocationSearchResult } from "@/types";
import { normalizeText } from "./utils";

interface IndexedLocation {
  location: Location;
  name: string;
  area: string;
  irl: string;
  legacyId: string;
}

/**
 * Index de recherche en mémoire (≈ 750 lieux → instantané, pas besoin de lib).
 * Score : préfixe de nom > mot du nom > sous-chaîne du nom > zone > nom IRL > id.
 */
export class LocationSearchIndex {
  private readonly items: IndexedLocation[];

  constructor(locations: readonly Location[]) {
    this.items = locations.map((location) => ({
      location,
      name: normalizeText(location.name),
      area: normalizeText(location.area ?? ""),
      irl: normalizeText(`${location.realWorld.name ?? ""} ${location.realWorld.address ?? ""}`),
      legacyId: location.legacyId.toLowerCase(),
    }));
  }

  search(query: string, limit = 8): LocationSearchResult[] {
    const q = normalizeText(query);
    if (q.length < 1) return [];
    const terms = q.split(/\s+/).filter(Boolean);
    const results: LocationSearchResult[] = [];

    for (const item of this.items) {
      let score = 0;
      if (item.legacyId === q) score += 200;
      if (item.name === q) score += 150;
      else if (item.name.startsWith(q)) score += 100;
      else if (item.name.includes(q)) score += 60;

      let allTermsMatch = true;
      for (const term of terms) {
        const inName = item.name.includes(term);
        const inArea = item.area.includes(term);
        const inIrl = item.irl.includes(term);
        if (inName) score += item.name.split(" ").some((w) => w.startsWith(term)) ? 20 : 10;
        else if (inArea) score += 6;
        else if (inIrl) score += 4;
        else allTermsMatch = false;
      }
      if (!allTermsMatch && score < 60) continue;
      if (score > 0) results.push({ location: item.location, score });
    }

    return results
      .sort((a, b) => b.score - a.score || a.location.name.localeCompare(b.location.name))
      .slice(0, limit);
  }
}
