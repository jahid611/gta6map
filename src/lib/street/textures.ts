import * as THREE from "three";

/**
 * Textures dessinées à la volée, dans un `<canvas>`.
 *
 * Aucun fichier à télécharger : le quartier fait déjà 600 Ko de géométrie, et
 * un jeu d'atlas de façades en pèserait autant. Tout est donc généré au
 * démarrage — quelques millisecondes — et mis en cache pour la session.
 *
 * Les textures sont volontairement neutres (gris) : la couleur vient des
 * couleurs par sommet, ce qui permet de teinter chaque immeuble sans multiplier
 * ni les matériaux ni les appels de rendu.
 */

const cache = new Map<string, THREE.Texture>();

function canvas(size: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2d indisponible");
  return { c, g };
}

function finish(key: string, c: HTMLCanvasElement, repeat = 1, aniso = 8): THREE.Texture {
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = aniso;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

/** Générateur pseudo-aléatoire déterministe : la ville est la même à chaque visite. */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/**
 * Façade : une trame de fenêtres sur un module de 4 m de large et 3,2 m de haut
 * (un niveau). La tuile couvre 4 modules dans chaque sens pour que la
 * répétition ne saute pas aux yeux.
 */
export function facadeTexture(): THREE.Texture {
  const key = "facade";
  const hit = cache.get(key);
  if (hit) return hit;

  const TILE = 1024;
  const MODULES = 4;
  const cell = TILE / MODULES;
  const { c, g } = canvas(TILE);
  const random = rng(20260831);

  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, TILE, TILE);

  // Léger bruit de crépi : casse l'aspect plastique des grands aplats.
  const noise = g.createImageData(TILE, TILE);
  for (let i = 0; i < noise.data.length; i += 4) {
    const v = 236 + Math.floor(random() * 20);
    noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = v;
    noise.data[i + 3] = 46;
  }
  g.putImageData(noise, 0, 0);

  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      const x = col * cell;
      const y = row * cell;

      // Bandeau d'étage — l'horizontale marquée des immeubles Art déco.
      g.fillStyle = "rgba(0,0,0,0.13)";
      g.fillRect(x, y + cell - cell * 0.06, cell, cell * 0.045);
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.fillRect(x, y + cell - cell * 0.02, cell, cell * 0.02);

      // Baie vitrée, centrée dans le module.
      const w = cell * 0.5;
      const h = cell * 0.46;
      const wx = x + (cell - w) / 2;
      const wy = y + cell * 0.16;

      g.fillStyle = "rgba(0,0,0,0.30)";
      g.fillRect(wx - 2, wy - 2, w + 4, h + 4);
      g.fillStyle = "#2b3540";
      g.fillRect(wx, wy, w, h);
      // Reflet du ciel dans la vitre.
      const glass = g.createLinearGradient(wx, wy, wx + w, wy + h);
      glass.addColorStop(0, "rgba(255,255,255,0.55)");
      glass.addColorStop(0.45, "rgba(255,255,255,0.12)");
      glass.addColorStop(1, "rgba(255,255,255,0.30)");
      g.fillStyle = glass;
      g.fillRect(wx, wy, w, h);
      // Meneau central.
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.fillRect(wx + w / 2 - 1.5, wy, 3, h);
    }
  }

  return finish(key, c, 1, 8);
}

/**
 * Masque des fenêtres : blanc là où la vitre est allumée, noir ailleurs.
 * Sert de carte d'émission — une fenêtre sur trois est éteinte, sinon la nuit
 * ressemble à un damier.
 */
export function windowMaskTexture(): THREE.Texture {
  const key = "windows";
  const hit = cache.get(key);
  if (hit) return hit;

  const TILE = 512;
  const MODULES = 4;
  const cell = TILE / MODULES;
  const { c, g } = canvas(TILE);
  const random = rng(4242);

  g.fillStyle = "#000000";
  g.fillRect(0, 0, TILE, TILE);

  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      if (random() < 0.34) continue; // appartement vide
      const w = cell * 0.5;
      const h = cell * 0.46;
      const wx = col * cell + (cell - w) / 2;
      const wy = row * cell + cell * 0.16;
      const warmth = 0.55 + random() * 0.45;
      g.fillStyle = `rgba(255,255,255,${warmth.toFixed(2)})`;
      g.fillRect(wx, wy, w, h);
    }
  }

  return finish(key, c, 1, 4);
}

