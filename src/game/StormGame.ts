import {
  AbstractMesh,
  AnimationGroup,
  ArcRotateCamera,
  AssetContainer,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  DynamicTexture,
  Engine,
  GlowLayer,
  HemisphericLight,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  ParticleSystem,
  PBRMaterial,
  PointLight,
  Scene,
  SceneInstrumentation,
  ShadowGenerator,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector2,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { EMPLOYEES, NAMED_CUSTOMERS, PROTAGONISTS, SHOP_UNLOCK_CHAPTER, TOWERS, WEAPONS, hasCompletedChapter, towerCostForState } from "./content";
import { InputController } from "./input";
import { detectDeviceQuality, type QualityLevel } from "./quality";
import { addLoopProgress, assignLoopQuest, updateMainQuests } from "./quests";
import { creditIncome, saveState, type EmployeeId, type NamedCustomerId, type ProtagonistId, type RuntimeState, type TowerId, type WeaponId } from "./state";
import type { UiController } from "./ui";

interface Actor {
  root: TransformNode;
  meshForwardNode: TransformNode;
  meshForwardAxis: Vector3;
  animations: AnimationGroup[];
  currentAnimation: string;
}

interface CowActor extends Actor {
  hp: number;
  maxHp: number;
  meatYield: number;
  strong: boolean;
  alive: boolean;
  isMoving: boolean;
  behaviorTimer: number;
  roamTarget: Vector3;
  pastureCenter: Vector3;
}

type ZombieType = "walker" | "runner" | "brute" | "boss";
type DamageSource = "player" | TowerId;

interface ZombieActor extends Actor {
  hp: number;
  maxHp: number;
  alive: boolean;
  speed: number;
  baseSpeed: number;
  attackTimer: number;
  attackPhase: "approach" | "anticipation" | "recovery";
  damage: number;
  reward: number;
  type: ZombieType;
  slowTimer: number;
  deathEndsAt: number;
}

interface PendingPlayerAttack {
  weapon: WeaponId;
  elapsed: number;
  impactAt: number;
  recoveryAt: number;
  resolved: boolean;
}

interface MeatDrop {
  root: TransformNode;
  baseY: number;
  phase: number;
  expiresAt: number;
}

interface Projectile {
  root: TransformNode;
  target: ZombieActor;
  progress: number;
  start: Vector3;
  source: TowerId;
  damage: number;
  splash: number;
  slow: number;
}

interface TowerActor extends Actor {
  id: TowerId;
  weapon: TransformNode;
  pad: Mesh;
  cooldown: number;
  animationLodPaused: boolean;
}

interface StaffActor extends Actor {
  id: EmployeeId;
  timer: number;
  patrolIndex: number;
}

type CustomerPhase = "hidden" | "arriving" | "buying" | "leaving";

interface CustomerActor extends Actor {
  phase: CustomerPhase;
  timer: number;
  identity: NamedCustomerId | null;
}

const ASSET_FILES = [
  "cow.glb", "survivor.glb", "customer.glb", "zombie.glb",
  "pine-a.glb", "pine-b.glb", "rock.glb",
  "fence.glb", "fence-gate.glb", "holiday/cabin-wall.glb", "holiday/cabin-wreath.glb",
  "holiday/cabin-window.glb", "holiday/cabin-door.glb", "holiday/cabin-roof.glb", "holiday/cabin-roof-point.glb",
  "holiday/lantern.glb", "tower/arrow.glb", "campfire-stones.glb",
  "custom/butcher-stall.glb", "custom/cash-register.glb", "custom/doghouse.glb",
  "custom/tower-ballista.glb", "custom/tower-frost.glb", "custom/tower-cannon.glb",
  "custom/weapons/machete.glb", "custom/weapons/axe.glb", "custom/weapons/smg.glb",
  "custom/meat-slice.glb", "custom/coin.glb", "custom/boss-zombie.glb",
  ...PROTAGONISTS.map((entry) => entry.model),
  ...NAMED_CUSTOMERS.map((entry) => entry.model),
] as const;

const SHOP_POSITION = new Vector3(-8, 0, -4);
const STALL_POSITION = new Vector3(-8, 0, -7.05);
const PASTURE_CENTER = new Vector3(8.5, 0, 3.7);
const PASTURE_2_CENTER = new Vector3(15.5, 0, -7.5);
const TOWER_POSITIONS: Record<TowerId, Vector3> = {
  ballista: new Vector3(-1, 0, 4.2),
  frost: new Vector3(-5.2, 0, 5.7),
  cannon: new Vector3(3.5, 0, 5.6),
};
const TOWER_ANIMATION_LOD_DISTANCE = 24;

export class StormGame {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly input: InputController;
  private readonly assets = new Map<string, AssetContainer>();
  private readonly sun: DirectionalLight;
  private readonly skyLight: HemisphericLight;
  private shadows?: ShadowGenerator;
  private glow?: GlowLayer;
  private cinematicPipeline?: DefaultRenderingPipeline;
  private readonly instrumentation: SceneInstrumentation;
  private readonly snowEmitter: TransformNode;
  private readonly shopLight: PointLight;
  private snowParticles?: ParticleSystem;
  private readonly ambientParticles: ParticleSystem[] = [];
  private blobShadowMaterial?: StandardMaterial;
  private player!: Actor;
  private cow!: CowActor;
  private strongCow?: CowActor;
  private customer!: CustomerActor;
  private readonly customerVariants = new Map<NamedCustomerId | "anonymous", CustomerActor>();
  private readonly towerActors = new Map<TowerId, TowerActor>();
  private readonly staff = new Map<EmployeeId, StaffActor>();
  private weaponModel?: TransformNode;
  private muzzleFlash?: Mesh;
  private readonly zombies: ZombieActor[] = [];
  private readonly drops: MeatDrop[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly projectilePools = new Map<TowerId, TransformNode[]>();
  private readonly projectileMaterials = new Map<TowerId, PBRMaterial>();
  private readonly zombieTypeMaterials = new Map<ZombieType, PBRMaterial>();
  private readonly carriedVisuals: TransformNode[] = [];
  private readonly stockVisuals: TransformNode[] = [];
  private started = false;
  private attackCooldown = 0;
  private pendingPlayerAttack?: PendingPlayerAttack;
  private damageEventCount = 0;
  private lastDamageAt = 0;
  private deduplicatedMaterials = 0;
  private spawnTimer = 0;
  private enemiesToSpawn = 0;
  private customerCooldown = 2;
  private stockedAtCycleStart = false;
  private nightBlend = 0;
  private elapsed = 0;
  private endShown = false;
  private statsTimer = 0;
  private waveStartedStock = 0;
  private waveStockLost = false;
  private wavePlayerKills = 0;
  private waveTowerKills = 0;
  private waveStartTime = 0;
  private campaignStartTime = performance.now();
  private attackCount = 0;
  private uiUpdateTimer = 0;
  private lowFpsSamples = 0;
  private performanceTier = 0;
  private renderPixelRatio = 1;
  private readonly smokeMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has("smoke");
  private readonly showcaseMode = import.meta.env.DEV && new URLSearchParams(window.location.search).has("showcase");

  constructor(
    canvas: HTMLCanvasElement,
    private readonly ui: UiController,
    private readonly state: RuntimeState,
  ) {
    this.state.quality = this.detectQuality();
    const lowQuality = this.state.quality === "低";
    const devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    this.renderPixelRatio = lowQuality
      ? Math.min(1, devicePixelRatio)
      : this.state.quality === "中"
        ? Math.min(1, devicePixelRatio)
        : Math.min(1.25, devicePixelRatio);
    this.engine = new Engine(canvas, !lowQuality, {
      preserveDrawingBuffer: !lowQuality,
      stencil: !lowQuality,
      powerPreference: "high-performance",
    }, false);
    // Hardware scaling is the inverse of the desired pixel ratio in Babylon.
    // Low quality therefore renders at no more than one backing pixel per CSS pixel,
    // even on 3x DPR phones, and can step down further when FPS stays below target.
    this.engine.setHardwareScalingLevel(1 / this.renderPixelRatio);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = lowQuality
      ? new Color4(0.045, 0.095, 0.15, 1)
      : new Color4(0.57, 0.69, 0.74, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = lowQuality ? 0.0045 : 0.012;
    this.scene.fogColor = lowQuality
      ? new Color3(0.065, 0.13, 0.19)
      : new Color3(0.58, 0.68, 0.72);
    this.scene.environmentIntensity = lowQuality ? 0.44 : 0.72;

    this.camera = new ArcRotateCamera("follow-camera", -Math.PI * 0.28, 1.02, 19, new Vector3(0, 1.2, 0), this.scene);
    this.camera.lowerRadiusLimit = 14;
    this.camera.upperRadiusLimit = 27;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 110;
    this.camera.fov = 0.78;
    this.camera.inputs.clear();

    this.skyLight = new HemisphericLight("polar-skylight", new Vector3(0.2, 1, 0.1), this.scene);
    this.skyLight.intensity = lowQuality ? 0.7 : 1.05;
    this.skyLight.diffuse = lowQuality ? new Color3(0.42, 0.61, 0.74) : new Color3(0.72, 0.84, 0.9);
    this.skyLight.groundColor = lowQuality ? new Color3(0.035, 0.07, 0.11) : new Color3(0.12, 0.18, 0.22);
    this.sun = new DirectionalLight("low-winter-sun", new Vector3(-0.52, -1, 0.38), this.scene);
    this.sun.position = new Vector3(24, 35, -20);
    this.sun.intensity = lowQuality ? 1.65 : 2.4;
    this.sun.diffuse = new Color3(1, 0.91, 0.79);
    if (!lowQuality) {
      const shadowSize = this.state.quality === "中" ? 1024 : 2048;
      this.shadows = new ShadowGenerator(shadowSize, this.sun, true);
      this.shadows.usePercentageCloserFiltering = true;
      this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      this.shadows.bias = 0.002;
      this.shadows.normalBias = 0.03;

      this.glow = new GlowLayer("warm-window-glow", this.scene, { mainTextureFixedSize: 512, blurKernelSize: 48 });
      this.glow.intensity = 0.48;
      this.cinematicPipeline = new DefaultRenderingPipeline("storm-cinematic", true, this.scene, [this.camera]);
      this.cinematicPipeline.fxaaEnabled = true;
      this.cinematicPipeline.bloomEnabled = true;
      this.cinematicPipeline.bloomThreshold = 0.78;
      this.cinematicPipeline.bloomWeight = 0.2;
      this.cinematicPipeline.bloomKernel = 48;
      this.cinematicPipeline.imageProcessingEnabled = true;
      this.cinematicPipeline.imageProcessing.contrast = 1.16;
      this.cinematicPipeline.imageProcessing.exposure = 1.05;
      this.cinematicPipeline.samples = this.state.quality === "高" ? 2 : 1;
    } else {
      // Keep low-quality color grading in the material pass: no FXAA, bloom,
      // glow render target, MSAA, or image-processing post-process is allocated.
      this.scene.imageProcessingConfiguration.contrast = 1.32;
      this.scene.imageProcessingConfiguration.exposure = 0.88;
    }

    this.shopLight = new PointLight("shop-lantern-light", new Vector3(-8, 3.4, -6.1), this.scene);
    this.shopLight.diffuse = new Color3(1, 0.55, 0.25);
    this.shopLight.intensity = 16;
    this.shopLight.range = 13;
    this.snowEmitter = new TransformNode("snow-emitter", this.scene);
    this.instrumentation = new SceneInstrumentation(this.scene);
    this.scene.onAfterRenderObservable.add(() => {
      this.state.currentFps = this.engine.getFps();
      this.state.drawCalls = this.instrumentation.drawCallsCounter.current;
      canvas.dataset.fps = Math.round(this.state.currentFps).toString();
      canvas.dataset.drawCalls = this.state.drawCalls.toString();
      canvas.dataset.activeMeshes = this.scene.getActiveMeshes().length.toString();
      canvas.dataset.quality = this.state.quality;
      canvas.dataset.renderScale = this.renderPixelRatio.toFixed(2);
      canvas.dataset.devicePixelRatio = devicePixelRatio.toFixed(2);
      canvas.dataset.performanceTier = this.performanceTier.toString();
      canvas.dataset.shadowMode = this.shadows ? "realtime" : "blob";
      canvas.dataset.postEffects = this.glow || this.cinematicPipeline ? "on" : "off";
      canvas.dataset.fogDensity = this.scene.fogDensity.toFixed(4);
      canvas.dataset.saveVersion = this.state.version.toString();
      canvas.dataset.protagonist = this.state.protagonistId;
      canvas.dataset.customer = this.customer?.identity ?? "anonymous";
      if (this.player) {
        const meshForward = this.player.meshForwardNode.getDirection(this.player.meshForwardAxis).normalize();
        canvas.dataset.playerX = this.player.root.position.x.toFixed(2);
        canvas.dataset.playerZ = this.player.root.position.z.toFixed(2);
        canvas.dataset.playerMeshForwardX = meshForward.x.toFixed(3);
        canvas.dataset.playerMeshForwardZ = meshForward.z.toFixed(3);
        canvas.dataset.weapon = this.state.weapon;
        canvas.dataset.attackCount = this.attackCount.toString();
        canvas.dataset.attackPhase = this.playerAttackPhase();
        canvas.dataset.damageEvents = this.damageEventCount.toString();
        canvas.dataset.lastDamageAt = this.lastDamageAt.toFixed(3);
        canvas.dataset.cowsKilled = this.state.stats.cowsKilled.toString();
        canvas.dataset.playerKills = this.state.stats.playerKills.toString();
        canvas.dataset.activeZombies = this.zombies.filter((zombie) => zombie.alive).length.toString();
        canvas.dataset.enemyAttackPhases = this.zombies.filter((zombie) => zombie.alive).map((zombie) => zombie.attackPhase).join(",");
        canvas.dataset.playerAnimation = this.player.currentAnimation || "none";
        canvas.dataset.playerClips = this.player.animations.map((animation) => animation.name).sort().join(",");
        canvas.dataset.towerAnimations = [...this.towerActors.values()]
          .map((tower) => `${tower.id}:${tower.currentAnimation || "stopped"}`)
          .join(",");
        canvas.dataset.towerAnimationLod = [...this.towerActors.values()]
          .map((tower) => `${tower.id}:${tower.animationLodPaused ? "paused" : "active"}`)
          .join(",");
      }
    });
    this.input = new InputController(ui.joystick);
    if (this.smokeMode) {
      (window as Window & { __stormSelectProtagonist?: (id: ProtagonistId) => void }).__stormSelectProtagonist = (id) => this.selectProtagonist(id);
    }
    this.createTerrain();
    this.createSnow();
    this.createDistantStorm();

    window.addEventListener("resize", () => this.engine.resize());
    window.setInterval(() => this.monitorPerformance(), 2000);
    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, this.smokeMode ? 0.5 : 0.1);
      this.update(dt);
      this.scene.render();
    });
  }

  async initialize(): Promise<void> {
    if (this.showcaseMode) {
      this.state.stallLevel = 4;
      this.state.displayedMeat = 6;
      this.state.towers = { ballista: 1, frost: 1, cannon: 1 };
      this.state.employees = { ...this.state.employees, cashier: 2, dog: 2 };
    }
    let loaded = 0;
    let nextAsset = 0;
    const fileProgress = new Map<string, number>();
    const loadAsset = async (file: (typeof ASSET_FILES)[number]): Promise<void> => {
      const container = await LoadAssetContainerAsync(`${import.meta.env.BASE_URL}models/${file}`, this.scene, {
        onProgress: (event) => {
          fileProgress.set(file, event.lengthComputable && event.total > 0 ? event.loaded / event.total : 0.35);
          const aggregate = [...fileProgress.values()].reduce((sum, value) => sum + value, 0) / ASSET_FILES.length;
          this.ui.setLoading(Math.min(0.82, aggregate * 0.82), `串流北境資產 · ${loaded} / ${ASSET_FILES.length}`);
        },
      });
      this.assets.set(file, container);
      loaded += 1;
      fileProgress.set(file, 1);
      this.ui.setLoading(loaded / ASSET_FILES.length * 0.82, `載入北境資產 · ${loaded} / ${ASSET_FILES.length}`);
    };
    const loadWorker = async (): Promise<void> => {
      while (nextAsset < ASSET_FILES.length) {
        const file = ASSET_FILES[nextAsset];
        nextAsset += 1;
        await loadAsset(file);
      }
    };
    const loadConcurrency = this.state.quality === "低" ? 3 : 5;
    await Promise.all(Array.from({ length: loadConcurrency }, () => loadWorker()));
    this.deduplicateAssetMaterials();
    this.ui.setLoading(0.86, "佈置牧場與肉舖…");
    this.buildEnvironment();
    this.createActors();
    this.createTowers();
    this.createWeaponModel();
    this.syncUnlockedContent();
    this.createMeatDisplays();
    this.freezeStaticScene();
    this.ui.update(this.state);
    this.processQuests();
    this.ui.setLoading(0.96, "校準暴風光影…");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.ui.enterGame();
    const protagonist = PROTAGONISTS.find((entry) => entry.id === this.state.protagonistId)!;
    this.ui.toast(`「${protagonist.openingLine}」`, "ice");
  }

  selectProtagonist(id: ProtagonistId): void {
    if ((!this.state.requiresProtagonistSelection && !this.smokeMode) || !PROTAGONISTS.some((entry) => entry.id === id)) return;
    this.state.protagonistId = id;
    this.state.requiresProtagonistSelection = false;
    if (this.player) this.replacePlayerModel();
    saveState(this.state);
    this.ui.update(this.state);
  }

  startAttack(): void { this.input.startAttack(); }
  stopAttack(): void { this.input.stopAttack(); }
  startWave(): void { this.input.queueWave(); }

  shopAction(category: "weapon" | "employee" | "pasture", id: string): void {
    if (category === "weapon") this.buyWeapon(id as WeaponId);
    else if (category === "employee") this.hireEmployee(id as EmployeeId);
    else if (id === "pasture2") this.unlockPasture2();
  }

  towerAction(id: TowerId): void { this.buyOrUpgradeTower(id); }

  private createTerrain(): void {
    const ground = MeshBuilder.CreateGround("wind-carved-snow", { width: 56, height: 48, subdivisions: 72, updatable: true }, this.scene);
    const positions = ground.getVerticesData(VertexBuffer.PositionKind)!;
    const indices = ground.getIndices()!;
    for (let index = 0; index < positions.length; index += 3) {
      const x = positions[index];
      const z = positions[index + 2];
      positions[index + 1] = this.heightAt(x, z);
    }
    const normals = new Float32Array(positions.length);
    VertexData.ComputeNormals(positions, indices, normals);
    ground.updateVerticesData(VertexBuffer.PositionKind, positions);
    ground.updateVerticesData(VertexBuffer.NormalKind, normals);
    ground.receiveShadows = Boolean(this.shadows);

    const snow = new PBRMaterial("powder-snow", this.scene);
    snow.albedoColor = new Color3(0.78, 0.87, 0.89);
    snow.roughness = 0.93;
    snow.metallic = 0;
    snow.environmentIntensity = 0.7;
    const snowTexture = this.createSnowTexture();
    snowTexture.uScale = 10;
    snowTexture.vScale = 9;
    snowTexture.wrapU = Texture.WRAP_ADDRESSMODE;
    snowTexture.wrapV = Texture.WRAP_ADDRESSMODE;
    snow.albedoTexture = snowTexture;
    snow.bumpTexture = snowTexture;
    snow.bumpTexture.level = 0.16;
    ground.material = snow;

    const underSnow = MeshBuilder.CreateCylinder("world-skirt", { diameter: 59, height: 5, tessellation: 64 }, this.scene);
    underSnow.position.y = -2.5;
    const skirtMaterial = new PBRMaterial("packed-snow-edge", this.scene);
    skirtMaterial.albedoColor = new Color3(0.29, 0.39, 0.43);
    skirtMaterial.roughness = 1;
    underSnow.material = skirtMaterial;
    underSnow.receiveShadows = Boolean(this.shadows);
  }

  private createSnowTexture(): DynamicTexture {
    const textureSize = this.state.quality === "低" ? 256 : this.state.quality === "中" ? 384 : 512;
    const texture = new DynamicTexture("wind-swept-snow-texture", textureSize, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const image = context.createImageData(textureSize, textureSize);
    let seed = 1917;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let pixel = 0; pixel < image.data.length; pixel += 4) {
      const x = (pixel / 4) % textureSize;
      const y = Math.floor(pixel / 4 / textureSize);
      const dune = Math.sin((x + y * 0.55) * 0.055) * 7;
      const value = Math.max(165, Math.min(244, 214 + dune + (random() - 0.5) * 18));
      image.data[pixel] = value * 0.92;
      image.data[pixel + 1] = value * 0.98;
      image.data[pixel + 2] = value;
      image.data[pixel + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    context.globalAlpha = 0.2;
    context.strokeStyle = "#ffffff";
    for (let line = 0; line < Math.round(textureSize / 15); line += 1) {
      const y = random() * textureSize;
      context.beginPath();
      context.moveTo(-20, y);
      context.bezierCurveTo(textureSize * 0.27, y - textureSize * 0.035, textureSize * 0.66, y + textureSize * 0.043, textureSize + 28, y - textureSize * 0.016);
      context.stroke();
    }
    texture.update(false);
    return texture;
  }

  private createSnow(): void {
    const flake = new DynamicTexture("soft-snowflake", 32, this.scene, false);
    const context = flake.getContext();
    const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 15);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.28, "rgba(235,251,255,.9)");
    gradient.addColorStop(1, "rgba(220,245,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    flake.hasAlpha = true;
    flake.update(false);

    const snowCapacity = this.state.quality === "低" ? 160 : this.state.quality === "中" ? 640 : 1200;
    const snow = new ParticleSystem("blizzard-snow", snowCapacity, this.scene);
    this.snowParticles = snow;
    snow.particleTexture = flake;
    snow.emitter = this.snowEmitter.position;
    snow.minEmitBox = new Vector3(-20, 0, -16);
    snow.maxEmitBox = new Vector3(20, 9, 16);
    snow.color1 = new Color4(0.9, 0.98, 1, 0.9);
    snow.color2 = new Color4(0.65, 0.83, 0.9, 0.45);
    snow.minSize = 0.035;
    snow.maxSize = 0.16;
    snow.minLifeTime = 2.1;
    snow.maxLifeTime = 4.2;
    snow.emitRate = this.state.quality === "低" ? 36 : this.state.quality === "中" ? 150 : 340;
    snow.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    snow.gravity = new Vector3(1.3, -2.4, 0.5);
    snow.direction1 = new Vector3(1.8, -1.2, -0.2);
    snow.direction2 = new Vector3(3.6, -2.8, 0.6);
    snow.minAngularSpeed = -2;
    snow.maxAngularSpeed = 2;
    snow.start();
  }

  private createDistantStorm(): void {
    const material = new StandardMaterial("mountain-silhouette-material", this.scene);
    material.diffuseColor = new Color3(0.18, 0.27, 0.32);
    material.specularColor = Color3.Black();
    const source = MeshBuilder.CreateCylinder("distant-peak-source", { diameterTop: 0, diameterBottom: 10, height: 9, tessellation: 5 }, this.scene);
    source.material = material;
    for (let index = 0; index < 14; index += 1) {
      const mountain = index === 0 ? source : source.createInstance(`distant-peak-${index}`);
      const angle = index / 14 * Math.PI * 2;
      mountain.position.set(Math.sin(angle) * 39, 1.2, Math.cos(angle) * 34);
      mountain.rotation.y = angle * 1.7;
      const diameterScale = (10 + (index % 4) * 3) / 10;
      mountain.scaling.set(1.4 * diameterScale, (9 + (index % 3) * 4) / 9, diameterScale);
    }
  }

  private buildEnvironment(): void {
    this.buildShop();
    this.buildPasture();
    this.buildForest();
    this.buildWayfinding();
  }

  private buildShop(): void {
    const shop = new TransformNode("northwind-butcher-shop", this.scene);
    shop.position.copyFrom(SHOP_POSITION);
    shop.position.y = this.heightAt(shop.position.x, shop.position.z);

    const place = (file: string, local: Vector3, rotationY: number, scale = 2.15): TransformNode => {
      const model = this.instantiateStatic(file, `shop-${file}-${local.x}-${local.z}`);
      model.parent = shop;
      model.position.copyFrom(local);
      model.rotation.y = rotationY;
      model.scaling.setAll(scale);
      return model;
    };

    place("holiday/cabin-door.glb", new Vector3(0, 0, 1.95), 0);
    place("holiday/cabin-wall.glb", new Vector3(-2.15, 0, 1.95), 0);
    place("holiday/cabin-wall.glb", new Vector3(2.15, 0, 1.95), 0);
    place("holiday/cabin-wreath.glb", new Vector3(0, 0, -1.95), Math.PI);
    place("holiday/cabin-window.glb", new Vector3(-2.15, 0, -1.95), Math.PI);
    place("holiday/cabin-window.glb", new Vector3(2.15, 0, -1.95), Math.PI);
    for (const x of [-3.15, 3.15]) {
      for (const z of [-0.95, 1.05]) place("holiday/cabin-wall.glb", new Vector3(x, 0, z), x < 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    for (const x of [-1.75, 0, 1.75]) place("holiday/cabin-roof.glb", new Vector3(x, 2.46, 0), 0, 1.62);
    place("holiday/cabin-roof-point.glb", new Vector3(-3.12, 2.46, 0), 0, 1.62);
    place("holiday/cabin-roof-point.glb", new Vector3(3.12, 2.46, 0), Math.PI, 1.62);
    place("holiday/lantern.glb", new Vector3(-1.15, 2.25, -2.23), Math.PI, 1.25);
    place("holiday/lantern.glb", new Vector3(1.15, 2.25, -2.23), Math.PI, 1.25);
    place("custom/butcher-stall.glb", new Vector3(0, 0, -3.05), 0, 1);

    const checkout = this.instantiateStatic("custom/cash-register.glb", "butcher-checkout");
    checkout.position.set(-5.65, this.heightAt(-5.65, -6.3), -6.3);
    checkout.rotation.y = -Math.PI / 2;
    checkout.scaling.setAll(0.82);

    const doghouse = this.instantiateStatic("custom/doghouse.glb", "shepherd-doghouse");
    doghouse.position.set(-5.15, this.heightAt(-5.15, -8.45), -8.45);
    doghouse.rotation.y = -0.28;
    doghouse.scaling.setAll(0.84);

    for (let index = 0; index < 3; index += 1) {
      const coin = this.instantiateStatic("custom/coin.glb", `checkout-coin-${index}`);
      coin.position.set(-5.48 + index * 0.08, checkout.position.y + 1.7 + index * 0.025, -6.18 + index * 0.04);
      coin.rotation.set(Math.PI / 2, index * 0.35, 0);
      coin.scaling.setAll(0.2);
    }

    const signScale = this.state.quality === "低" ? 0.5 : this.state.quality === "中" ? 0.75 : 1;
    const signTexture = new DynamicTexture("butcher-sign-texture", { width: Math.round(512 * signScale), height: Math.round(192 * signScale) }, this.scene, true);
    const context = signTexture.getContext() as unknown as CanvasRenderingContext2D;
    context.scale(signScale, signScale);
    context.fillStyle = "#3a231b";
    context.fillRect(0, 0, 512, 192);
    context.strokeStyle = "#c49455";
    context.lineWidth = 12;
    context.strokeRect(9, 9, 494, 174);
    context.fillStyle = "#f4d89a";
    context.font = "900 58px serif";
    context.textAlign = "center";
    context.fillText("北 境 肉 舖", 256, 88);
    context.fillStyle = "#c8a66f";
    context.font = "700 24px sans-serif";
    context.fillText("THE LAST BUTCHER", 256, 137);
    signTexture.update();
    const signMaterial = new StandardMaterial("butcher-sign-material", this.scene);
    signMaterial.diffuseTexture = signTexture;
    signMaterial.emissiveColor = new Color3(0.35, 0.17, 0.07);
    signMaterial.backFaceCulling = false;
    const sign = MeshBuilder.CreatePlane("butcher-shop-sign", { width: 3.7, height: 1.3 }, this.scene);
    sign.position.set(-8, 3.05 + shop.position.y, -5.76);
    sign.rotation.y = Math.PI;
    sign.material = signMaterial;

    const warmWindow = new PBRMaterial("warm-window-material", this.scene);
    warmWindow.albedoColor = new Color3(0.86, 0.38, 0.08);
    warmWindow.emissiveColor = new Color3(1, 0.28, 0.03);
    warmWindow.emissiveIntensity = 2.2;
    warmWindow.roughness = 0.42;
    for (const x of [-9.75, -6.25]) {
      const glowPane = MeshBuilder.CreatePlane(`warm-window-${x}`, { width: 1.35, height: 1.35 }, this.scene);
      glowPane.position.set(x, 1.5 + shop.position.y, -5.74);
      glowPane.rotation.y = Math.PI;
      glowPane.material = warmWindow;
    }

    this.createCampfire(new Vector3(-11.8, 0, 1.8));
  }

  private buildPasture(): void {
    const fencePositions: Array<[number, number, number]> = [];
    for (let x = 3.1; x <= 14.9; x += 2) {
      fencePositions.push([x, -3.2, 0], [x, 10.3, 0]);
    }
    for (let z = -2.2; z <= 9.2; z += 2) {
      fencePositions.push([2.1, z, Math.PI / 2], [15.9, z, Math.PI / 2]);
    }
    for (const [x, z, rotation] of fencePositions) {
      const fence = this.instantiateStatic("fence.glb", `pasture-fence-${x}-${z}`);
      fence.position.set(x, this.heightAt(x, z), z);
      fence.rotation.y = rotation;
      fence.scaling.setAll(1.55);
    }
    const gate = this.instantiateStatic("fence-gate.glb", "pasture-gate");
    gate.position.set(5.2, this.heightAt(5.2, -3.2), -3.2);
    gate.scaling.setAll(1.55);
    const hayRing = this.createWorldRing("pasture-marker", PASTURE_CENTER, 3.3, new Color3(0.2, 0.75, 0.82));
    hayRing.visibility = 0.42;
  }

  private buildForest(): void {
    let seed = 73421;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const positions: Vector2[] = [];
    for (let index = 0; index < 42; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = 18 + random() * 8;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.78;
      if (z > 14 && Math.abs(x) < 7) continue;
      positions.push(new Vector2(x, z));
    }
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      const tree = this.instantiateStatic(index % 3 === 0 ? "pine-b.glb" : "pine-a.glb", `snow-pine-${index}`);
      tree.position.set(position.x, this.heightAt(position.x, position.y), position.y);
      const scale = 1.5 + random() * 1.7;
      tree.scaling.set(scale * (0.92 + random() * 0.16), scale, scale * (0.92 + random() * 0.16));
      tree.rotation.y = random() * Math.PI * 2;
      if (index % 4 === 0) {
        const rock = this.instantiateStatic("rock.glb", `forest-rock-${index}`);
        rock.position.set(position.x + 1.4, this.heightAt(position.x + 1.4, position.y - 0.7), position.y - 0.7);
        rock.rotation.y = random() * Math.PI;
        rock.scaling.setAll(1.2 + random());
      }
    }
  }

  private buildWayfinding(): void {
    const pathMaterial = new PBRMaterial("trampled-snow", this.scene);
    pathMaterial.albedoColor = new Color3(0.42, 0.52, 0.55);
    pathMaterial.roughness = 1;
    const points = [new Vector3(-8, 0, -7.1), new Vector3(-5.3, 0, -4.5), new Vector3(-1.5, 0, -1.4), new Vector3(3.2, 0, 1.5), new Vector3(7, 0, 3.5)];
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const midpoint = start.add(end).scale(0.5);
      const length = Vector3.Distance(start, end);
      const path = MeshBuilder.CreateCapsule(`snow-path-${index}`, { height: length, radius: 0.72, tessellation: 10 }, this.scene);
      path.scaling.z = 0.12;
      path.rotation.x = Math.PI / 2;
      path.rotation.y = Math.atan2(end.x - start.x, end.z - start.z);
      path.position.set(midpoint.x, this.heightAt(midpoint.x, midpoint.z) + 0.025, midpoint.z);
      path.material = pathMaterial;
      path.receiveShadows = Boolean(this.shadows);
    }
  }

  private createActors(): void {
    const protagonist = PROTAGONISTS.find((entry) => entry.id === this.state.protagonistId)!;
    this.player = this.instantiateActor(protagonist.model, `player-${protagonist.id}`, new Vector3(-0.5, 0, -1.5), 1);
    this.player.root.position.y = this.heightAt(this.player.root.position.x, this.player.root.position.z);
    this.playAnimation(this.player, "idle", true);
    this.addActorShadows(this.player);

    this.cow = {
      ...this.instantiateActor("cow.glb", "pasture-cow", PASTURE_CENTER, 0.39),
      hp: 3,
      maxHp: 3,
      meatYield: 3,
      strong: false,
      alive: true,
      isMoving: false,
      behaviorTimer: 4,
      roamTarget: PASTURE_CENTER.clone(),
      pastureCenter: PASTURE_CENTER.clone(),
    };
    this.cow.root.position.y = this.heightAt(this.cow.root.position.x, this.cow.root.position.z);
    this.cow.root.rotation.y = -0.7;
    this.playAnimation(this.cow, "Eating", true);
    this.addActorShadows(this.cow);

    const anonymous: CustomerActor = {
      ...this.instantiateActor("customer.glb", "wandering-customer", new Vector3(-18, 0, -10), 0.88),
      phase: "hidden",
      timer: 0,
      identity: null,
    };
    this.customerVariants.set("anonymous", anonymous);
    for (const definition of NAMED_CUSTOMERS) {
      const actor: CustomerActor = {
        ...this.instantiateActor(definition.model, `customer-${definition.id}`, new Vector3(-18, 0, -10), 1),
        phase: "hidden",
        timer: 0,
        identity: definition.id,
      };
      this.customerVariants.set(definition.id, actor);
    }
    for (const actor of this.customerVariants.values()) {
      actor.root.setEnabled(false);
      this.addActorShadows(actor);
    }
    this.customer = anonymous;
  }

  private createTowers(): void {
    const towerColors: Record<TowerId, Color3> = {
      ballista: new Color3(0.16, 0.48, 0.55),
      frost: new Color3(0.25, 0.72, 0.94),
      cannon: new Color3(0.72, 0.27, 0.15),
    };
    for (const definition of TOWERS) {
      const id = definition.id;
      const position = TOWER_POSITIONS[id];
      const pad = MeshBuilder.CreateCylinder(`${id}-tower-build-pad`, { diameter: 3.1, height: 0.16, tessellation: 32 }, this.scene);
      pad.position.set(position.x, this.heightAt(position.x, position.z) + 0.04, position.z);
      const padMaterial = new PBRMaterial(`${id}-tower-pad-material`, this.scene);
      padMaterial.albedoColor = towerColors[id];
      padMaterial.emissiveColor = towerColors[id].scale(0.7);
      padMaterial.emissiveIntensity = 0.65;
      padMaterial.metallic = 0.2;
      padMaterial.roughness = 0.45;
      padMaterial.alpha = 0.72;
      pad.material = padMaterial;

      const towerFile: Record<TowerId, string> = {
        ballista: "custom/tower-ballista.glb",
        frost: "custom/tower-frost.glb",
        cannon: "custom/tower-cannon.glb",
      };
      const actor = this.instantiateActor(
        towerFile[id],
        `${id}-custom-tower`,
        new Vector3(position.x, this.heightAt(position.x, position.z), position.z),
        1,
      );
      const weapon = actor.root.getChildTransformNodes(false).find((node) => node.name.includes("AimPivot")) ?? actor.root;
      weapon.rotationQuaternion = null;
      actor.root.setEnabled(this.state.towers[id] > 0);
      pad.setEnabled(this.state.towers[id] === 0);
      this.towerActors.set(id, { ...actor, id, weapon, pad, cooldown: 0, animationLodPaused: false });
    }
  }

  private createMeatDisplays(): void {
    for (let index = 0; index < 6; index += 1) {
      const carried = this.createMeatPiece(`carried-meat-${index}`, 0.36);
      carried.parent = this.player.root;
      carried.position.set((index % 2 - 0.5) * 0.46, 1.05 + Math.floor(index / 2) * 0.27, -0.32 - Math.floor(index / 2) * 0.05);
      carried.rotation.set(0.15, (index % 2) * 0.45 - 0.22, Math.PI / 2);
      carried.setEnabled(false);
      this.carriedVisuals.push(carried);

      const stock = this.createMeatPiece(`stall-meat-${index}`, 0.44);
      stock.position.set(-9.55 + (index % 3) * 1.55, this.heightAt(-8, -6.85) + 1.2 + Math.floor(index / 3) * 0.35, -6.85);
      stock.rotation.set(0.05, 0.25 * index, Math.PI / 2);
      stock.setEnabled(false);
      this.stockVisuals.push(stock);
    }
    this.updateMeatVisuals();
  }

  private update(dt: number): void {
    this.elapsed += dt;
    this.updateAtmosphere(dt);
    if (!this.player) return;
    this.updateCamera(dt);
    this.updateDrops(dt);
    this.updateCustomer(dt);
    this.updateCow(dt);
    this.updateStaff(dt);
    if (!this.started || this.endShown) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    for (const tower of this.towerActors.values()) tower.cooldown = Math.max(0, tower.cooldown - dt);
    this.handleMovement(dt);
    this.updatePlayerAttack(dt);
    const attackRequested = this.input.consumeAttack() || this.state.weapon === "smg" && this.input.isAttackHeld;
    if (attackRequested) this.performAttack();
    if (this.input.consumeBuild()) this.buyOrUpgradeTower("ballista");
    if (this.input.consumeWave()) this.tryStartWave();
    this.autoDeposit();
    this.updateWave(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.processQuests();
    this.updateContextPrompt();
    this.statsTimer += dt;
    if (this.statsTimer >= 0.5) {
      this.statsTimer = 0;
      this.state.currentFps = this.engine.getFps();
      this.state.drawCalls = this.instrumentation.drawCallsCounter.current;
      (window as Window & { __stormDebug?: unknown }).__stormDebug = {
        fps: Math.round(this.state.currentFps),
        drawCalls: this.state.drawCalls,
        activeMeshes: this.scene.getActiveMeshes().length,
        totalMeshes: this.scene.meshes.length,
        quality: this.state.quality,
        targetFps: 30,
        renderPixelRatio: this.renderPixelRatio,
        performanceTier: this.performanceTier,
        shadowMode: this.shadows ? "realtime" : "blob",
        fogDensity: this.scene.fogDensity,
        wave: this.state.wave,
        enemies: this.state.enemiesRemaining,
        playerPosition: { x: Number(this.player.root.position.x.toFixed(2)), z: Number(this.player.root.position.z.toFixed(2)) },
        hardwareInstancing: true,
        waveMetrics: {
          stockAtStart: this.waveStartedStock,
          playerKills: this.wavePlayerKills,
          towerKills: this.waveTowerKills,
          seconds: this.state.waveActive ? Math.round((performance.now() - this.waveStartTime) / 1000) : 0,
        },
      };
    }
    this.uiUpdateTimer += dt;
    if (this.state.quality !== "低" || this.uiUpdateTimer >= 0.1) {
      this.uiUpdateTimer = 0;
      this.ui.update(this.state);
    }
  }

  private handleMovement(dt: number): void {
    const movement = this.input.movement;
    const moving = movement.lengthSquared() > 0.015;
    if (moving) {
      const direction = new Vector3(movement.x, 0, movement.y).normalize();
      const next = this.player.root.position.add(direction.scale(4.15 * dt));
      next.x = Math.max(-24, Math.min(24, next.x));
      next.z = Math.max(-20, Math.min(20, next.z));
      next.y = this.heightAt(next.x, next.z);
      this.player.root.position.copyFrom(next);
      if (!this.state.stats.pastureVisited && Vector3.Distance(next, PASTURE_CENTER) < 5.5) this.state.stats.pastureVisited = true;
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.player.root.rotation.y = this.lerpAngle(this.player.root.rotation.y, targetRotation, Math.min(1, dt * 13));
      if (!this.isAttackAnimation(this.player)) this.playAnimation(this.player, "run", true);
    } else if (this.attackCooldown <= 0) {
      if (!this.isAttackAnimation(this.player)) this.playAnimation(this.player, "idle", true);
    }
  }

  private performAttack(): void {
    if (this.attackCooldown > 0) return;
    this.attackCount += 1;
    const renderCanvas = this.engine.getRenderingCanvas();
    if (renderCanvas) renderCanvas.dataset.lastAttack = Math.round(performance.now()).toString();
    const weapon = this.state.weapon;
    const impactAt = weapon === "smg" ? 8 / 24 : 13 / 24;
    const recoveryAt = weapon === "smg" ? 18 / 24 : 24 / 24;
    this.attackCooldown = recoveryAt;
    this.pendingPlayerAttack = { weapon, elapsed: 0, impactAt, recoveryAt, resolved: false };
    this.playAnimation(this.player, weapon === "smg" ? "attack_ranged" : "attack_melee", false, true);
  }

  private updatePlayerAttack(dt: number): void {
    const attack = this.pendingPlayerAttack;
    if (!attack) return;
    attack.elapsed += dt;
    if (!attack.resolved && attack.elapsed >= attack.impactAt) {
      attack.resolved = true;
      this.resolvePlayerAttack(attack.weapon);
    }
    if (attack.elapsed >= attack.recoveryAt) this.pendingPlayerAttack = undefined;
  }

  private playerAttackPhase(): "idle" | "anticipation" | "impact" | "recovery" {
    const attack = this.pendingPlayerAttack;
    if (!attack) return "idle";
    if (!attack.resolved) return "anticipation";
    if (attack.elapsed <= attack.impactAt + 1 / 24) return "impact";
    return "recovery";
  }

  private resolvePlayerAttack(weapon: WeaponId): void {
    let hit = false;
    if (weapon === "smg") {
      if (this.muzzleFlash) {
        this.muzzleFlash.setEnabled(true);
        window.setTimeout(() => this.muzzleFlash?.setEnabled(false), 70);
      }
      const target = this.findNearestZombie(this.player.root.position, 13) ?? this.findNearestCow(this.player.root.position, 16);
      if (target && "type" in target) {
        for (let shot = 0; shot < 3; shot += 1) this.damageZombie(target, this.playerWeaponDamage(2), "player");
        hit = true;
      } else if (target) {
        for (let shot = 0; shot < 3; shot += 1) this.damageCow(target, this.playerWeaponDamage(2));
        hit = true;
      }
    } else if (weapon === "axe") {
      const targets = this.zombies.filter((zombie) => zombie.alive && Vector3.Distance(zombie.root.position, this.player.root.position) < 3.5);
      for (const zombie of targets) this.damageZombie(zombie, this.playerWeaponDamage(3), "player");
      const cows = this.allCows().filter((cow) => cow.alive && Vector3.Distance(cow.root.position, this.player.root.position) < 3.5);
      for (const cow of cows) this.damageCow(cow, this.playerWeaponDamage(3));
      this.createAttackRing(new Color3(0.95, 0.55, 0.24));
      hit = targets.length + cows.length > 0;
    } else {
      const nearestZombie = this.findNearestZombie(this.player.root.position, 2.7);
      if (nearestZombie) {
        this.damageZombie(nearestZombie, this.playerWeaponDamage(2), "player");
        hit = true;
      } else {
        const nearestCow = this.findNearestCow(this.player.root.position, 2.8);
        if (nearestCow) {
        this.damageCow(nearestCow, this.playerWeaponDamage(2));
          hit = true;
        }
      }
    }
    if (!hit) this.ui.toast("揮砍落空——動作會完整收勢。", "ice");
  }

  private playerWeaponDamage(base: number): number {
    return base + (this.state.protagonistId === "vet_sniper" ? 1 : 0);
  }

  private damageCow(cow: CowActor, damage: number): void {
    if (!cow.alive) return;
    cow.hp -= damage;
    this.damageEventCount += 1;
    this.lastDamageAt = this.elapsed;
    this.playAnimation(cow, cow.hp > 0 ? "Idle_HitReact1" : "Death", false);
    if (cow.hp <= 0) this.killCow(cow);
    else this.ui.toast(`${cow.strong ? "強化牛" : "牛隻"}生命 ${cow.hp} / ${cow.maxHp}`, "danger");
  }

  private killCow(cow: CowActor): void {
    if (!cow.alive) return;
    cow.alive = false;
    this.state.stats.cowsKilled += 1;
    this.playAnimation(cow, "Death", false);
    this.ui.toast(`${cow.strong ? "強化牛" : "牛隻"}倒下 · 掉落 ${cow.meatYield} 份肉`, "warm");
    for (let index = 0; index < cow.meatYield; index += 1) {
      const root = this.createMeatPiece(`meat-drop-${this.elapsed}-${index}`, 0.55);
      const angle = index / cow.meatYield * Math.PI * 2 + 0.3;
      root.position.set(cow.root.position.x + Math.cos(angle) * 0.9, cow.root.position.y + 0.45, cow.root.position.z + Math.sin(angle) * 0.9);
      root.rotation.set(0.2, angle, Math.PI / 2);
      this.drops.push({ root, baseY: root.position.y, phase: index * 2.1, expiresAt: this.elapsed + 45 + index * 0.6 });
    }
    saveState(this.state);
    window.setTimeout(() => cow.root.setEnabled(false), 1100);
    window.setTimeout(() => {
      const center = cow.pastureCenter;
      cow.root.position.set(center.x + 1.2, this.heightAt(center.x + 1.2, center.z - 1), center.z - 1);
      cow.root.setEnabled(true);
      cow.hp = cow.maxHp;
      cow.alive = true;
      cow.behaviorTimer = 3;
      this.playAnimation(cow, "Eating", true);
      this.ui.toast(`${cow.strong ? "第二牧場的強化牛" : "牧場牛隻"}已重返圍欄。`, "ice");
    }, cow.strong ? 12000 : 7000);
  }

  private updateDrops(dt: number): void {
    for (let index = this.drops.length - 1; index >= 0; index -= 1) {
      const drop = this.drops[index];
      if (drop.expiresAt <= this.elapsed) {
        drop.root.dispose(false, false);
        this.drops.splice(index, 1);
        continue;
      }
      drop.phase += dt * 2.7;
      drop.root.position.y = drop.baseY + Math.sin(drop.phase) * 0.12;
      drop.root.rotation.y += dt * 0.7;
      if (!this.started || this.state.carriedMeat >= 6 || Vector3.Distance(drop.root.position, this.player.root.position) > 1.55) continue;
      drop.root.dispose(false, false);
      this.drops.splice(index, 1);
      this.state.carriedMeat += 1;
      this.state.stats.meatCollected += 1;
      this.updateMeatVisuals();
      this.ui.toast(`肉品裝袋 · ${this.state.carriedMeat} / 6`, "warm");
    }
  }

  private autoDeposit(): void {
    if (this.state.carriedMeat <= 0 || Vector3.Distance(this.player.root.position, STALL_POSITION) > 2.65) return;
    const available = this.state.stallLevel * 6 - this.state.displayedMeat;
    const deposited = Math.min(available, this.state.carriedMeat);
    if (deposited <= 0) return;
    this.state.carriedMeat -= deposited;
    this.state.displayedMeat += deposited;
    this.state.stats.meatDeposited += deposited;
    this.updateMeatVisuals();
    this.customerCooldown = Math.min(this.customerCooldown, 0.6);
    this.ui.toast(`${deposited} 份肉品已陳列，顧客正在前來。`, "warm");
  }

  private updateCustomer(dt: number): void {
    if (!this.customer) return;
    if (this.state.waveActive) return;
    if (this.customer.phase === "hidden") {
      this.customerCooldown -= dt;
      if (this.started && this.state.displayedMeat > 0 && this.customerCooldown <= 0) this.spawnCustomer();
      return;
    }
    if (this.customer.phase === "arriving") {
      if (this.moveActorToward(this.customer, STALL_POSITION.add(new Vector3(0, 0, 1.3)), 2.25, dt)) {
        this.customer.phase = "buying";
        this.customer.timer = this.state.employees.cashier >= 2 ? 0.28 : this.state.employees.cashier >= 1 ? 0.38 : 1.15;
        this.playAnimation(this.customer, "Idle", true);
      }
      return;
    }
    if (this.customer.phase === "buying") {
      this.customer.timer -= dt;
      if (this.customer.timer <= 0) {
        if (this.state.displayedMeat > 0) {
          this.state.displayedMeat -= 1;
          const income = this.meatSaleIncome();
          creditIncome(this.state, income);
          this.state.stats.sales += 1;
          if (this.customer.identity) this.addCustomerAffinity(this.customer.identity);
          this.updateMeatVisuals();
          saveState(this.state);
          const customer = NAMED_CUSTOMERS.find((entry) => entry.id === this.customer.identity);
          this.ui.toast(`${customer ? customer.name : "交易"}結帳 · 收入 ✦ ${income}`, "warm");
        }
        this.customer.phase = "leaving";
        this.playAnimation(this.customer, "Walk", true);
      }
      return;
    }
    if (this.moveActorToward(this.customer, new Vector3(-18, 0, -10), 2.5, dt)) {
      this.customer.root.setEnabled(false);
      this.customer.phase = "hidden";
      this.customerCooldown = this.state.employees.cashier >= 2 ? 1.9 : 2.2;
    }
  }

  private spawnCustomer(): void {
    this.customer.root.setEnabled(false);
    const familiarCount = NAMED_CUSTOMERS.filter((entry) => this.state.customerAffinity[entry.id] >= 6).length;
    const weights: Array<[NamedCustomerId | "anonymous", number]> = [
      ["anonymous", Math.max(0.35, 0.55 - familiarCount * 0.04)],
      ...NAMED_CUSTOMERS.map((entry) => [entry.id, entry.weight + (this.state.customerAffinity[entry.id] >= 6 ? 0.04 : 0)] as [NamedCustomerId, number]),
    ];
    const total = weights.reduce((sum, entry) => sum + entry[1], 0);
    let draw = Math.random() * total;
    let selected: NamedCustomerId | "anonymous" = "anonymous";
    for (const [id, weight] of weights) {
      draw -= weight;
      if (draw <= 0) {
        selected = id;
        break;
      }
    }
    this.customer = this.customerVariants.get(selected)!;
    this.customer.root.position.set(-18, this.heightAt(-18, -10), -10);
    this.customer.root.setEnabled(true);
    this.customer.phase = "arriving";
    this.playAnimation(this.customer, "Walk", true);
    const named = this.customer.identity ? NAMED_CUSTOMERS.find((entry) => entry.id === this.customer.identity) : undefined;
    this.ui.toast(named ? `${named.name} · ${named.role}：「${named.arrivalLine}」` : "遠方的旅人正朝肉舖走來。", "ice");
  }

  private meatSaleIncome(): number {
    const cashierBonus = this.state.employees.cashier >= 2 ? 8 : this.state.employees.cashier >= 1 ? 5 : 0;
    let income = 20 + cashierBonus + (this.state.pasture2Unlocked ? 5 : 0);
    if (this.state.protagonistId === "butcher_matron") income = Math.floor(income * 1.1);
    if (this.state.customerAffinity.lao_zhou >= 6) income += 1;
    if (this.state.customerAffinity.kid_bao >= 6 && Math.random() < 0.05) {
      income += 5;
      this.ui.toast("小包把扣子換成真正的硬幣 · 小費 ✦ 5", "warm");
    }
    return income;
  }

  private addCustomerAffinity(id: NamedCustomerId): void {
    if (this.state.customerAffinityWave !== this.state.wave) {
      this.state.customerAffinityWave = this.state.wave;
      this.state.customerAffinityGained = { lao_zhou: 0, nurse_lin: 0, kid_bao: 0, scout_he: 0 };
    }
    let requested = 1;
    if (id === "lao_zhou" && this.state.employees.cashier >= 1) requested += 1;
    if (id === "nurse_lin" && (this.stockedAtCycleStart || this.state.wave === 0 && this.state.displayedMeat >= 1)) requested += 1;
    if (id === "kid_bao" && this.state.protagonistId === "butcher_matron") requested += 1;
    if (id === "scout_he" && (this.state.weapon !== "machete" || Object.values(this.state.towers).some((level) => level > 0))) requested += 1;
    const allowance = Math.max(0, 2 - this.state.customerAffinityGained[id]);
    const gain = Math.min(requested, allowance, 10 - this.state.customerAffinity[id]);
    if (gain <= 0) return;
    this.state.customerAffinity[id] += gain;
    this.state.customerAffinityGained[id] += gain;
    const customer = NAMED_CUSTOMERS.find((entry) => entry.id === id)!;
    for (const threshold of [3, 6, 10] as const) {
      if (this.state.customerAffinity[id] < threshold) continue;
      const rewardId = `aff_${id}_${threshold}`;
      if (this.state.customerRewardsClaimed.includes(rewardId)) continue;
      this.state.customerRewardsClaimed.push(rewardId);
      if (threshold === 3) {
        creditIncome(this.state, 40);
        this.ui.toast(`${customer.name}開始認得這間店了 · ✦ 40`, "warm");
      } else if (threshold === 6) {
        this.ui.toast(`${customer.name}成了真正的常客 · ${customer.affinityBonus}`, "warm");
      } else {
        creditIncome(this.state, 120);
        if (!this.state.quest.unlocks.includes(customer.friendMark)) this.state.quest.unlocks.push(customer.friendMark);
        this.ui.toast(`${customer.name}把命也算在這盞燈上 · ✦ 120 · ${customer.friendMarkName}`, "warm");
      }
    }
  }

  private updateCow(dt: number): void {
    for (const cow of this.allCows()) {
      if (!cow.alive) continue;
      cow.behaviorTimer -= dt;
      if (cow.behaviorTimer <= 0) {
        cow.isMoving = !cow.isMoving;
        cow.behaviorTimer = cow.isMoving ? 3 + Math.sin(this.elapsed) : 4.5 + Math.cos(this.elapsed);
        if (cow.isMoving) {
          const angle = this.elapsed * (cow.strong ? 1.23 : 1.7);
          cow.roamTarget.set(cow.pastureCenter.x + Math.cos(angle) * 3.1, 0, cow.pastureCenter.z + Math.sin(angle * 1.31) * 2.6);
          this.playAnimation(cow, "Walk", true);
        } else {
          this.playAnimation(cow, "Eating", true);
        }
      }
      if (cow.isMoving) this.moveActorToward(cow, cow.roamTarget, cow.strong ? 0.62 : 0.75, dt);
    }
  }

  private buyWeapon(id: WeaponId): void {
    const item = WEAPONS.find((weapon) => weapon.id === id);
    if (!item || id === "machete" || this.state.weapon === id || this.state.waveActive) return;
    const unlockChapter = id === "axe" ? SHOP_UNLOCK_CHAPTER.axe : SHOP_UNLOCK_CHAPTER.smg;
    if (!this.requireChapter(unlockChapter)) return;
    if (id === "smg" && this.state.weapon === "machete") {
      this.ui.toast("先掌握迴旋斧，才能購買衝鋒槍。", "danger");
      return;
    }
    if (this.state.money < item.price) {
      this.ui.toast(`購買${item.name}尚缺 ✦ ${item.price - this.state.money}`, "danger");
      return;
    }
    this.state.money -= item.price;
    this.state.weapon = id;
    this.createWeaponModel();
    saveState(this.state);
    this.ui.toast(`武器已升級：${item.name}`, "warm");
    this.processQuests();
  }

  private hireEmployee(id: EmployeeId): void {
    const item = EMPLOYEES.find((employee) => employee.id === id);
    const level = this.state.employees[id];
    if (!item || level >= 2 || this.state.waveActive) return;
    const unlockChapter = level === 0 ? SHOP_UNLOCK_CHAPTER.employeeShop : SHOP_UNLOCK_CHAPTER.employeeUpgrade;
    if (!this.requireChapter(unlockChapter)) return;
    const price = level === 0 ? item.price : item.upgradePrice ?? 0;
    if (this.state.money < price) {
      this.ui.toast(`${level === 0 ? "雇用" : "升級"}${item.name}尚缺 ✦ ${price - this.state.money}`, "danger");
      return;
    }
    this.state.money -= price;
    this.state.employees[id] = level === 0 ? 1 : 2;
    if (level === 0) this.createStaff(id);
    saveState(this.state);
    this.ui.toast(level === 0 ? `${item.name}已加入肉舖。自動化開始運轉。` : `${item.name}已升至 Lv2 · ${item.upgradeDescription}`, "warm");
    this.processQuests();
  }

  private unlockPasture2(): void {
    if (this.state.pasture2Unlocked || this.state.waveActive) return;
    if (!this.requireChapter(SHOP_UNLOCK_CHAPTER.pasture2)) return;
    if (this.state.money < 260) {
      this.ui.toast(`炸開第二牧場尚缺 ✦ ${260 - this.state.money}`, "danger");
      return;
    }
    this.state.money -= 260;
    this.state.pasture2Unlocked = true;
    this.createStrongCow();
    this.createExplosion(PASTURE_2_CENTER.add(new Vector3(-3.5, 0, 0)), 4.2);
    saveState(this.state);
    this.ui.toast("林線已炸開！第二牧場出現強化牛。", "warm");
    this.processQuests();
  }

  private buyOrUpgradeTower(id: TowerId): void {
    if (this.state.waveActive) {
      this.ui.toast("夜襲中無法施工。", "danger");
      return;
    }
    const tower = this.towerActors.get(id);
    const definition = TOWERS.find((entry) => entry.id === id);
    if (!tower || !definition) return;
    const level = this.state.towers[id];
    if (level >= 3) return;
    const unlockChapter = level === 0 ? SHOP_UNLOCK_CHAPTER.defenseShop : SHOP_UNLOCK_CHAPTER.towerUpgrade;
    if (!this.requireChapter(unlockChapter)) return;
    const cost = towerCostForState(this.state, id, level);
    if (this.state.money < cost) {
      this.ui.toast(`${level === 0 ? "建造" : "升級"}${definition.name}尚缺 ✦ ${cost - this.state.money}`, "danger");
      return;
    }
    this.state.money -= cost;
    this.state.towers[id] = level + 1;
    this.state.towerBuilt = this.state.towers.ballista > 0;
    tower.root.setEnabled(true);
    tower.pad.setEnabled(false);
    tower.root.scaling.setAll(level === 0 ? 0.01 : 1);
    const animateBuild = (): void => {
      const current = tower.root.scaling.x;
      const next = Math.min(1, current + 0.085);
      tower.root.scaling.setAll(next + Math.sin(next * Math.PI) * 0.08);
      if (next < 1) requestAnimationFrame(animateBuild);
      else tower.root.scaling.setAll(1 + this.state.towers[id] * 0.025);
    };
    animateBuild();
    this.createAttackRing(id === "frost" ? new Color3(0.25, 0.76, 1) : id === "cannon" ? new Color3(1, 0.31, 0.08) : new Color3(0.86, 0.66, 0.32), tower.root.position);
    saveState(this.state);
    this.ui.toast(`${definition.name}${level === 0 ? "完工" : `升至 Lv.${level + 1}`}。`, "warm");
    this.processQuests();
  }

  private syncUnlockedContent(): void {
    if (this.state.pasture2Unlocked) this.createStrongCow();
    for (const id of Object.keys(this.state.employees) as EmployeeId[]) {
      if (this.state.employees[id]) this.createStaff(id);
    }
  }

  private createStrongCow(): void {
    if (this.strongCow) return;
    for (const node of this.scene.transformNodes) {
      if ((node.name.startsWith("snow-pine-") || node.name.startsWith("forest-rock-")) && Vector3.Distance(node.position, PASTURE_2_CENTER) < 6.2) node.setEnabled(false);
    }
    const fenceOffsets: Array<[number, number, number]> = [];
    for (let offset = -4; offset <= 4; offset += 2) {
      fenceOffsets.push([offset, -4.2, 0], [offset, 4.2, 0], [-5, offset, Math.PI / 2], [5, offset, Math.PI / 2]);
    }
    for (const [x, z, rotation] of fenceOffsets) {
      const fence = this.instantiateStatic("fence.glb", `pasture-2-fence-${x}-${z}`);
      const px = PASTURE_2_CENTER.x + x;
      const pz = PASTURE_2_CENTER.z + z;
      fence.position.set(px, this.heightAt(px, pz), pz);
      fence.rotation.y = rotation;
      fence.scaling.setAll(1.25);
    }
    this.createWorldRing("pasture-2-unlocked-ring", PASTURE_2_CENTER, 9.2, new Color3(0.78, 0.29, 0.11));
    this.strongCow = {
      ...this.instantiateActor("cow.glb", "pasture-2-strong-cow", PASTURE_2_CENTER, 0.5),
      hp: 9,
      maxHp: 9,
      meatYield: 6,
      strong: true,
      alive: true,
      isMoving: false,
      behaviorTimer: 3.5,
      roamTarget: PASTURE_2_CENTER.clone(),
      pastureCenter: PASTURE_2_CENTER.clone(),
    };
    this.strongCow.root.position.y = this.heightAt(PASTURE_2_CENTER.x, PASTURE_2_CENTER.z);
    this.playAnimation(this.strongCow, "Eating", true);
    this.addActorShadows(this.strongCow);
    const hornMaterial = new PBRMaterial("strong-cow-horn-material", this.scene);
    hornMaterial.albedoColor = new Color3(0.88, 0.72, 0.45);
    hornMaterial.roughness = 0.8;
    for (const side of [-1, 1]) {
      const horn = MeshBuilder.CreateCylinder(`strong-cow-horn-${side}`, { height: 1.7, diameterTop: 0, diameterBottom: 0.34, tessellation: 8 }, this.scene);
      horn.parent = this.strongCow.root;
      horn.position.set(side * 1.05, 3.3, 1.45);
      horn.rotation.z = side * 0.85;
      horn.material = hornMaterial;
      this.castShadows(horn);
    }
    const collar = MeshBuilder.CreateTorus("strong-cow-ember-collar", { diameter: 2.4, thickness: 0.16, tessellation: 24 }, this.scene);
    collar.parent = this.strongCow.root;
    collar.position.y = 2.2;
    collar.rotation.x = Math.PI / 2;
    const collarMaterial = new PBRMaterial("strong-cow-collar-material", this.scene);
    collarMaterial.albedoColor = new Color3(0.62, 0.16, 0.08);
    collarMaterial.emissiveColor = new Color3(0.36, 0.04, 0.01);
    collar.material = collarMaterial;
  }

  private createStaff(id: EmployeeId): void {
    if (this.staff.has(id)) return;
    let staff: StaffActor;
    if (id === "dog") {
      staff = { ...this.createProceduralDog(), id, timer: 0, patrolIndex: 0 };
    } else {
      const position = id === "hunter" ? new Vector3(5.5, 0, 1) : STALL_POSITION.add(new Vector3(1.7, 0, 1));
      const actor = this.instantiateActor(id === "hunter" ? "survivor.glb" : "customer.glb", `staff-${id}`, position, id === "hunter" ? 0.82 : 0.85);
      actor.root.position.y = this.heightAt(position.x, position.z);
      this.playAnimation(actor, "Idle", true);
      staff = { ...actor, id, timer: 0, patrolIndex: 0 };
    }
    this.addActorShadows(staff);
    this.staff.set(id, staff);
  }

  private createProceduralDog(): Actor {
    const root = new TransformNode("staff-shepherd-dog", this.scene);
    root.position.set(-5.8, this.heightAt(-5.8, -5.5), -5.5);
    const fur = new PBRMaterial("dog-fur-material", this.scene);
    fur.albedoColor = new Color3(0.18, 0.13, 0.09);
    fur.roughness = 0.95;
    const tan = new PBRMaterial("dog-tan-material", this.scene);
    tan.albedoColor = new Color3(0.68, 0.42, 0.2);
    tan.roughness = 0.9;
    const body = MeshBuilder.CreateCapsule("dog-body", { height: 1.55, radius: 0.42, tessellation: 8 }, this.scene);
    body.parent = root;
    body.rotation.x = Math.PI / 2;
    body.position.y = 0.72;
    body.material = fur;
    const head = MeshBuilder.CreateIcoSphere("dog-head", { radius: 0.43, subdivisions: 1 }, this.scene);
    head.parent = root;
    head.position.set(0, 0.95, 0.82);
    head.material = tan;
    const muzzle = MeshBuilder.CreateBox("dog-muzzle", { width: 0.38, height: 0.25, depth: 0.48 }, this.scene);
    muzzle.parent = root;
    muzzle.position.set(0, 0.84, 1.16);
    muzzle.material = tan;
    for (const side of [-1, 1]) {
      const ear = MeshBuilder.CreateCylinder(`dog-ear-${side}`, { height: 0.55, diameterTop: 0, diameterBottom: 0.28, tessellation: 5 }, this.scene);
      ear.parent = root;
      ear.position.set(side * 0.25, 1.35, 0.77);
      ear.material = fur;
      for (const z of [-0.45, 0.45]) {
        const leg = MeshBuilder.CreateCylinder(`dog-leg-${side}-${z}`, { height: 0.68, diameter: 0.16, tessellation: 6 }, this.scene);
        leg.parent = root;
        leg.position.set(side * 0.28, 0.34, z);
        leg.material = tan;
        this.castShadows(leg);
      }
      this.castShadows(ear);
    }
    const tail = MeshBuilder.CreateCylinder("dog-tail", { height: 0.9, diameter: 0.14, tessellation: 6 }, this.scene);
    tail.parent = root;
    tail.position.set(0, 0.95, -0.9);
    tail.rotation.x = -0.75;
    tail.material = fur;
    this.castShadows(body);
    this.castShadows(head);
    return { root, meshForwardNode: root, meshForwardAxis: Vector3.Forward(), animations: [], currentAnimation: "" };
  }

  private updateStaff(dt: number): void {
    if (!this.started) return;
    const hunter = this.staff.get("hunter");
    if (hunter) {
      hunter.timer = Math.max(0, hunter.timer - dt);
      const hunterLevel = this.state.employees.hunter;
      const target = this.allCows().find((cow) => cow.alive);
      if (target) {
        const distance = Vector3.Distance(hunter.root.position, target.root.position);
        if (distance > 2.35) {
          this.moveActorToward(hunter, target.root.position, hunterLevel >= 2 ? 2.4 : 2.15, dt);
          this.playAnimation(hunter, "Run", true);
        } else if (hunter.timer <= 0) {
          hunter.timer = hunterLevel >= 2 ? 1.1 : 1.45;
          this.playAnimation(hunter, "Slash", false);
          this.damageCow(target, 1);
        }
      }
    }
    const cashier = this.staff.get("cashier");
    if (cashier) {
      const post = STALL_POSITION.add(new Vector3(1.7, 0, 1));
      if (Vector3.Distance(cashier.root.position, post) > 0.35) this.moveActorToward(cashier, post, 1.7, dt);
      else this.playAnimation(cashier, "Idle", true);
    }
    const dog = this.staff.get("dog");
    if (dog) {
      const capacity = this.state.stallLevel * 6;
      const dogLevel = this.state.employees.dog;
      const drop = dogLevel >= 2
        ? this.drops.reduce<MeatDrop | undefined>((oldest, candidate) => !oldest || candidate.expiresAt < oldest.expiresAt ? candidate : oldest, undefined)
        : this.drops[0];
      if (drop && this.state.displayedMeat < capacity) {
        if (this.moveActorToward(dog, drop.root.position, dogLevel >= 2 ? 3.72 : 3.1, dt)) {
          const picked = [drop];
          if (dogLevel >= 2 && capacity - this.state.displayedMeat >= 2) {
            const second = this.drops
              .filter((candidate) => candidate !== drop && Vector3.Distance(candidate.root.position, drop.root.position) <= 2.5)
              .sort((a, b) => a.expiresAt - b.expiresAt)[0];
            if (second) picked.push(second);
          }
          for (const item of picked) {
            item.root.dispose(false, false);
            const index = this.drops.indexOf(item);
            if (index >= 0) this.drops.splice(index, 1);
          }
          this.state.displayedMeat += picked.length;
          this.state.stats.meatCollected += picked.length;
          this.state.stats.meatDeposited += picked.length;
          this.updateMeatVisuals();
          saveState(this.state);
        }
      } else {
        const post = STALL_POSITION.add(new Vector3(2.5, 0, -0.4));
        if (Vector3.Distance(dog.root.position, post) > 0.4) this.moveActorToward(dog, post, dogLevel >= 2 ? 2.82 : 2.35, dt);
      }
    }
  }

  private tryStartWave(): void {
    if (!Object.values(this.state.towers).some((level) => level > 0) || this.state.waveActive || this.state.wave >= 30) return;
    this.state.waveActive = true;
    this.state.baseHealth = Math.min(100, this.state.baseHealth + 12);
    const waveNumber = this.state.wave + 1;
    this.enemiesToSpawn = Math.min(42, 4 + Math.ceil(waveNumber * 1.22));
    if (waveNumber % 10 === 0) this.enemiesToSpawn += 1;
    this.spawnTimer = 0.4;
    this.state.enemiesRemaining = this.enemiesToSpawn;
    this.waveStartedStock = this.state.displayedMeat;
    this.stockedAtCycleStart = this.waveStartedStock >= 2;
    this.wavePlayerKills = 0;
    this.waveTowerKills = 0;
    this.waveStartTime = performance.now();
    this.waveStockLost = false;
    assignLoopQuest(this.state, {
      wave: waveNumber,
      enemyCount: this.enemiesToSpawn,
      startingStock: this.waveStartedStock,
      startingHealth: this.state.baseHealth,
      hasStockThreat: waveNumber % 10 === 0 || waveNumber >= 8 && this.enemiesToSpawn >= 5,
    });
    this.ui.toast(`警報：第 ${waveNumber} 波${waveNumber % 10 === 0 ? " Boss " : "屍群"}穿越北境！`, "danger");
  }

  private updateWave(dt: number): void {
    if (!this.state.waveActive) return;
    if (this.enemiesToSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnZombie(this.enemiesToSpawn);
        this.enemiesToSpawn -= 1;
        this.spawnTimer = Math.max(0.38, 0.86 - this.state.wave * 0.014);
      }
    }
    for (const zombie of this.zombies) {
      if (!zombie.alive) continue;
      zombie.slowTimer = Math.max(0, zombie.slowTimer - dt);
      const target = SHOP_POSITION.add(new Vector3(0, 0, 1.8));
      const distance = Vector3.Distance(zombie.root.position, target);
      if (distance > 2.5) {
        const slowFactor = zombie.slowTimer > 0 ? 0.55 : 1;
        this.moveActorToward(zombie, target, zombie.baseSpeed * slowFactor, dt);
        this.playAnimation(zombie, "Walk", true);
        zombie.attackPhase = "approach";
        zombie.attackTimer = 0;
      } else {
        const timings = this.enemyAttackTimings(zombie.type);
        if (zombie.attackPhase === "approach") {
          zombie.attackPhase = "anticipation";
          zombie.attackTimer = timings.impact;
          this.playAnimation(zombie, "Idle_Attack", false, true);
        } else {
          zombie.attackTimer -= dt;
        }
        if (zombie.attackPhase === "anticipation" && zombie.attackTimer <= 0) {
          const blocked = this.state.customerAffinity.nurse_lin >= 6 && Math.random() < 0.08;
          const damage = Math.max(0, zombie.damage - (blocked ? 1 : 0));
          this.state.baseHealth -= damage;
          this.state.stats.damageTaken += damage;
          zombie.attackPhase = "recovery";
          zombie.attackTimer = timings.recovery;
          if (blocked) this.ui.toast("林護理留下的繃帶穩住了壁壘 · 減免 1 傷", "ice");
          if ((zombie.type === "brute" || zombie.type === "boss") && this.state.displayedMeat > 0) {
            this.state.displayedMeat -= 1;
            this.waveStockLost = true;
            this.updateMeatVisuals();
          }
          this.ui.toast(`${this.zombieLabel(zombie.type)}正在破壞肉舖壁壘！`, "danger");
          if (this.state.baseHealth <= 0) {
            this.finishGame(false);
            return;
          }
        } else if (zombie.attackPhase === "recovery" && zombie.attackTimer <= 0) {
          zombie.attackPhase = "approach";
          zombie.attackTimer = 0;
        }
      }
    }
    if (this.enemiesToSpawn === 0 && !this.zombies.some((zombie) => zombie.alive)) this.completeWave();
  }

  private spawnZombie(order: number): void {
    const wave = this.state.wave + 1;
    const x = -6 + ((order * 4.7) % 12);
    const z = 20 - (order % 2) * 1.8;
    const type: ZombieType = wave % 10 === 0 && order === 1
      ? "boss"
      : wave >= 8 && order % 5 === 0
        ? "brute"
        : wave >= 4 && order % 3 === 0
          ? "runner"
          : "walker";
    const scale = type === "boss" ? 1.05 : type === "brute" ? 1.4 : type === "runner" ? 0.82 : 0.98;
    const actor = this.instantiateActor(type === "boss" ? "custom/boss-zombie.glb" : "zombie.glb", `zombie-${type}-${wave}-${order}-${this.elapsed}`, new Vector3(x, 0, z), scale);
    const baseHp = 3 + Math.floor(wave * 0.72);
    const hp = Math.round(baseHp * (type === "boss" ? 8 : type === "brute" ? 2.35 : type === "runner" ? 0.72 : 1));
    const speed = (0.92 + wave * 0.025) * (type === "runner" ? 1.75 : type === "brute" ? 0.72 : type === "boss" ? 0.62 : 1);
    const zombie: ZombieActor = {
      ...actor,
      hp,
      maxHp: hp,
      alive: true,
      speed,
      baseSpeed: speed,
      attackTimer: 0.2,
      attackPhase: "approach",
      damage: type === "boss" ? 16 : type === "brute" ? 10 : type === "runner" ? 5 : 6,
      reward: type === "boss" ? 25 + wave : type === "brute" ? 5 : type === "runner" ? 3 : 2,
      type,
      slowTimer: 0,
      deathEndsAt: 0,
    };
    zombie.root.position.y = this.heightAt(x, z);
    this.playAnimation(zombie, "Walk", true);
    this.addActorShadows(zombie);
    this.addZombieTypeVisual(zombie);
    this.zombies.push(zombie);
  }

  private updateTowers(_dt: number): void {
    for (const tower of this.towerActors.values()) {
      const level = this.state.towers[tower.id];
      if (level <= 0) continue;
      const animationTooFar = Vector3.Distance(this.player.root.position, tower.root.position) > TOWER_ANIMATION_LOD_DISTANCE;
      if (animationTooFar !== tower.animationLodPaused) {
        tower.animationLodPaused = animationTooFar;
        if (animationTooFar) {
          for (const animation of tower.animations) {
            animation.stop();
            animation.reset();
          }
          tower.currentAnimation = "";
        }
      }
      if (!this.state.waveActive) continue;
      const range = tower.id === "cannon" ? 19 + level : 17 + level * 1.5;
      const target = this.findNearestZombie(tower.root.position, range);
      if (!target) continue;
      const delta = target.root.position.subtract(tower.root.position);
      tower.weapon.rotation.y = Math.atan2(delta.x, delta.z);
      if (tower.cooldown > 0) continue;
      tower.cooldown = tower.id === "ballista" ? 0.98 - level * 0.12 : tower.id === "frost" ? 1.25 - level * 0.14 : 2.35 - level * 0.25;
      if (!tower.animationLodPaused) this.playTowerAnimation(tower, "attack");
      const projectile = this.acquireProjectile(tower.id);
      projectile.position.copyFrom(tower.root.position.add(new Vector3(0, 3.5, 0)));
      this.projectiles.push({
        root: projectile,
        target,
        progress: 0,
        start: projectile.position.clone(),
        source: tower.id,
        damage: tower.id === "ballista" ? 2 + level : tower.id === "frost" ? 1 + level : 4 + level * 2,
        splash: tower.id === "cannon" ? 3 + level * 0.45 : 0,
        slow: tower.id === "frost" ? 1.7 + level * 0.65 : 0,
      });
    }
  }

  private updateProjectiles(dt: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      if (!projectile.target.alive) {
        this.releaseProjectile(projectile.root, projectile.source);
        this.projectiles.splice(index, 1);
        continue;
      }
      projectile.progress += dt * 2.65;
      const targetPosition = projectile.target.root.position.add(new Vector3(0, 1.25, 0));
      projectile.root.position.copyFrom(Vector3.Lerp(projectile.start, targetPosition, Math.min(1, projectile.progress)));
      const direction = targetPosition.subtract(projectile.root.position);
      projectile.root.rotation.y = Math.atan2(direction.x, direction.z);
      projectile.root.position.y += Math.sin(projectile.progress * Math.PI) * 1.4;
      if (projectile.progress < 1) continue;
      const victims = projectile.splash > 0
        ? this.zombies.filter((zombie) => zombie.alive && Vector3.Distance(zombie.root.position, projectile.target.root.position) <= projectile.splash)
        : [projectile.target];
      for (const victim of victims) {
        if (projectile.slow > 0) {
          victim.slowTimer = Math.max(victim.slowTimer, projectile.slow);
          if (addLoopProgress(this.state, "frost-hits")) this.ui.toast(`循環任務完成 · ✦ ${this.state.quest.loop?.reward ?? 0}`, "ice");
        }
        this.damageZombie(victim, projectile.damage, projectile.source);
      }
      if (projectile.source === "cannon") {
        this.createExplosion(projectile.target.root.position, projectile.splash);
        if (victims.length >= 3 && addLoopProgress(this.state, "cannon-combo")) this.ui.toast(`循環任務完成 · ✦ ${this.state.quest.loop?.reward ?? 0}`, "warm");
      }
      this.releaseProjectile(projectile.root, projectile.source);
      this.projectiles.splice(index, 1);
    }
  }

  private acquireProjectile(source: TowerId): TransformNode {
    const pool = this.projectilePools.get(source) ?? [];
    this.projectilePools.set(source, pool);
    const reused = pool.pop();
    if (reused) {
      reused.setEnabled(true);
      reused.rotation.setAll(0);
      return reused;
    }
    if (source === "ballista") {
      const arrow = this.instantiateStatic("tower/arrow.glb", `tower-arrow-pool-${this.elapsed}`, false);
      arrow.scaling.setAll(1.8);
      return arrow;
    }
    const sphere = MeshBuilder.CreateIcoSphere(`${source}-projectile-pool-${this.elapsed}`, { radius: source === "frost" ? 0.23 : 0.38, subdivisions: 1 }, this.scene);
    let material = this.projectileMaterials.get(source);
    if (!material) {
      material = new PBRMaterial(`${source}-projectile-shared-material`, this.scene);
      material.albedoColor = source === "frost" ? new Color3(0.45, 0.88, 1) : new Color3(0.2, 0.16, 0.12);
      material.emissiveColor = source === "frost" ? new Color3(0.16, 0.68, 1) : new Color3(1, 0.24, 0.04);
      material.emissiveIntensity = 1.5;
      material.freeze();
      this.projectileMaterials.set(source, material);
    }
    sphere.material = material;
    return sphere;
  }

  private releaseProjectile(root: TransformNode, source: TowerId): void {
    root.setEnabled(false);
    const pool = this.projectilePools.get(source) ?? [];
    pool.push(root);
    this.projectilePools.set(source, pool);
  }

  private damageZombie(zombie: ZombieActor, damage: number, source: DamageSource): void {
    if (!zombie.alive) return;
    zombie.hp -= damage;
    this.damageEventCount += 1;
    this.lastDamageAt = this.elapsed;
    this.state.stats.damageDealt += damage;
    this.playAnimation(zombie, "HitReact", false);
    if (zombie.hp <= 0) this.killZombie(zombie, source);
  }

  private killZombie(zombie: ZombieActor, source: DamageSource): void {
    if (!zombie.alive) return;
    zombie.alive = false;
    const deathAnimation = this.playAnimation(zombie, "Death", false, true);
    const deathDuration = this.animationDuration(deathAnimation, 1.35);
    zombie.deathEndsAt = this.elapsed + deathDuration;
    creditIncome(this.state, zombie.reward + (this.state.customerAffinity.scout_he >= 6 ? 1 : 0));
    this.state.stats.zombiesKilled += 1;
    if (source === "player") {
      this.state.stats.playerKills += 1;
      this.wavePlayerKills += 1;
      if (addLoopProgress(this.state, "player-kills")) this.ui.toast(`親手清場完成 · ✦ ${this.state.quest.loop?.reward ?? 0}`, "warm");
    } else {
      this.state.stats.towerKills += 1;
      this.waveTowerKills += 1;
      if (addLoopProgress(this.state, "tower-kills")) this.ui.toast(`箭雨校準完成 · ✦ ${this.state.quest.loop?.reward ?? 0}`, "ice");
    }
    this.state.enemiesRemaining = Math.max(0, this.state.enemiesRemaining - 1);
    window.setTimeout(() => zombie.root.setEnabled(false), Math.ceil(deathDuration * 1000) + 34);
  }

  private completeWave(): void {
    if (!this.waveStockLost && addLoopProgress(this.state, "stock-safe")) this.ui.toast(`完整貨架完成 · ✦ ${this.state.quest.loop?.reward ?? 0}`, "warm");
    if (this.state.baseHealth >= 75 && addLoopProgress(this.state, "healthy-wall")) this.ui.toast(`不退防線完成 · ✦ ${this.state.quest.loop?.reward ?? 0}`, "ice");
    this.state.waveActive = false;
    this.state.wave += 1;
    this.state.bestWave = Math.max(this.state.bestWave, this.state.wave);
    this.state.stats.wavesCleared = Math.max(this.state.stats.wavesCleared, this.state.wave);
    const reward = 16 + Math.min(this.state.wave, 10) * 3 + Math.max(0, this.state.wave - 10) + (this.state.wave % 10 === 0 ? 35 : 0);
    creditIncome(this.state, reward);
    saveState(this.state);
    this.ui.toast(`第 ${this.state.wave} 波已清除 · 防守獎金 ✦ ${reward}`, "warm");
    this.processQuests();
    const cleared = this.zombies.filter((zombie) => !zombie.alive);
    const recycleDelay = Math.max(0, ...cleared.map((zombie) => zombie.deathEndsAt - this.elapsed)) * 1000 + 80;
    window.setTimeout(() => {
      for (const zombie of cleared) {
        for (const animation of zombie.animations) animation.dispose();
        zombie.root.dispose(false, false);
        const index = this.zombies.indexOf(zombie);
        if (index >= 0) this.zombies.splice(index, 1);
      }
    }, recycleDelay);
    if (this.state.wave >= 30) {
      this.state.stats.campaignWins += 1;
      saveState(this.state);
      window.setTimeout(() => this.finishGame(true), 900);
    }
  }

  private finishGame(won: boolean): void {
    if (this.endShown) return;
    this.endShown = true;
    this.state.waveActive = false;
    if (won) saveState(this.state);
    const minutes = Math.max(1, Math.round((performance.now() - this.campaignStartTime) / 60000));
    this.ui.showResult(won, won
      ? `第三十次鐘聲穿過風牆，北境肉舖仍在營業。你成為「北境守望者」。`
      : `肉舖壁壘遭到突破。永久資金、任務、武器、員工與建設都已保留，重新集結後再戰。`, [
      ["守過波次", `${this.state.wave} / 30`],
      ["累計擊殺", `${this.state.stats.zombiesKilled}`],
      ["獵物", `${this.state.stats.cowsKilled}`],
      ["累計總收入", `✦ ${this.state.stats.totalEarned}`],
      ["剩餘資金", `✦ ${this.state.money}`],
      ["本輪時間", `${minutes} 分`],
    ]);
  }

  private updateAtmosphere(dt: number): void {
    const targetNight = this.state.waveActive ? 1 : 0;
    this.nightBlend += (targetNight - this.nightBlend) * Math.min(1, dt * 1.15);
    const microCycle = Math.sin(this.elapsed * 0.045) * 0.08;
    const lowQuality = this.state.quality === "低";
    this.sun.intensity = lowQuality
      ? 1.62 - this.nightBlend * 0.82 + microCycle * 0.45
      : 2.35 - this.nightBlend * 1.58 + microCycle;
    this.skyLight.intensity = lowQuality
      ? 0.7 - this.nightBlend * 0.27
      : 1.05 - this.nightBlend * 0.57;
    this.shopLight.intensity = (lowQuality ? 11 : 14) + this.nightBlend * (lowQuality ? 9 : 12);
    this.scene.fogDensity = lowQuality
      ? 0.0045 + this.nightBlend * 0.003
      : 0.012 + this.nightBlend * 0.008;
    const dayFog = lowQuality ? new Color3(0.065, 0.13, 0.19) : new Color3(0.58, 0.68, 0.72);
    const nightFog = lowQuality ? new Color3(0.025, 0.065, 0.115) : new Color3(0.11, 0.2, 0.29);
    this.scene.fogColor.copyFrom(Color3.Lerp(dayFog, nightFog, this.nightBlend));
    const clear = lowQuality
      ? Color3.Lerp(new Color3(0.045, 0.095, 0.15), new Color3(0.012, 0.035, 0.075), this.nightBlend)
      : Color3.Lerp(new Color3(0.57, 0.69, 0.74), new Color3(0.045, 0.09, 0.16), this.nightBlend);
    this.scene.clearColor.set(clear.r, clear.g, clear.b, 1);
  }

  private updateCamera(dt: number): void {
    const target = this.player.root.position.add(new Vector3(0, 1.2, 0));
    this.camera.target.copyFrom(Vector3.Lerp(this.camera.target, target, Math.min(1, dt * 4.8)));
    const desiredRadius = this.state.waveActive ? 25 : 19;
    this.camera.radius += (desiredRadius - this.camera.radius) * Math.min(1, dt * 1.8);
    this.snowEmitter.position.copyFrom(this.camera.target.add(new Vector3(-2, 10, 0)));
  }

  private processQuests(): void {
    const completions = updateMainQuests(this.state);
    for (const [index, completion] of completions.entries()) {
      window.setTimeout(() => this.ui.completeQuest(completion), index * 820);
    }
  }

  private updateContextPrompt(): void {
    const attackKey = this.ui.touchMode ? "揮砍鈕" : "SPACE";
    if (this.state.waveActive && this.findNearestZombie(this.player.root.position, 3.1)) {
      this.ui.setPrompt(attackKey, "攻擊殭屍", true);
    } else if (this.findNearestCow(this.player.root.position, 3.3)) {
      this.ui.setPrompt(attackKey, `${this.state.weapon === "smg" ? "掃射" : this.state.weapon === "axe" ? "橫掃" : "揮砍"}牛隻`, true);
    } else if (this.state.carriedMeat > 0 && Vector3.Distance(this.player.root.position, STALL_POSITION) < 5) {
      this.ui.setPrompt("AUTO", "靠近攤位自動陳列", true);
    } else if (this.state.towers.ballista === 0 && Vector3.Distance(this.player.root.position, TOWER_POSITIONS.ballista) < 4) {
      const unlocked = hasCompletedChapter(this.state, SHOP_UNLOCK_CHAPTER.defenseShop);
      this.ui.setPrompt(this.ui.touchMode ? "整備" : "B", unlocked ? `建造獵風弩塔 · ✦ ${towerCostForState(this.state, "ballista", 0)}` : "完成手冊第 5 章解鎖防線", true);
    } else {
      this.ui.setPrompt(this.ui.touchMode ? "搖桿" : "WASD", this.ui.touchMode ? "虛擬搖桿移動 · 揮砍鈕攻擊" : "穿越雪地 · 空白鍵揮砍", true);
    }
  }

  private requireChapter(chapter: number): boolean {
    if (hasCompletedChapter(this.state, chapter)) return true;
    this.ui.toast(`🔒 完成手冊第 ${chapter} 章解鎖`, "ice");
    return false;
  }

  private instantiateActor(file: string, name: string, position: Vector3, scale: number): Actor {
    const container = this.assets.get(file)!;
    const entries = container.instantiateModelsToScene((source) => `${name}-${source}`, false, { doNotInstantiate: false });
    const root = new TransformNode(name, this.scene);
    for (const node of entries.rootNodes) node.parent = root;
    root.position.copyFrom(position);
    root.scaling.setAll(scale);
    const meshForwardNode = root.getChildTransformNodes(false).find((node) =>
      node.name.includes("Protagonist") || node.name.includes("Npc"),
    ) ?? root;
    const meshForwardAxis = file.startsWith("custom/characters/") || file === "custom/boss-zombie.glb" ? Vector3.Backward() : Vector3.Forward();
    return { root, meshForwardNode, meshForwardAxis, animations: entries.animationGroups, currentAnimation: "" };
  }

  private replacePlayerModel(): void {
    const previous = this.player;
    const definition = PROTAGONISTS.find((entry) => entry.id === this.state.protagonistId)!;
    const replacement = this.instantiateActor(definition.model, `player-${definition.id}`, previous.root.position.clone(), 1);
    replacement.root.rotation.copyFrom(previous.root.rotation);
    this.weaponModel?.dispose(false, false);
    this.weaponModel = undefined;
    this.muzzleFlash = undefined;
    for (const visual of this.carriedVisuals) visual.parent = replacement.root;
    for (const animation of previous.animations) animation.dispose();
    previous.root.dispose(false, false);
    this.player = replacement;
    this.playAnimation(this.player, "idle", true);
    this.createWeaponModel();
    this.addActorShadows(this.player);
  }

  private instantiateStatic(file: string, name: string, freezeEligible = true): TransformNode {
    const container = this.assets.get(file)!;
    const entries = container.instantiateModelsToScene((source) => `${name}-${source}`, false, { doNotInstantiate: false });
    const root = new TransformNode(name, this.scene);
    for (const node of entries.rootNodes) node.parent = root;
    for (const mesh of root.getChildMeshes()) this.castShadows(mesh);
    root.metadata = { ...(root.metadata ?? {}), stormStatic: freezeEligible };
    return root;
  }

  private freezeStaticScene(): void {
    let frozenMeshes = 0;
    for (const node of this.scene.transformNodes) {
      if (!node.metadata?.stormStatic) continue;
      for (const mesh of node.getChildMeshes()) {
        mesh.freezeWorldMatrix();
        frozenMeshes += 1;
      }
    }
    for (const material of this.scene.materials) {
      if (!material.name.includes("attack-ring") && !material.name.includes("blast")) material.freeze();
    }
    (window as Window & { __stormOptimization?: unknown }).__stormOptimization = {
      staticMeshesFrozen: frozenMeshes,
      instancedMeshes: this.scene.meshes.filter((mesh) => mesh.getClassName() === "InstancedMesh").length,
      materials: this.scene.materials.length,
      deduplicatedMaterials: this.deduplicatedMaterials,
      textureTier: this.state.quality,
    };
  }

  private deduplicateAssetMaterials(): void {
    const canonical = new Map<string, NonNullable<AbstractMesh["material"]>>();
    for (const container of this.assets.values()) {
      for (const mesh of container.meshes) {
        const material = mesh.material;
        if (!material) continue;
        const pbr = material as PBRMaterial;
        const key = [
          material.getClassName(),
          material.name.replace(/\.\d{3}$/u, ""),
          pbr.albedoColor?.toHexString() ?? "",
          pbr.metallic ?? "",
          pbr.roughness ?? "",
          pbr.albedoTexture?.name ?? "",
        ].join("|");
        const shared = canonical.get(key);
        if (shared && shared !== material) {
          mesh.material = shared;
          this.deduplicatedMaterials += 1;
        } else {
          canonical.set(key, material);
        }
      }
    }
  }

  private playAnimation(actor: Actor, name: string, loop: boolean, restart = false): AnimationGroup | undefined {
    if (actor.currentAnimation === name && !restart) return actor.animations.find((animation) => animation.name === name);
    for (const animation of actor.animations) animation.stop();
    const selected = actor.animations.find((animation) => animation.name === name)
      ?? actor.animations.find((animation) => animation.name.toLowerCase().includes(name.toLowerCase()));
    if (!selected) return undefined;
    selected.reset();
    selected.play(loop);
    actor.currentAnimation = name;
    if (!loop) {
      selected.onAnimationGroupEndObservable.addOnce(() => {
        if (actor.currentAnimation === name && actor.root.isEnabled()) {
          if (name.toLowerCase().includes("death")) {
            actor.currentAnimation = "death-complete";
            return;
          }
          actor.currentAnimation = "";
          this.playAnimation(actor, "idle", true);
        }
      });
    }
    return selected;
  }

  private isAttackAnimation(actor: Actor): boolean {
    return actor.currentAnimation.startsWith("attack_");
  }

  private animationDuration(animation: AnimationGroup | undefined, fallback: number): number {
    if (!animation) return fallback;
    const fps = animation.targetedAnimations[0]?.animation.framePerSecond ?? 24;
    return Math.max(0.1, (animation.to - animation.from) / Math.max(1, fps));
  }

  private playTowerAnimation(tower: TowerActor, name: string): void {
    for (const animation of tower.animations) animation.stop();
    const selected = tower.animations.find((animation) => animation.name === name)
      ?? tower.animations.find((animation) => animation.name.toLowerCase().includes(name.toLowerCase()));
    if (!selected) return;
    selected.reset();
    selected.play(false);
    tower.currentAnimation = name;
    selected.onAnimationGroupEndObservable.addOnce(() => {
      if (tower.currentAnimation === name) tower.currentAnimation = "";
    });
  }

  private addActorShadows(actor: Actor): void {
    if (!this.shadows) {
      this.createBlobShadow(actor.root);
      return;
    }
    for (const mesh of actor.root.getChildMeshes()) this.castShadows(mesh);
  }

  private createBlobShadow(root: TransformNode): void {
    if (root.getChildMeshes().some((mesh) => mesh.name === `${root.name}-blob-shadow`)) return;
    if (!this.blobShadowMaterial) {
      const material = new StandardMaterial("mobile-blob-shadow-material", this.scene);
      material.diffuseColor = Color3.Black();
      material.emissiveColor = new Color3(0.008, 0.015, 0.022);
      material.specularColor = Color3.Black();
      material.alpha = 0.24;
      material.disableLighting = true;
      material.backFaceCulling = false;
      this.blobShadowMaterial = material;
    }
    const radius = root.name.includes("cow") || root.name.includes("boss")
      ? 1.08
      : root.name.includes("dog")
        ? 0.72
        : 0.62;
    const blob = MeshBuilder.CreateDisc(`${root.name}-blob-shadow`, { radius, tessellation: 12 }, this.scene);
    const inverseScale = 1 / Math.max(0.01, root.scaling.x);
    blob.parent = root;
    blob.position.y = 0.035 * inverseScale;
    blob.rotation.x = Math.PI / 2;
    blob.scaling.setAll(inverseScale);
    blob.material = this.blobShadowMaterial;
    blob.isPickable = false;
    blob.receiveShadows = false;
  }

  private castShadows(mesh: AbstractMesh): void {
    if (!this.shadows) {
      mesh.receiveShadows = false;
      return;
    }
    if (mesh.getClassName() !== "InstancedMesh") mesh.receiveShadows = true;
    this.shadows.addShadowCaster(mesh, true);
  }

  private moveActorToward(actor: Actor, destination: Vector3, speed: number, dt: number): boolean {
    const delta = destination.subtract(actor.root.position);
    delta.y = 0;
    const distance = delta.length();
    if (distance < 0.12) return true;
    const direction = delta.normalize();
    actor.root.position.addInPlace(direction.scale(Math.min(distance, speed * dt)));
    actor.root.position.y = this.heightAt(actor.root.position.x, actor.root.position.z);
    actor.root.rotation.y = this.lerpAngle(actor.root.rotation.y, Math.atan2(direction.x, direction.z), Math.min(1, dt * 8));
    return distance < 0.2;
  }

  private createMeatPiece(name: string, scale: number): TransformNode {
    const root = this.instantiateStatic("custom/meat-slice.glb", name, false);
    root.scaling.setAll(scale);
    return root;
  }

  private updateMeatVisuals(): void {
    this.carriedVisuals.forEach((visual, index) => visual.setEnabled(index < this.state.carriedMeat));
    this.stockVisuals.forEach((visual, index) => visual.setEnabled(index < this.state.displayedMeat));
  }

  private createWorldRing(name: string, position: Vector3, diameter: number, color: Color3): Mesh {
    const ring = MeshBuilder.CreateTorus(name, { diameter, thickness: 0.055, tessellation: 64 }, this.scene);
    ring.position.set(position.x, this.heightAt(position.x, position.z) + 0.11, position.z);
    const material = new PBRMaterial(`${name}-material`, this.scene);
    material.albedoColor = color;
    material.emissiveColor = color;
    material.emissiveIntensity = 1.2;
    material.roughness = 0.4;
    ring.material = material;
    return ring;
  }

  private createCampfire(position: Vector3): void {
    const stones = this.instantiateStatic("campfire-stones.glb", "shop-campfire-stones");
    stones.position.set(position.x, this.heightAt(position.x, position.z), position.z);
    stones.scaling.setAll(1.5);
    const fireLight = new PointLight("campfire-light", new Vector3(position.x, stones.position.y + 1, position.z), this.scene);
    fireLight.diffuse = new Color3(1, 0.33, 0.08);
    fireLight.intensity = 8;
    fireLight.range = 8;
    const flame = new DynamicTexture("flame-particle", 24, this.scene, false);
    const context = flame.getContext() as unknown as CanvasRenderingContext2D;
    const gradient = context.createRadialGradient(12, 12, 1, 12, 12, 11);
    gradient.addColorStop(0, "rgba(255,245,180,1)");
    gradient.addColorStop(0.35, "rgba(255,125,30,.95)");
    gradient.addColorStop(1, "rgba(180,20,0,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 24, 24);
    flame.hasAlpha = true;
    flame.update();
    const particles = new ParticleSystem("campfire-flames", this.state.quality === "低" ? 40 : this.state.quality === "中" ? 90 : 140, this.scene);
    this.ambientParticles.push(particles);
    particles.particleTexture = flame;
    particles.emitter = fireLight.position;
    particles.minEmitBox = new Vector3(-0.2, 0, -0.2);
    particles.maxEmitBox = new Vector3(0.2, 0.15, 0.2);
    particles.color1 = new Color4(1, 0.36, 0.05, 1);
    particles.color2 = new Color4(1, 0.8, 0.2, 0.8);
    particles.minSize = 0.12;
    particles.maxSize = 0.38;
    particles.minLifeTime = 0.22;
    particles.maxLifeTime = 0.62;
    particles.emitRate = this.state.quality === "低" ? 24 : this.state.quality === "中" ? 58 : 90;
    particles.direction1 = new Vector3(-0.15, 1.2, -0.15);
    particles.direction2 = new Vector3(0.15, 2.1, 0.15);
    particles.gravity = new Vector3(0, 1, 0);
    particles.blendMode = ParticleSystem.BLENDMODE_ADD;
    particles.start();
  }

  private createWeaponModel(): void {
    this.weaponModel?.dispose(false, false);
    this.muzzleFlash = undefined;
    const socket = this.player.root.getChildTransformNodes(false).find((node) => node.name.includes("WeaponSocket"));
    if (this.state.protagonistId === "butcher_matron" && this.state.weapon === "machete") {
      // Her authored cleaver is already bound to hand.R and carries the full melee arc.
      const root = new TransformNode("player-weapon-authored-cleaver", this.scene);
      root.parent = socket ?? this.player.root;
      root.setEnabled(false);
      this.weaponModel = root;
      return;
    }
    const root = this.instantiateStatic(`custom/weapons/${this.state.weapon}.glb`, `player-weapon-${this.state.weapon}`, false);
    root.parent = socket ?? this.player.root;
    root.position.set(socket ? 0 : 0.52, socket ? 0 : 1.18, socket ? 0 : 0.24);
    root.rotation.set(0.12, 0, -0.18);
    root.scaling.setAll(this.state.weapon === "smg" ? 0.82 : 0.88);
    if (this.state.weapon === "smg") {
      const flash = MeshBuilder.CreateIcoSphere("smg-muzzle-flash", { radius: 0.24, subdivisions: 1 }, this.scene);
      flash.parent = root;
      flash.position.y = 1.92;
      const flashMaterial = new PBRMaterial("smg-muzzle-flash-material", this.scene);
      flashMaterial.albedoColor = new Color3(1, 0.62, 0.08);
      flashMaterial.emissiveColor = new Color3(1, 0.18, 0.01);
      flashMaterial.emissiveIntensity = 2;
      flash.material = flashMaterial;
      flash.setEnabled(false);
      this.muzzleFlash = flash;
    }
    this.weaponModel = root;
  }

  private createAttackRing(color: Color3, position = this.player.root.position): void {
    const ring = MeshBuilder.CreateTorus(`attack-ring-${this.elapsed}`, { diameter: 2.2, thickness: 0.08, tessellation: 32 }, this.scene);
    ring.position.set(position.x, this.heightAt(position.x, position.z) + 0.15, position.z);
    const material = new PBRMaterial(`attack-ring-material-${this.elapsed}`, this.scene);
    material.albedoColor = color;
    material.emissiveColor = color;
    material.emissiveIntensity = 1.2;
    material.alpha = 0.8;
    ring.material = material;
    let progress = 0;
    const animate = (): void => {
      progress += 0.12;
      ring.scaling.setAll(1 + progress * 2.4);
      material.alpha = Math.max(0, 0.8 - progress);
      if (progress < 0.85) requestAnimationFrame(animate);
      else ring.dispose(false, true);
    };
    animate();
  }

  private createExplosion(position: Vector3, radius: number): void {
    const blast = MeshBuilder.CreateIcoSphere(`cannon-blast-${this.elapsed}`, { radius: 0.5, subdivisions: 2 }, this.scene);
    blast.position.set(position.x, this.heightAt(position.x, position.z) + 0.8, position.z);
    const material = new PBRMaterial(`cannon-blast-material-${this.elapsed}`, this.scene);
    material.albedoColor = new Color3(1, 0.24, 0.03);
    material.emissiveColor = new Color3(1, 0.08, 0.01);
    material.emissiveIntensity = 2.5;
    material.alpha = 0.82;
    blast.material = material;
    const light = new PointLight(`cannon-blast-light-${this.elapsed}`, blast.position.clone(), this.scene);
    light.diffuse = new Color3(1, 0.24, 0.04);
    light.intensity = this.state.quality === "低" ? 0 : 12;
    light.range = radius * 2.2;
    let progress = 0;
    const animate = (): void => {
      progress += 0.15;
      blast.scaling.setAll(1 + progress * radius);
      material.alpha = Math.max(0, 0.82 - progress);
      light.intensity *= 0.62;
      if (progress < 0.9) requestAnimationFrame(animate);
      else {
        blast.dispose(false, true);
        light.dispose();
      }
    };
    animate();
  }

  private addZombieTypeVisual(zombie: ZombieActor): void {
    const colors: Record<ZombieType, Color3> = {
      walker: new Color3(0.36, 0.55, 0.28),
      runner: new Color3(0.75, 0.64, 0.14),
      brute: new Color3(0.55, 0.18, 0.12),
      boss: new Color3(0.48, 0.08, 0.26),
    };
    const ring = MeshBuilder.CreateTorus(`${zombie.type}-type-tint`, { diameter: 1.45, thickness: zombie.type === "boss" ? 0.12 : 0.06, tessellation: 20 }, this.scene);
    ring.parent = zombie.root;
    ring.position.y = 0.08;
    let material = this.zombieTypeMaterials.get(zombie.type);
    if (!material) {
      material = new PBRMaterial(`${zombie.type}-shared-tint-material`, this.scene);
      material.albedoColor = colors[zombie.type];
      material.emissiveColor = colors[zombie.type].scale(zombie.type === "walker" ? 0.2 : 0.65);
      material.emissiveIntensity = 1;
      material.freeze();
      this.zombieTypeMaterials.set(zombie.type, material);
    }
    ring.material = material;
    if (zombie.type === "brute") {
      for (const side of [-1, 1]) {
        const plate = MeshBuilder.CreateBox(`${zombie.type}-plate-${side}`, { width: 0.62, height: 0.28, depth: 0.52 }, this.scene);
        plate.parent = zombie.root;
        plate.position.set(side * 0.48, 1.65, 0);
        plate.rotation.z = side * 0.25;
        plate.material = material;
      }
    }
  }

  private allCows(): CowActor[] {
    return this.strongCow ? [this.cow, this.strongCow] : [this.cow];
  }

  private findNearestCow(origin: Vector3, range: number): CowActor | undefined {
    let nearest: CowActor | undefined;
    let bestDistance = range;
    for (const cow of this.allCows()) {
      if (!cow.alive) continue;
      const distance = Vector3.Distance(origin, cow.root.position);
      if (distance < bestDistance) {
        nearest = cow;
        bestDistance = distance;
      }
    }
    return nearest;
  }

  private zombieLabel(type: ZombieType): string {
    return type === "runner" ? "奔行者" : type === "brute" ? "蠻屍" : type === "boss" ? "巨型 Boss" : "行屍";
  }

  private enemyAttackTimings(type: ZombieType): { impact: number; recovery: number } {
    if (type === "runner") return { impact: 0.22, recovery: 0.36 };
    if (type === "boss") return { impact: 14 / 24, recovery: 0.62 };
    if (type === "brute") return { impact: 0.38, recovery: 0.58 };
    return { impact: 0.32, recovery: 0.5 };
  }

  private monitorPerformance(): void {
    if (!this.started || document.hidden || this.performanceTier >= 2) return;
    const fps = this.engine.getFps();
    if (!Number.isFinite(fps) || fps <= 0) return;
    // R6 ships against a <=18 ms p95 gate, so the adaptive renderer must react
    // before a nominal 30 FPS average masks long frames.
    if (fps >= 55) {
      this.lowFpsSamples = Math.max(0, this.lowFpsSamples - 1);
      return;
    }
    this.lowFpsSamples += 1;
    if (this.lowFpsSamples < 3) return;

    this.lowFpsSamples = 0;
    this.performanceTier += 1;
    if (this.performanceTier === 1) this.dropExpensiveRenderingFeatures();
    this.renderPixelRatio = this.performanceTier === 1 ? 0.8 : 0.65;
    this.engine.setHardwareScalingLevel(1 / this.renderPixelRatio);
    this.engine.resize();
    if (this.snowParticles) this.snowParticles.emitRate = this.performanceTier === 1 ? 24 : 12;
    for (const particles of this.ambientParticles) {
      particles.emitRate = this.performanceTier === 1 ? 12 : 6;
    }
  }

  private dropExpensiveRenderingFeatures(): void {
    this.cinematicPipeline?.dispose();
    this.cinematicPipeline = undefined;
    this.glow?.dispose();
    this.glow = undefined;
    this.shadows?.dispose();
    this.shadows = undefined;
    this.shopLight.intensity = Math.min(this.shopLight.intensity, 8);

    const actors: Actor[] = [
      this.player,
      this.cow,
      ...(this.strongCow ? [this.strongCow] : []),
      ...this.customerVariants.values(),
      ...this.staff.values(),
      ...this.zombies.filter((zombie) => zombie.alive),
    ];
    for (const actor of actors) this.addActorShadows(actor);
  }

  private detectQuality(): QualityLevel {
    return detectDeviceQuality({
      smokeMode: this.smokeMode,
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      viewportWidth: window.innerWidth,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    });
  }

  private findNearestZombie(origin: Vector3, range: number): ZombieActor | undefined {
    let nearest: ZombieActor | undefined;
    let bestDistance = range;
    for (const zombie of this.zombies) {
      if (!zombie.alive) continue;
      const distance = Vector3.Distance(origin, zombie.root.position);
      if (distance < bestDistance) {
        nearest = zombie;
        bestDistance = distance;
      }
    }
    return nearest;
  }

  private heightAt(x: number, z: number): number {
    const broad = Math.sin(x * 0.13) * 0.32 + Math.cos(z * 0.17) * 0.26;
    const drifts = Math.sin((x + z) * 0.37) * 0.09 + Math.cos(x * 0.51 - z * 0.23) * 0.065;
    const shopFlatten = Math.exp(-((x + 8) ** 2 + (z + 4) ** 2) / 38);
    const pastureFlatten = Math.exp(-((x - 8.5) ** 2 + (z - 3.7) ** 2) / 62);
    return (broad + drifts) * (1 - shopFlatten * 0.76) * (1 - pastureFlatten * 0.64);
  }

  private lerpAngle(from: number, to: number, amount: number): number {
    let delta = (to - from) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    return from + delta * amount;
  }
}
