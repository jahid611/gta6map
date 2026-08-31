import * as THREE from "three";
import type { StreetMode, StreetWorld, WorldSpot } from "@/types/street";
import { AMBIANCES, REAL, VI, type Ambiance } from "./ambiance";
import { buildBuildings, buildGround, buildPalms, CollisionGrid, type FacadeAnchor } from "./build";
import {
  asphaltTexture,
  facadeTexture,
  frondTexture,
  pavementTexture,
  plateTexture,
  sandTexture,
  windowMaskTexture,
  disposeTextureCache,
} from "./textures";

/**
 * Moteur du mode piéton.
 *
 * Une seule scène, deux ambiances. Rien n'est reconstruit à la bascule : les
 * couleurs sont interpolées dans le nuanceur (`uBlend`), les lumières et le
 * brouillard sur le processeur. On peut donc basculer en pleine course, et même
 * s'arrêter à mi-chemin entre les deux mondes.
 */

const EYE_HEIGHT = 1.72;
const WALK_SPEED = 3.1;
const RUN_SPEED = 7.4;
const PLAYER_RADIUS = 0.45;
/** Distance à laquelle une fiche est signalée dans le bandeau. */
const NEAR_DISTANCE = 26;
/** Distance de chargement / déchargement des photos de façade. */
const PHOTO_IN = 110;
const PHOTO_OUT = 190;
/** Photos gardées en mémoire simultanément. */
const PHOTO_BUDGET = 26;
/** Distances de peinture / effacement de la plaque au nom du lieu. */
const PLATE_IN = 220;
const PLATE_OUT = 320;

export interface StreetFrame {
  fps: number;
  /** Position locale (m) et cap (deg, 0 = nord). */
  x: number;
  z: number;
  heading: number;
  /** Lieu le plus proche à moins de `NEAR_DISTANCE`. */
  near: WorldSpot | null;
  nearDistance: number;
  mode: StreetMode;
  blend: number;
  running: boolean;
}

export interface StreetEngineOptions {
  world: StreetWorld;
  canvas: HTMLCanvasElement;
  /** Résout l'URL d'une photo (proxy CORS côté site). */
  photoSrc: (file: string) => string | null;
  onFrame: (frame: StreetFrame) => void;
  onLockChange: (locked: boolean) => void;
  onOpenSpot: (spot: WorldSpot) => void;
  onModeChange: (mode: StreetMode) => void;
}

interface Panel {
  spot: WorldSpot;
  anchor: FacadeAnchor;
  group: THREE.Group;
  plate: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  real: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  game: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null;
  state: "idle" | "loading" | "ready";
  lastUsed: number;
}

/** Interpole une couleur hexadécimale entre les deux ambiances. */
function lerpColor(target: THREE.Color, a: string, b: string, t: number) {
  target.set(a);
  target.lerp(TMP_COLOR.set(b), t);
}
const TMP_COLOR = new THREE.Color();

export class StreetEngine {
  private readonly world: StreetWorld;
  private readonly options: StreetEngineOptions;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly clock = new THREE.Clock();
  private readonly collisions: CollisionGrid;

  /** 0 = vraie vie, 1 = GTA VI. Interpolé, jamais binaire. */
  private readonly blend = { value: 0 };
  private targetBlend = 0;
  private mode: StreetMode = "real";