/** Chaussée : bitume grenu, sans marquage (les bandes sont posées en géométrie). */
export function asphaltTexture(): THREE.Texture {
  const key = "asphalt";
  const hit = cache.get(key);
  if (hit) return hit;

  const TILE = 256;
  const { c, g } = canvas(TILE);
  const image = g.createImageData(TILE, TILE);
  const random = rng(77);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 150 + Math.floor(random() * 66);
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  // Quelques raccords de bitume, pour la lisibilité de l'échelle au sol.
  g.strokeStyle = "rgba(120,120,120,0.5)";
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(random() * TILE, 0);
    g.lineTo(random() * TILE, TILE);
    g.stroke();
  }
  return finish(key, c, 1, 8);
}

/** Trottoir : dalles de 1,2 m, l'unité de mesure du piéton. */
export function pavementTexture(): THREE.Texture {
  const key = "pavement";
  const hit = cache.get(key);
  if (hit) return hit;

  const TILE = 256;
  const { c, g } = canvas(TILE);
  const random = rng(31);
  g.fillStyle = "#dcdcdc";
  g.fillRect(0, 0, TILE, TILE);
  const image = g.getImageData(0, 0, TILE, TILE);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = -10 + random() * 20;
    image.data[i] += v;
    image.data[i + 1] += v;
    image.data[i + 2] += v;
  }
  g.putImageData(image, 0, 0);
  g.strokeStyle = "rgba(0,0,0,0.20)";
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const p = (i * TILE) / 4;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, TILE);
    g.moveTo(0, p);
    g.lineTo(TILE, p);
    g.stroke();
  }
  return finish(key, c, 1, 8);
}

/** Sable : grain fin, pour la plage de Vice Beach. */
export function sandTexture(): THREE.Texture {
  const key = "sand";
  const hit = cache.get(key);
  if (hit) return hit;
  const TILE = 256;
  const { c, g } = canvas(TILE);
  const image = g.createImageData(TILE, TILE);
  const random = rng(909);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 200 + Math.floor(random() * 55);
    image.data[i] = v;
    image.data[i + 1] = v - 6;
    image.data[i + 2] = v - 20;
    image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  return finish(key, c, 1, 4);
}

/** Palme, en silhouette découpée : une seule carte alpha pour tout le feuillage. */
export function frondTexture(): THREE.Texture {
  const key = "frond";
  const hit = cache.get(key);
  if (hit) return hit;

  const W = 256;
  const H = 128;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2d indisponible");

  g.clearRect(0, 0, W, H);
  // Rachis.
  g.strokeStyle = "#ffffff";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(4, H / 2);
  g.quadraticCurveTo(W * 0.55, H * 0.22, W - 6, H * 0.42);
  g.stroke();
  // Folioles de part et d'autre.
  g.lineWidth = 3.4;
  for (let i = 0; i < 26; i++) {
    const t = i / 25;
    const x = 4 + t * (W - 12);
    const y = H / 2 + (H * 0.28 - H * 0.5) * t * 1.1 + Math.sin(t * Math.PI) * 4;
    const len = Math.sin(t * Math.PI) * H * 0.42 + 6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len * 0.35, y - len);
    g.stroke();
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len * 0.35, y + len);
    g.stroke();
  }

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  cache.set(key, texture);
  return texture;
}

/**
 * Cartouche posé sur la façade tant que la photo du lieu n'est pas chargée :
 * le nom du lieu, cadré comme une plaque. Évite l'écran de rectangles gris
 * pendant que le réseau travaille.
 */
export function plateTexture(name: string, accent: string): THREE.Texture {
  const W = 512;
  const H = 320;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas 2d indisponible");

  g.fillStyle = "#14141a";
  g.fillRect(0, 0, W, H);
  g.strokeStyle = accent;
  g.lineWidth = 8;
  g.strokeRect(14, 14, W - 28, H - 28);

  g.fillStyle = accent;
  g.font = "600 26px Arial, sans-serif";
  g.fillText("LIEU RÉPERTORIÉ", 34, 64);

  g.fillStyle = "#ffffff";
  g.font = "700 40px Arial, sans-serif";
  const words = name.toUpperCase().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > W - 76 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((text, i) => g.fillText(text, 34, 132 + i * 48));

  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function disposeTextureCache() {
  for (const texture of cache.values()) texture.dispose();
  cache.clear();
}
