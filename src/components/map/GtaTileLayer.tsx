"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import type { TileSetId } from "@/types/map";
import { BLANK_TILE_URL, COVERED_BOUNDS, MAX_NATIVE_ZOOM, MAX_ZOOM, MIN_NATIVE_ZOOM, MIN_ZOOM, TILE_SIZE } from "@/lib/map/config";
import { buildTileUrl } from "@/lib/map/tiles";
import { mapFilterCss } from "@/lib/map/filters";

/**
 * `L.TileLayer` spécialisé : résout l'URL de chaque tuile via `buildTileUrl`
 * (jeu de tuiles gtadb, nommage `{z},{y},{x}.jpg`). Hors couverture ⇒ tuile
 * vide en data-URI (aucune requête réseau).
 */
class GtaTileLayerImpl extends L.TileLayer {
  /**
   * Le jeu de tuiles est capturé par fermeture plutôt que stocké dans un champ
   * de classe. Les classes Leaflet sont construites par `initialize()` et non
   * par un constructeur ES : un champ déclaré sur la sous-classe est réinitialisé
   * à `undefined` juste après `super()`, si bien que `getTileUrl` finissait par
   * lire un jeu de tuiles vide et renvoyer la tuile blanche pour tout — c'est ce
   * qui laissait la carte vide au changement de fond.
   */
  constructor(
    private readonly tileSetId: TileSetId,
    options: L.TileLayerOptions,
  ) {
    super("", options);
  }

  override getTileUrl(coords: L.Coords): string {
    return buildTileUrl(this.tileSetId, { z: coords.z, x: coords.x, y: coords.y });
  }
}

export function GtaTileLayer({ tileSet, filter }: { tileSet: TileSetId; filter: string }) {
  const map = useMap();
  const layerRef = useRef<GtaTileLayerImpl | null>(null);

  // La couche est recréée quand le fond change, plutôt que mutée en place :
  // c'est quelques millisecondes de plus au basculement, contre une classe
  // entière de bugs d'état en moins.
  useEffect(() => {
    const [[xMin, yMin], [xMax, yMax]] = COVERED_BOUNDS;
    const layer = new GtaTileLayerImpl(tileSet, {
      tileSize: TILE_SIZE,
      minNativeZoom: MIN_NATIVE_ZOOM,
      maxNativeZoom: MAX_NATIVE_ZOOM,
      // Doit suivre `MIN_ZOOM` et non rester à 0 : une couche de tuiles se masque
      // sous son propre `minZoom`. Avec un zoom carte négatif — nécessaire pour
      // cadrer les terres sur un écran de téléphone — la carte se retrouvait
      // vide, sans une seule tuile. `minNativeZoom` reste à 0 : Leaflet réduit
      // les tuiles du niveau 0 au lieu d'en demander d'inexistantes.
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      noWrap: true,
      bounds: L.latLngBounds([yMin, xMin], [yMax, xMax]),
      errorTileUrl: BLANK_TILE_URL,
      // Fluidité : on précharge large et on met à jour pendant le zoom/pan (pas seulement à l'arrêt).
      // `keepBuffer` retient des rangées de tuiles hors écran pour que le
      // déplacement ne montre jamais de vide. À 8 (le défaut Leaflet est 2), la
      // couche gardait plusieurs centaines d'images dans le DOM ; 3 suffit à
      // couvrir un déplacement franc pour un tiers du coût mémoire.
      keepBuffer: 4,
      // Les tuiles ne sont plus recalculées pendant le zoom : elles sont mises à
      // l'échelle par le compositeur puis rafraîchies une fois le geste terminé.
      // Recharger en plein zoom était le principal à-coup ressenti.
      updateWhenZooming: false,
      updateWhenIdle: false,
      updateInterval: 150,
      // Pas de `crossOrigin` : maps.gtadb.org n'envoie pas d'en-tête CORS (inutile sans lecture canvas).
      className: "gta-tiles",
      attribution:
        'Carte <a href="https://map.gtadb.org" target="_blank" rel="noopener">gtadb.org</a> (Yanis, Dupzor & contributeurs, Public Domain) · Caméras <a href="https://github.com/rolux/gtamaplib" target="_blank" rel="noopener">gtamaplib</a> · <a href="https://gta.wiki" target="_blank" rel="noopener">GTA Wiki</a> CC BY-NC-SA',
    });
    layer.addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map, tileSet]);

  // Le filtre se pose sur le `tilePane` entier plutôt que sur la seule couche
  // de tuiles : tout ce qui relève du fond de carte le subit d'un coup, sans
  // qu'un calque oublié reste à sa couleur d'origine. Les marqueurs vivent dans
  // d'autres panes et restent donc intacts.
  useEffect(() => {
    const pane = map.getPane("tilePane");
    if (pane) pane.style.filter = mapFilterCss(filter) ?? "";
  }, [map, filter]);

  return null;
}