  private readonly sun = new THREE.DirectionalLight(0xffffff, 2.6);
  private readonly hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.3);
  private readonly fog = new THREE.Fog(0xffffff, 90, 1100);
  private skyMaterial!: THREE.ShaderMaterial;
  private sky!: THREE.Mesh;

  private readonly panels: Panel[] = [];
  private readonly spotsByslug = new Map<string, WorldSpot>();

  // État du joueur.
  private readonly position = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private yaw = 0;
  private pitch = 0;
  private bob = 0;
  private locked = false;
  private readonly keys = new Set<string>();
  /** Joystick tactile : direction de marche et regard. */
  private touchMove: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null;
  private touchLook: { id: number; x: number; y: number } | null = null;

  private frames = 0;
  private fpsClock = 0;
  private fps = 0;
  private raf = 0;
  private disposed = false;
  private near: WorldSpot | null = null;
  private nearDistance = Infinity;

  constructor(options: StreetEngineOptions) {
    this.options = options;
    this.world = options.world;

    this.renderer = new THREE.WebGLRenderer({
      canvas: options.canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = REAL.exposure;

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.25, 3000);
    this.scene.fog = this.fog;

    for (const spot of this.world.spots) this.spotsByslug.set(spot.slug, spot);
    this.collisions = new CollisionGrid(this.world.buildings);

    this.position.set(this.world.spawn.x, EYE_HEIGHT, this.world.spawn.z);
    this.yaw = -(this.world.spawn.heading * Math.PI) / 180;

    this.buildScene();
    this.bindEvents();
    this.resize();
    this.applyAmbiance(0);
    this.loop();
  }

  // ── Scène ─────────────────────────────────────────────────────────────────

  /**
   * Injecte la seconde couleur par sommet dans un matériau standard : `color`
   * porte l'ambiance réelle, `colorVi` l'ambiance jeu, et `uBlend` fait le
   * fondu. Passer par `onBeforeCompile` évite de réécrire tout l'éclairage de
   * three.js pour une seule ligne.
   */
  private dualColor<T extends THREE.Material>(material: T): T {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uBlend = this.blend;
      shader.vertexShader = `attribute vec3 colorVi;\nuniform float uBlend;\n${shader.vertexShader}`.replace(
        "#include <color_vertex>",
        "vColor = mix( color, colorVi, uBlend );",
      );
    };
    // Sans cette clé, three pourrait servir à ce matériau un programme compilé
    // pour un matériau de mêmes réglages mais non modifié — et les couleurs VI
    // ne s'afficheraient jamais.
    material.customProgramCacheKey = () => "street-dual-color";
    return material;
  }

  private buildScene() {
    const { world } = this;

    // ── Ciel ────────────────────────────────────────────────────────────────
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uBlend: this.blend,
        uTopA: { value: new THREE.Color(REAL.sky[0]) },
        uMidA: { value: new THREE.Color(REAL.sky[1]) },
        uBotA: { value: new THREE.Color(REAL.sky[2]) },
        uTopB: { value: new THREE.Color(VI.sky[0]) },
        uMidB: { value: new THREE.Color(VI.sky[1]) },
        uBotB: { value: new THREE.Color(VI.sky[2]) },
      },
      vertexShader: `
        varying vec3 vDirection;
        void main() {
          vDirection = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vDirection;
        uniform float uBlend;
        uniform vec3 uTopA, uMidA, uBotA, uTopB, uMidB, uBotB;
        void main() {
          float h = normalize(vDirection).y;
          vec3 top = mix(uTopA, uTopB, uBlend);
          vec3 mid = mix(uMidA, uMidB, uBlend);
          vec3 bot = mix(uBotA, uBotB, uBlend);
          // Deux bandes : zénith -> milieu de ciel -> horizon.
          vec3 color = mix(bot, mid, smoothstep(-0.05, 0.28, h));
          color = mix(color, top, smoothstep(0.22, 0.85, h));
          gl_FragColor = vec4(color, 1.0);
        }`,
    });
    // Le dôme suit le joueur : le quartier fait 3 km de large, une voûte figée
    // à l'origine finirait derrière lui.
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), this.skyMaterial);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    // ── Lumières ────────────────────────────────────────────────────────────
    this.scene.add(this.hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 420;
    const extent = 130;
    this.sun.shadow.camera.left = -extent;
    this.sun.shadow.camera.right = extent;
    this.sun.shadow.camera.top = extent;
    this.sun.shadow.camera.bottom = -extent;
    this.sun.shadow.bias = -0.0009;
    // Obligatoire : la caméra d'ombre a été construite avec ses bornes par
    // défaut (±5 m), et three ne recalcule pas sa projection tout seul.
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // ── Sol de base ─────────────────────────────────────────────────────────
    // Uni, et teinté sur le processeur : n'ayant pas d'attribut `colorVi`, il ne
    // doit surtout pas passer par `dualColor` — le nuanceur ne compilerait pas.
    const [south, west, north, east] = world.bbox;
    const spanX = (east - west) * 111_320 * Math.cos((world.origin[0] * Math.PI) / 180);
    const spanZ = (north - south) * 111_320;
    this.baseGround = new THREE.MeshLambertMaterial({ color: REAL.ground });
    const base = new THREE.Mesh(new THREE.PlaneGeometry(spanX * 2.6, spanZ * 2.6), this.baseGround);
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.45;
    base.receiveShadow = true;
    this.scene.add(base);

    // ── Voirie et surfaces ──────────────────────────────────────────────────
    const ground = buildGround(world);
    const add = (
      geometry: THREE.BufferGeometry | null,
      map: THREE.Texture | null,
      extra?: Partial<THREE.MeshLambertMaterialParameters>,
    ) => {
      if (!geometry) return null;
      const material = this.dualColor(
        new THREE.MeshLambertMaterial({ vertexColors: true, map: map ?? undefined, ...extra }),
      );
      const mesh = new THREE.Mesh(geometry, material);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
      return mesh;
    };

    add(ground.asphalt, asphaltTexture());
    add(ground.pavement, pavementTexture());
    add(ground.markings, null);
    add(ground.sand, sandTexture());
    add(ground.green, null);
    add(ground.water, null, { transparent: true, opacity: 0.92 });

    // ── Immeubles ───────────────────────────────────────────────────────────
    const buildings = buildBuildings(world.buildings);
    if (buildings.walls) {
      const material = this.dualColor(
        new THREE.MeshLambertMaterial({
          vertexColors: true,
          map: facadeTexture(),
          emissiveMap: windowMaskTexture(),
          emissive: new THREE.Color(0x000000),
          emissiveIntensity: 0,
        }),
      );
      this.wallMaterial = material;
      const mesh = new THREE.Mesh(buildings.walls, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
    if (buildings.roofs) {
      const mesh = new THREE.Mesh(
        buildings.roofs,
        this.dualColor(new THREE.MeshLambertMaterial({ vertexColors: true })),
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }
    if (buildings.neon) {
      // Le bandeau de néon n'est pas éclairé : il émet. En ambiance réelle sa
      // couleur est celle du mur, il se fond donc dans la façade.
      const material = this.dualColor(
        new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
      );
      this.neonMaterial = material;
      const mesh = new THREE.Mesh(buildings.neon, material);
      mesh.matrixAutoUpdate = false;
      this.scene.add(mesh);
    }

    // ── Palmiers ────────────────────────────────────────────────────────────
    if (world.trees.length) {
      this.frondMaterial = new THREE.MeshLambertMaterial({
        map: frondTexture(),
        alphaTest: 0.45,
        transparent: false,
        side: THREE.DoubleSide,
        color: REAL.foliage,
      });
      this.trunkMaterial = new THREE.MeshLambertMaterial({ color: REAL.trunk });
      const { trunks, crowns } = buildPalms(world.trees, this.frondMaterial, this.trunkMaterial);
      trunks.castShadow = true;
      crowns.castShadow = true;
      this.scene.add(trunks, crowns);
    }

    // ── Photos de façade ────────────────────────────────────────────────────
    for (const anchor of buildings.anchors) {
      const spot = this.spotsByslug.get(anchor.slug);
      if (!spot || (!spot.ig && !spot.irl)) continue;
      this.panels.push(this.createPanel(spot, anchor));
    }

    // ── Balises verticales ──────────────────────────────────────────────────
    this.scene.add(this.buildBeacons());
  }

  private baseGround!: THREE.MeshLambertMaterial;
  private readonly sunDirection = new THREE.Vector3(0, 1, 0);
  private wallMaterial?: THREE.MeshLambertMaterial;
  private neonMaterial?: THREE.MeshBasicMaterial;
  private frondMaterial?: THREE.MeshLambertMaterial;
  private trunkMaterial?: THREE.MeshLambertMaterial;
  private beaconMaterial?: THREE.MeshBasicMaterial;

  /**
   * Cadre posé sur la façade. Tant que la photo n'est pas chargée, on affiche
   * une plaque au nom du lieu : le repère existe dès le premier regard, et le
   * réseau ne travaille que pour ce qu'on approche.
   */
  private createPanel(spot: WorldSpot, anchor: FacadeAnchor): Panel {
    const width = Math.min(Math.max(anchor.length - 1.4, 3), 13);
    const height = Math.min(width * 0.62, Math.max(anchor.height - 1.2, 2.4));
    const centerY = Math.min(1.8 + height / 2, Math.max(anchor.height - height / 2 - 0.6, height / 2 + 0.6));

    const group = new THREE.Group();
    group.position.set(anchor.x + anchor.nx * 0.14, centerY, anchor.z + anchor.nz * 0.14);
    group.rotation.y = Math.atan2(anchor.nx, anchor.nz);

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.34, height + 0.34),
      new THREE.MeshBasicMaterial({ color: spot.color ?? "#f976b0", toneMapped: false }),
    );
    frame.position.z = -0.03;
    group.add(frame);

    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: "#14141a" }),
    );
    group.add(plate);

    group.userData.width = width;
    group.userData.height = height;
    this.scene.add(group);
    return { spot, anchor, group, plate, real: null, game: null, state: "idle", lastUsed: 0 };
  }

  /**
   * Colonnes lumineuses au-dessus des lieux répertoriés — le repère qu'on suit
   * des yeux depuis le bout de la rue. Toutes fusionnées en un seul maillage.
   */
  private buildBeacons(): THREE.Mesh {
    const positions: number[] = [];
    const colors: number[] = [];
    const index: number[] = [];
    const color = new THREE.Color();
    const HEIGHT = 26;
    const HALF = 0.5;

    for (const spot of this.world.spots) {
      color.set(spot.color ?? "#f976b0").convertSRGBToLinear();
      // Deux quads croisés : lisible sous tous les angles, sans facturation.
      for (const [dx, dz] of [
        [HALF, 0],
        [0, HALF],
      ] as const) {
        const base = positions.length / 3;
        positions.push(
          spot.x - dx, 0.2, spot.z - dz,
          spot.x + dx, 0.2, spot.z + dz,
          spot.x + dx, HEIGHT, spot.z + dz,
          spot.x - dx, HEIGHT, spot.z - dz,
        );
        // Le faisceau s'éteint vers le haut.
        colors.push(
          color.r, color.g, color.b,
          color.r, color.g, color.b,
          0, 0, 0,
          0, 0, 0,
        );
        index.push(base, base + 1, base + 2, base, base + 2, base + 3);
        index.push(base, base + 2, base + 1, base, base + 3, base + 2);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();

    this.beaconMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, this.beaconMaterial);
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  // ── Photos ────────────────────────────────────────────────────────────────

  private readonly loader = new THREE.TextureLoader();

  private loadPanel(panel: Panel) {
    if (panel.state !== "idle") return;
    panel.state = "loading";
    const { width, height } = panel.group.userData as { width: number; height: number };

    const makeMesh = (texture: THREE.Texture, opacity: number, z: number) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false }),
      );
      mesh.position.z = z;
      panel.group.add(mesh);
      return mesh as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
    };

    const wanted: [("real" | "game"), string][] = [];
    if (panel.spot.irl) wanted.push(["real", panel.spot.irl]);
    if (panel.spot.ig) wanted.push(["game", panel.spot.ig]);

    let pending = wanted.length;
    if (!pending) {
      panel.state = "ready";
      return;
    }

    for (const [slot, file] of wanted) {
      const url = this.options.photoSrc(file);
      if (!url) {
        if (--pending === 0) this.finishPanel(panel);
        continue;
      }
      this.loader.load(
        url,
        (texture) => {
          if (this.disposed) {
            texture.dispose();
            return;
          }
          const mesh = makeMesh(texture, 0, slot === "real" ? 0.02 : 0.03);
          if (slot === "real") panel.real = mesh;
          else panel.game = mesh;
          if (--pending === 0) this.finishPanel(panel);
        },
        undefined,
        () => {
          if (--pending === 0) this.finishPanel(panel);
        },
      );
    }
  }

  /**
   * Une fiche n'a pas toujours ses deux photos. Quand il en manque une, l'autre
   * reste affichée dans les deux ambiances : mieux vaut la même image des deux
   * côtés qu'un cadre vide.
   */
  private finishPanel(panel: Panel) {
    panel.state = "ready";
    if (!panel.real && !panel.game) return;
    panel.plate.visible = false;
    this.applyPanelBlend(panel, this.blend.value);
  }

  private applyPanelBlend(panel: Panel, blend: number) {
    if (panel.real && panel.game) {
      panel.real.material.opacity = 1 - blend;
      panel.game.material.opacity = blend;
      panel.real.visible = blend < 0.999;
      panel.game.visible = blend > 0.001;
    } else if (panel.real) {
      panel.real.material.opacity = 1;
    } else if (panel.game) {
      panel.game.material.opacity = 1;
    }
  }

  /**
   * La plaque au nom du lieu n'est peinte qu'à l'approche : cent quatre-vingts
   * canvas de 512 px dès le chargement, ce serait 30 Mo de textures pour du
   * texte illisible depuis le bout de la rue.
   */
  private ensurePlate(panel: Panel) {
    if (panel.plate.material.map) return;
    panel.plate.material.map = plateTexture(panel.spot.name, panel.spot.color ?? "#f976b0");
    panel.plate.material.needsUpdate = true;
  }

  private releasePlate(panel: Panel) {
    const map = panel.plate.material.map;
    if (!map) return;
    map.dispose();
    panel.plate.material.map = null;
    panel.plate.material.needsUpdate = true;
  }

  private unloadPanel(panel: Panel) {
    for (const mesh of [panel.real, panel.game]) {
      if (!mesh) continue;
      panel.group.remove(mesh);
      mesh.material.map?.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
    }
    panel.real = null;
    panel.game = null;
    panel.plate.visible = true;
    panel.state = "idle";
  }

  /**
   * Streaming des photos : on charge ce qui est proche, on décharge ce qui
   * s'éloigne, et on ne dépasse jamais le budget mémoire. Sans cela, un
   * quartier chargerait 158 JPEG d'un coup.
   */
  private updatePanels(now: number) {
    let loaded = 0;
    for (const panel of this.panels) {
      const distance = Math.hypot(panel.spot.x - this.position.x, panel.spot.z - this.position.z);
      if (distance < PLATE_IN) this.ensurePlate(panel);
      else if (distance > PLATE_OUT) this.releasePlate(panel);

      if (panel.state === "ready" || panel.state === "loading") {
        loaded++;
        panel.lastUsed = distance < PHOTO_IN ? now : panel.lastUsed;
        if (distance > PHOTO_OUT) {
          this.unloadPanel(panel);
          loaded--;
        }
      } else if (distance < PHOTO_IN && loaded < PHOTO_BUDGET) {
        this.loadPanel(panel);
        loaded++;
      }
    }
  }

  // ── Ambiance ──────────────────────────────────────────────────────────────

  private readonly colorScratch = new THREE.Color();

  private applyAmbiance(blend: number) {
    const a: Ambiance = REAL;
    const b: Ambiance = VI;

    lerpColor(this.fog.color, a.fog.color, b.fog.color, blend);
    this.fog.near = THREE.MathUtils.lerp(a.fog.near, b.fog.near, blend);
    this.fog.far = THREE.MathUtils.lerp(a.fog.far, b.fog.far, blend);

    lerpColor(this.sun.color, a.sun.color, b.sun.color, blend);
    this.sun.intensity = THREE.MathUtils.lerp(a.sun.intensity, b.sun.intensity, blend);
    const azimuth = THREE.MathUtils.lerp(a.sun.azimuth, b.sun.azimuth, blend);
    const elevation = THREE.MathUtils.lerp(a.sun.elevation, b.sun.elevation, blend);
    const phi = (90 - elevation) * THREE.MathUtils.DEG2RAD;
    const theta = azimuth * THREE.MathUtils.DEG2RAD;
    // Azimut 0 = nord = −z ; le soleil tourne dans le sens horaire vu du ciel.
    this.sunDirection
      .set(Math.sin(phi) * Math.sin(theta), Math.cos(phi), -Math.sin(phi) * Math.cos(theta))
      .normalize();

    lerpColor(this.hemi.color, a.ambient.sky, b.ambient.sky, blend);
    lerpColor(this.hemi.groundColor, a.ambient.ground, b.ambient.ground, blend);
    this.hemi.intensity = THREE.MathUtils.lerp(a.ambient.intensity, b.ambient.intensity, blend);

    this.renderer.toneMappingExposure = THREE.MathUtils.lerp(a.exposure, b.exposure, blend);

    if (this.wallMaterial) {
      lerpColor(this.colorScratch, a.windows.color, b.windows.color, blend);
      this.wallMaterial.emissive.copy(this.colorScratch);
      this.wallMaterial.emissiveIntensity = THREE.MathUtils.lerp(
        a.windows.intensity,
        b.windows.intensity,
        blend,
      );
    }
    if (this.frondMaterial) lerpColor(this.frondMaterial.color, a.foliage, b.foliage, blend);
    if (this.trunkMaterial) lerpColor(this.trunkMaterial.color, a.trunk, b.trunk, blend);
    if (this.baseGround) lerpColor(this.baseGround.color, a.ground, b.ground, blend);
    if (this.beaconMaterial) this.beaconMaterial.opacity = 0.16 + blend * 0.24;

    for (const panel of this.panels) {
      if (panel.state === "ready") this.applyPanelBlend(panel, blend);
    }
  }

  setMode(mode: StreetMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.targetBlend = mode === "vi" ? 1 : 0;
    this.options.onModeChange(mode);
  }

  toggleMode() {
    this.setMode(this.mode === "real" ? "vi" : "real");
  }

  getMode(): StreetMode {
    return this.mode;
  }

  /** Téléporte le joueur devant un lieu, tourné vers lui. */
  goToSpot(slug: string) {
    const spot = this.spotsByslug.get(slug);
    if (!spot) return;
    const panel = this.panels.find((p) => p.spot.slug === slug);
    if (panel) {
      // Devant la façade, à 12 m, regard vers le mur.
      const { nx, nz } = panel.anchor;
      const [x, z] = this.collisions.resolve(
        panel.anchor.x + nx * 12,
        panel.anchor.z + nz * 12,
        PLAYER_RADIUS,
      );
      this.position.set(x, EYE_HEIGHT, z);
      this.yaw = Math.atan2(-nx, -nz);
    } else {
      const [x, z] = this.collisions.resolve(spot.x, spot.z + 10, PLAYER_RADIUS);
      this.position.set(x, EYE_HEIGHT, z);
      this.yaw = Math.PI;
    }
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
  }

  // ── Entrées ───────────────────────────────────────────────────────────────

  private bindEvents() {
    const canvas = this.options.canvas;
    canvas.addEventListener("click", this.onCanvasClick);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd);
    canvas.addEventListener("touchcancel", this.onTouchEnd);
  }

  private readonly onCanvasClick = () => {
    if (!this.locked) void this.options.canvas.requestPointerLock();
  };

  private readonly onPointerLockChange = () => {
    this.locked = document.pointerLockElement === this.options.canvas;
    if (!this.locked) this.keys.clear();
    this.options.onLockChange(this.locked);
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.locked) return;
    const sensitivity = 0.0022;
    this.yaw -= event.movementX * sensitivity;
    this.pitch -= event.movementY * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    // Laisse passer les raccourcis navigateur et la saisie dans les champs.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

    const code = event.code;
    if (code === "KeyF") {
      event.preventDefault();
      this.toggleMode();
      return;
    }
    if (code === "KeyE") {
      event.preventDefault();
      if (this.near) this.options.onOpenSpot(this.near);
      return;
    }
    if (code === "Space" || code.startsWith("Arrow")) event.preventDefault();
    this.keys.add(code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private readonly onResize = () => this.resize();

  private readonly onTouchStart = (event: TouchEvent) => {
    event.preventDefault();
    const half = window.innerWidth / 2;
    for (const touch of Array.from(event.changedTouches)) {
      if (touch.clientX < half && !this.touchMove) {
        this.touchMove = { id: touch.identifier, ox: touch.clientX, oy: touch.clientY, dx: 0, dy: 0 };
      } else if (!this.touchLook) {
        this.touchLook = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
      }
    }
  };

  private readonly onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    for (const touch of Array.from(event.changedTouches)) {
      if (this.touchMove?.id === touch.identifier) {
        // Course de 64 px pour la vitesse maximale.
        this.touchMove.dx = THREE.MathUtils.clamp((touch.clientX - this.touchMove.ox) / 64, -1, 1);
        this.touchMove.dy = THREE.MathUtils.clamp((touch.clientY - this.touchMove.oy) / 64, -1, 1);
      } else if (this.touchLook?.id === touch.identifier) {
        this.yaw -= (touch.clientX - this.touchLook.x) * 0.005;
        this.pitch = THREE.MathUtils.clamp(
          this.pitch - (touch.clientY - this.touchLook.y) * 0.005,
          -1.45,
          1.45,
        );
        this.touchLook.x = touch.clientX;
        this.touchLook.y = touch.clientY;
      }
    }
  };

  private readonly onTouchEnd = (event: TouchEvent) => {
    for (const touch of Array.from(event.changedTouches)) {
      if (this.touchMove?.id === touch.identifier) this.touchMove = null;
      if (this.touchLook?.id === touch.identifier) this.touchLook = null;
    }
  };

  // ── Boucle ────────────────────────────────────────────────────────────────

  private resize() {
    const canvas = this.options.canvas;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private step(dt: number) {
    // Direction voulue, dans le repère de la caméra.
    let forward = 0;
    let strafe = 0;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) strafe -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) strafe += 1;
    if (this.touchMove) {
      forward -= this.touchMove.dy;
      strafe += this.touchMove.dx;
    }

    const running =
      this.keys.has("ShiftLeft") ||
      this.keys.has("ShiftRight") ||
      (this.touchMove !== null && Math.hypot(this.touchMove.dx, this.touchMove.dy) > 0.92);
    const speed = running ? RUN_SPEED : WALK_SPEED;

    const length = Math.hypot(forward, strafe);
    if (length > 1) {
      forward /= length;
      strafe /= length;
    }

    // Le cap : yaw = 0 regarde vers −z (le nord).
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wishX = (-sin * forward + cos * strafe) * speed;
    const wishZ = (-cos * forward - sin * strafe) * speed;

    // Accélération franche, arrêt net : on veut la nervosité d'un jeu, pas
    // l'inertie d'une simulation.
    const accel = 1 - Math.exp(-dt * 14);
    this.velocity.x += (wishX - this.velocity.x) * accel;
    this.velocity.z += (wishZ - this.velocity.z) * accel;

    const [x, z] = this.collisions.resolve(
      this.position.x + this.velocity.x * dt,
      this.position.z + this.velocity.z * dt,
      PLAYER_RADIUS,
    );
    this.position.x = x;
    this.position.z = z;

    // Balancement du pas — le repère qui fait qu'on se sent marcher.
    const moving = Math.hypot(this.velocity.x, this.velocity.z);
    this.bob += dt * moving * (running ? 2.3 : 1.9);
    const amplitude = Math.min(moving / speed, 1) * (running ? 0.085 : 0.05);
    this.position.y = EYE_HEIGHT + Math.sin(this.bob * 2) * amplitude;

    this.camera.position.copy(this.position);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.sky.position.set(this.position.x, 0, this.position.z);

    // La caméra d'ombre suit le joueur : une carte d'ombre de 260 m suffit à
    // couvrir ce qu'on voit, et reste nette.
    // La caméra d'ombre suit le joueur, le soleil garde sa direction.
    this.sun.target.position.set(this.position.x, 0, this.position.z);
    this.sun.target.updateMatrixWorld();
    this.sun.position
      .copy(this.sunDirection)
      .multiplyScalar(240)
      .add(this.sun.target.position);

    return running;
  }

  private updateNear() {
    let best: WorldSpot | null = null;
    let bestDistance = NEAR_DISTANCE;
    for (const spot of this.world.spots) {
      const distance = Math.hypot(spot.x - this.position.x, spot.z - this.position.z);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = spot;
      }
    }
    this.near = best;
    this.nearDistance = best ? bestDistance : Infinity;
  }

  private readonly loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    const dt = Math.min(this.clock.getDelta(), 0.05);
    const now = performance.now();

    const running = this.step(dt);

    // Fondu d'ambiance : ~0,9 s d'un monde à l'autre.
    if (this.blend.value !== this.targetBlend) {
      const step = dt / 0.9;
      this.blend.value =
        this.targetBlend > this.blend.value
          ? Math.min(this.targetBlend, this.blend.value + step)
          : Math.max(this.targetBlend, this.blend.value - step);
      this.applyAmbiance(this.blend.value);
    }

    this.updateNear();
    this.updatePanels(now);

    this.renderer.render(this.scene, this.camera);

    this.frames++;
    this.fpsClock += dt;
    if (this.fpsClock >= 0.5) {
      this.fps = Math.round(this.frames / this.fpsClock);
      this.frames = 0;
      this.fpsClock = 0;
    }

    this.options.onFrame({
      fps: this.fps,
      x: this.position.x,
      z: this.position.z,
      heading: ((-this.yaw * 180) / Math.PI + 360) % 360,
      near: this.near,
      nearDistance: this.nearDistance,
      mode: this.mode,
      blend: this.blend.value,
      running,
    });
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    const canvas = this.options.canvas;
    canvas.removeEventListener("click", this.onCanvasClick);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    canvas.removeEventListener("touchstart", this.onTouchStart);
    canvas.removeEventListener("touchmove", this.onTouchMove);
    canvas.removeEventListener("touchend", this.onTouchEnd);
    canvas.removeEventListener("touchcancel", this.onTouchEnd);
    if (document.pointerLockElement === canvas) document.exitPointerLock();

    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else material?.dispose?.();
    });
    disposeTextureCache();
    this.renderer.dispose();
  }
}

export { AMBIANCES, NEAR_DISTANCE };
