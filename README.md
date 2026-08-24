# GTA VI Map — Leonida

Carte interactive GTA VI (Leonida / Vice City) — Next.js 16 · React 19 · TypeScript strict · Tailwind v4 · Leaflet (CRS custom) · Zustand · Supabase.

**Contenu** : 1 439 lieux identifiés (gtadb.org) avec 1 900 photos in-game / réelles, **101 plans de trailers & screenshots officiels géolocalisés** (position caméra triangulée par gtamaplib, cône d'orientation sur la carte), fiches **GTA Wiki** par zone, étiquettes de zones façon carte officielle, suivi de complétion, recherche instantanée, marqueurs perso.

**DA** : palette et typographie calées sur rockstargames.com/VI (nuit `#111117`, rose néon `#f976b0`, cyan `#8cdbf3`, dégradé « VI » ; Helvetica Now → Inter Tight / Inter), logo VI officiel, fiches façon « State of Leonida » (image hero, tags pill, boutons copier/lien, GTA Wiki, Full View).

## Démarrage rapide

```bash
npm install
cp .env.example .env.local        # optionnel : Supabase, R2…
npm run setup                     # fetch:all (gtadb + frames + wiki) puis seed (JSON statiques)
npm run dev
```

Sans Supabase, l'app fonctionne à 100 % en local : données depuis `src/data/generated/*.json`, progression dans `localStorage`. Les tuiles sont servies par défaut depuis `maps.gtadb.org` (256 px, jeu `yanis,15`).

## Scripts

| Script | Rôle |
| --- | --- |
| `npm run fetch:sources` | `map.gtadb.org/data/6/landmarks.json` + photos → `data/raw/`, `public/photos/gtadb/` ; `gtamapdata.py` → caméras officielles (T1/T2/S2/S3, **fuites exclues**) + sections |
| `npm run fetch:frames` | Extrait les 101 frames 4K depuis `frames.zip` (1,5 Go) par **HTTP Range** sans tout télécharger → JPEG 1600 px + vignettes dans `public/frames/` |
| `npm run fetch:wiki` | API MediaWiki gta.wiki : pages de lieux/zones, extraits, images → `data/raw/wiki-places.json`, `public/wiki/` |
| `npm run seed` | Normalisation, catégories, drapeaux, enrichissement 3D/wiki, `src/data/generated/`, upsert Supabase si configuré (`--no-db`, `--dry-run`) |
| `npm run assets:mirror` | Miroir local d'un jeu de tuiles gtadb (`--set yanis,15`) pour auto-hébergement |
| `npm run assets:upload` | Envoie `public/{tiles,photos,frames,wiki}` vers R2/S3 (cache immutable) |
| `npm run typecheck` / `lint` / `build` | Qualité & build |

## Système de coordonnées

- Monde RAGE en mètres, origine `(0,0)` au centre, X → est, Y → nord, étendue ±16 384 m.
- Tuiles gtadb 256 px, niveaux 0..6 (grille 4·2ᶻ), nommage `{set}/{z}/{z},{y},{x}.jpg` (z=5 ⇒ 1 px/m).
- CRS Leaflet custom (`src/lib/map/crs.ts`) : `L.latLng(y, x)` — **aucune conversion d'échelle**, les indices de tuiles Leaflet correspondent aux fichiers.
- Caméras : `xyz` = position caméra, `yaw` 0° = nord, sens horaire (cône sur la carte).

## Arborescence

```
data/raw/                 sources brutes (gtadb, cameras.json, wiki-places.json, map-sections.json…)
scripts/                  fetch-sources · fetch-frames · fetch-wiki · seed-database · mirror-tiles · upload-tiles
supabase/migrations/      0001_init.sql · 0002_media_wiki.sql (kind, media, wiki, flags, map_sections)
public/brand/             logo VI officiel (© Rockstar Games)
src/
  app/                    layout (fonts, SEO) · page (carte) · location/[slug] (SSG) · sitemap · robots · manifest · api/locations · auth/callback
  components/
    map/                  InteractiveMap · MapLoader (ssr:false) · GtaTileLayer · MarkerClusterLayer (landmarks + caméras) · AreaLabelsLayer · MapController · MapControls · CustomMarkersLayer
    sidebar/              LocationDrawer (desktop = panneau gauche, mobile = bottom-sheet) · LocationDetails (hero, Full View, wiki, zone)
    filters/ search/ progress/ layout/ auth/ ui/ (button, sheet, lightbox, tooltip…)
  hooks/                  useAuth · useProgressSync · useMediaQuery · useDebounce
  lib/map/                config (tuiles gtadb) · coords · crs · tiles · icons (Lucide → divIcon, caméras, étiquettes)
  lib/data/               categories (groupes media / gameplay / landmark, mapping tags) · locations (Supabase → fallback JSON)
  lib/supabase/           client · server · database.types · mappers
  store/                  useMapStore · useFilterStore · useProgressStore · useUIStore
  types/                  map · category · location (Location, LocationMedia, LocationWiki, AreaInfo, MapSection) · progress
```

## Supabase

1. Exécuter `supabase/migrations/0001_init.sql` puis `0002_media_wiki.sql`.
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm run seed` → `categories`, `locations` (ids déterministes, idempotent).
4. Activer Google / Magic link → progression et marqueurs synchronisés (RLS par utilisateur).

## Images : miroir local, bucket ou source d'origine

`public/{tiles,photos,frames,wiki}` est ignoré par git (déploiement léger) : ces dossiers existent après `npm run setup` mais **jamais** sur un déploiement. Chaque image est donc résolue à l'exécution par `src/lib/media.ts`, dans cet ordre :

| Priorité | Source | Quand |
| --- | --- | --- |
| 1 | `NEXT_PUBLIC_*_BASE_URL` | variable renseignée (bucket R2/S3) |
| 2 | `/tiles`, `/photos`, `/frames`, `/wiki` | le dossier existe dans `public/` (auto-détecté par `next.config.ts` au build) |
| 3 | `maps.gtadb.org`, `map.gtadb.org`, `gta.wiki` | par défaut — aucune config requise |

Conséquence : un déploiement sans aucune variable affiche les tuiles, les 1 900 photos gtadb et les vignettes wiki depuis leurs sources d'origine. Les données générées ne référencent plus que des **noms de fichiers** (`gtadb/L1478-ig.jpg`) : `npm run seed` n'inspecte plus `public/`, la donnée décrit ce qui existe à la source, pas ce qui traîne sur la machine du dev.

**Seule exception, les frames de trailers** (`media.frame`) : extraites d'une archive de 1,5 Go, elles n'ont pas d'URL publique unitaire. Sans hébergement, les 101 fiches caméra s'affichent sans image (le cône d'orientation sur la carte, lui, reste correct). Pour les servir : `npm run fetch:frames`, `npm run assets:upload`, puis `NEXT_PUBLIC_FRAMES_BASE_URL`.

## Production (Vercel + Cloudflare R2)

1. Optionnel — auto-héberger les assets : `npm run assets:mirror` (≈300 Mo) puis `npm run assets:upload` avec les variables `S3_*`.
2. Sur Vercel : `NEXT_PUBLIC_SITE_URL` et les variables Supabase ; les quatre `NEXT_PUBLIC_*_BASE_URL` uniquement si vous hébergez les assets (cf. section ci-dessus).
3. `cp .env.example .env.local` liste toutes les variables reconnues.

## Crédits & licences

- Carte, landmarks, photos : [map.gtadb.org](https://map.gtadb.org) (rolux, Yanis, Dupzor & contributeurs — Public Domain).
- Caméras trailers/screenshots : [gtamaplib](https://github.com/rolux/gtamaplib) (MIT). Seules les caméras officielles (trailers, screenshots Rockstar) sont utilisées ; les fuites sont exclues.
- Fiches & images de zones : [GTA Wiki](https://gta.wiki) (CC BY-NC-SA 3.0).
- Frames de trailers, screenshots, logo VI : © Rockstar Games — usage fan non commercial.
