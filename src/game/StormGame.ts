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
import { InputController } from "./input";
import { saveState, type RuntimeState } from "./state";
import type { UiController } from "./ui";

interface Actor {
  root: TransformNode;
  animations: AnimationGroup[];
  currentAnimation: string;
}

interface CowActor extends Actor {
  hp: number;
  alive: boolean;
  isMoving: boolean;
  behaviorTimer: number;
  roamTarget: Vector3;
}

interface ZombieActor extends Actor {
  hp: number;
  alive: boolean;
  speed: number;
  attackTimer: number;
}

interface MeatDrop {
  root: TransformNode;
  baseY: number;
  phase: number;
}

interface Projectile {
  root: TransformNode;
  target: ZombieActor;
  progress: number;
  start: Vector3;
}

type CustomerPhase = "hidden" | "arriving" | "buying" | "leaving";

interface CustomerActor extends Actor {
  phase: CustomerPhase;
  timer: number;
}

const ASSET_FILES = [
  "cow.glb", "survivor.glb", "customer.glb", "zombie.glb",
  "pine-a.glb", "pine-b.glb", "rock.glb",
  "fence.glb", "fence-gate.glb", "holiday/cabin-wall.glb", "holiday/cabin-wreath.glb",
  "holiday/cabin-window.glb", "holiday/cabin-door.glb", "holiday/cabin-roof.glb", "holiday/cabin-roof-point.glb",
  "holiday/lantern.glb", "holiday/bench.glb", "tower/tower-body.glb", "tower/tower-weapon.glb",
  "tower/arrow.glb", "campfire-stones.glb",
] as const;

const SHOP_POSITION = new Vector3(-8, 0, -4);
const STALL_POSITION = new Vector3(-8, 0, -7.05);
const TOWER_POSITION = new Vector3(-1, 0, 4.2);
const PASTURE_CENTER = new Vector3(8.5, 0, 3.7);

export class StormGame {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly input: InputController;
  private readonly assets = new Map<string, AssetContainer>();
  private readonly sun: DirectionalLight;
  private readonly skyLight: HemisphericLight;
  private readonly shadows: ShadowGenerator;
  private readonly glow: GlowLayer;
  private readonly snowEmitter: TransformNode;
  private readonly shopLight: PointLight;
  private player!: Actor;
  private cow!: CowActor;
  private customer!: CustomerActor;
  private towerRoot!: TransformNode;
  private towerWeapon!: TransformNode;
  private towerPad!: Mesh;
  private readonly zombies: ZombieActor[] = [];
  private readonly drops: MeatDrop[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly carriedVisuals: TransformNode[] = [];
  private readonly stockVisuals: TransformNode[] = [];
  private started = false;
  private attackCooldown = 0;
  private towerCooldown = 0;
  private spawnTimer = 0;
  private enemiesToSpawn = 0;
  private customerCooldown = 2;
  private nightBlend = 0;
  private elapsed = 0;
  private lastObjective = "";
  private endShown = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly ui: UiController,
    private readonly state: RuntimeState,
  ) {
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, powerPreference: "high-performance" }, true);
    this.engine.setHardwareScalingLevel(Math.min(1.5, Math.max(1, window.devicePixelRatio * (matchMedia("(pointer: coarse)").matches ? 0.82 : 0.65))));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.57, 0.69, 0.74, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.012;
    this.scene.fogColor = new Color3(0.58, 0.68, 0.72);
    this.scene.environmentIntensity = 0.72;

    this.camera = new ArcRotateCamera("follow-camera", -Math.PI * 0.28, 1.02, 19, new Vector3(0, 1.2, 0), this.scene);
    this.camera.lowerRadiusLimit = 14;
    this.camera.upperRadiusLimit = 27;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 110;
    this.camera.fov = 0.78;
    this.camera.inputs.clear();

    this.skyLight = new HemisphericLight("polar-skylight", new Vector3(0.2, 1, 0.1), this.scene);
    this.skyLight.intensity = 1.05;
    this.skyLight.diffuse = new Color3(0.72, 0.84, 0.9);
    this.skyLight.groundColor = new Color3(0.12, 0.18, 0.22);
    this.sun = new DirectionalLight("low-winter-sun", new Vector3(-0.52, -1, 0.38), this.scene);
    this.sun.position = new Vector3(24, 35, -20);
    this.sun.intensity = 2.4;
    this.sun.diffuse = new Color3(1, 0.91, 0.79);
    this.shadows = new ShadowGenerator(matchMedia("(pointer: coarse)").matches ? 1024 : 2048, this.sun, true);
    this.shadows.usePercentageCloserFiltering = true;
    this.shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    this.shadows.bias = 0.002;
    this.shadows.normalBias = 0.03;

    this.glow = new GlowLayer("warm-window-glow", this.scene, { mainTextureFixedSize: 512, blurKernelSize: 48 });
    this.glow.intensity = 0.48;
    const pipeline = new DefaultRenderingPipeline("storm-cinematic", true, this.scene, [this.camera]);
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = true;
    pipeline.bloomThreshold = 0.78;
    pipeline.bloomWeight = 0.2;
    pipeline.bloomKernel = 48;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.16;
    pipeline.imageProcessing.exposure = 1.05;
    pipeline.samples = matchMedia("(pointer: coarse)").matches ? 1 : 2;

    this.shopLight = new PointLight("shop-lantern-light", new Vector3(-8, 3.4, -6.1), this.scene);
    this.shopLight.diffuse = new Color3(1, 0.55, 0.25);
    this.shopLight.intensity = 16;
    this.shopLight.range = 13;
    this.snowEmitter = new TransformNode("snow-emitter", this.scene);
    this.input = new InputController(ui.joystick);
    this.createTerrain();
    this.createSnow();
    this.createDistantStorm();

    window.addEventListener("resize", () => this.engine.resize());
    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
      this.update(dt);
      this.scene.render();
    });
  }

  async initialize(): Promise<void> {
    let loaded = 0;
    await Promise.all(ASSET_FILES.map(async (file) => {
      const container = await LoadAssetContainerAsync(`/models/${file}`, this.scene);
      this.assets.set(file, container);
      loaded += 1;
      this.ui.setLoading(loaded / ASSET_FILES.length * 0.82, `載入北境資產 · ${loaded} / ${ASSET_FILES.length}`);
    }));
    this.ui.setLoading(0.86, "佈置牧場與肉舖…");
    this.buildEnvironment();
    this.createActors();
    this.createTower();
    this.createMeatDisplays();
    this.ui.update(this.state);
    this.updateObjective();
    this.ui.setLoading(0.96, "校準暴風光影…");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.ui.enterGame();
    this.ui.toast("暴風正在增強。先去東側牧場取肉。", "ice");
  }

  attack(): void { this.input.queueAttack(); }
  buildTower(): void { this.input.queueBuild(); }
  startWave(): void { this.input.queueWave(); }

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
    ground.receiveShadows = true;

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
    underSnow.receiveShadows = true;
  }

  private createSnowTexture(): DynamicTexture {
    const texture = new DynamicTexture("wind-swept-snow-texture", 512, this.scene, false);
    const context = texture.getContext() as unknown as CanvasRenderingContext2D;
    const image = context.createImageData(512, 512);
    let seed = 1917;
    const random = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let pixel = 0; pixel < image.data.length; pixel += 4) {
      const x = (pixel / 4) % 512;
      const y = Math.floor(pixel / 4 / 512);
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
    for (let line = 0; line < 34; line += 1) {
      const y = random() * 512;
      context.beginPath();
      context.moveTo(-20, y);
      context.bezierCurveTo(140, y - 18, 340, y + 22, 540, y - 8);
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

    const snow = new ParticleSystem("blizzard-snow", matchMedia("(pointer: coarse)").matches ? 900 : 1700, this.scene);
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
    snow.emitRate = matchMedia("(pointer: coarse)").matches ? 240 : 520;
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
    for (let index = 0; index < 14; index += 1) {
      const mountain = MeshBuilder.CreateCylinder(`distant-peak-${index}`, { diameterTop: 0, diameterBottom: 10 + (index % 4) * 3, height: 9 + (index % 3) * 4, tessellation: 5 }, this.scene);
      const angle = index / 14 * Math.PI * 2;
      mountain.position.set(Math.sin(angle) * 39, 1.2, Math.cos(angle) * 34);
      mountain.rotation.y = angle * 1.7;
      mountain.scaling.x = 1.4;
      mountain.material = material;
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
    place("holiday/bench.glb", new Vector3(0, 0.05, -3.1), 0, 2.2);

    const signTexture = new DynamicTexture("butcher-sign-texture", { width: 512, height: 192 }, this.scene, true);
    const context = signTexture.getContext() as unknown as CanvasRenderingContext2D;
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

    const awningMaterial = new PBRMaterial("market-awning", this.scene);
    awningMaterial.albedoColor = new Color3(0.33, 0.06, 0.045);
    awningMaterial.roughness = 0.78;
    const awning = MeshBuilder.CreateBox("weathered-red-awning", { width: 5.2, height: 0.16, depth: 2.1 }, this.scene);
    awning.position.set(-8, 2.5 + this.heightAt(-8, -6.4), -6.45);
    awning.rotation.x = -0.14;
    awning.material = awningMaterial;
    this.castShadows(awning);
    const postMaterial = new PBRMaterial("dark-timber", this.scene);
    postMaterial.albedoColor = new Color3(0.18, 0.09, 0.055);
    postMaterial.roughness = 0.9;
    for (const x of [-10.35, -5.65]) {
      const post = MeshBuilder.CreateCylinder(`market-post-${x}`, { height: 2.7, diameter: 0.16, tessellation: 8 }, this.scene);
      post.position.set(x, 1.35 + this.heightAt(x, -6.45), -6.45);
      post.material = postMaterial;
      this.castShadows(post);
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
      path.receiveShadows = true;
    }
  }

  private createActors(): void {
    this.player = this.instantiateActor("survivor.glb", "player-survivor", new Vector3(-0.5, 0, -1.5), 1);
    this.player.root.position.y = this.heightAt(this.player.root.position.x, this.player.root.position.z);
    this.playAnimation(this.player, "Idle", true);
    this.addActorShadows(this.player);

    this.cow = {
      ...this.instantiateActor("cow.glb", "pasture-cow", PASTURE_CENTER, 0.39),
      hp: 3,
      alive: true,
      isMoving: false,
      behaviorTimer: 4,
      roamTarget: PASTURE_CENTER.clone(),
    };
    this.cow.root.position.y = this.heightAt(this.cow.root.position.x, this.cow.root.position.z);
    this.cow.root.rotation.y = -0.7;
    this.playAnimation(this.cow, "Eating", true);
    this.addActorShadows(this.cow);

    this.customer = {
      ...this.instantiateActor("customer.glb", "wandering-customer", new Vector3(-18, 0, -10), 0.88),
      phase: "hidden",
      timer: 0,
    };
    this.customer.root.setEnabled(false);
    this.addActorShadows(this.customer);
  }

  private createTower(): void {
    this.towerPad = MeshBuilder.CreateCylinder("tower-build-pad", { diameter: 3.3, height: 0.16, tessellation: 32 }, this.scene);
    this.towerPad.position.set(TOWER_POSITION.x, this.heightAt(TOWER_POSITION.x, TOWER_POSITION.z) + 0.04, TOWER_POSITION.z);
    const padMaterial = new PBRMaterial("tower-pad-material", this.scene);
    padMaterial.albedoColor = new Color3(0.12, 0.3, 0.35);
    padMaterial.emissiveColor = new Color3(0.04, 0.3, 0.38);
    padMaterial.emissiveIntensity = 0.65;
    padMaterial.metallic = 0.2;
    padMaterial.roughness = 0.45;
    padMaterial.alpha = 0.72;
    this.towerPad.material = padMaterial;

    this.towerRoot = new TransformNode("built-ballista-tower", this.scene);
    this.towerRoot.position.set(TOWER_POSITION.x, this.heightAt(TOWER_POSITION.x, TOWER_POSITION.z), TOWER_POSITION.z);
    const body = this.instantiateStatic("tower/tower-body.glb", "ballista-tower-body");
    body.parent = this.towerRoot;
    body.scaling.setAll(2.25);
    this.towerWeapon = this.instantiateStatic("tower/tower-weapon.glb", "ballista-tower-weapon");
    this.towerWeapon.parent = this.towerRoot;
    this.towerWeapon.position.y = 3.2;
    this.towerWeapon.scaling.setAll(1.7);
    this.towerRoot.setEnabled(this.state.towerBuilt);
    this.towerPad.setEnabled(!this.state.towerBuilt);
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
    if (!this.started || this.endShown) return;

    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.towerCooldown = Math.max(0, this.towerCooldown - dt);
    this.handleMovement(dt);
    if (this.input.consumeAttack()) this.performAttack();
    if (this.input.consumeBuild()) this.tryBuildTower();
    if (this.input.consumeWave()) this.tryStartWave();
    this.autoDeposit();
    this.updateWave(dt);
    this.updateTower();
    this.updateProjectiles(dt);
    this.updateObjective();
    this.updateContextPrompt();
    this.ui.update(this.state);
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
      const targetRotation = Math.atan2(direction.x, direction.z);
      this.player.root.rotation.y = this.lerpAngle(this.player.root.rotation.y, targetRotation, Math.min(1, dt * 13));
      if (this.attackCooldown < 0.42) this.playAnimation(this.player, "Run", true);
    } else if (this.attackCooldown <= 0) {
      this.playAnimation(this.player, "Idle", true);
    }
  }

  private performAttack(): void {
    if (this.attackCooldown > 0) return;
    this.attackCooldown = 0.62;
    this.playAnimation(this.player, "Slash", false);
    const nearestZombie = this.findNearestZombie(this.player.root.position, 2.7);
    if (nearestZombie) {
      nearestZombie.hp -= 2;
      this.playAnimation(nearestZombie, "HitReact", false);
      if (nearestZombie.hp <= 0) this.killZombie(nearestZombie);
      return;
    }
    if (this.cow.alive && Vector3.Distance(this.player.root.position, this.cow.root.position) < 2.8) {
      this.cow.hp -= 1;
      this.playAnimation(this.cow, this.cow.hp > 0 ? "Idle_HitReact1" : "Death", false);
      if (this.cow.hp <= 0) this.killCow();
      else this.ui.toast(`牛隻生命 ${this.cow.hp} / 3`, "danger");
      return;
    }
    this.ui.toast("揮砍落空——再靠近目標。", "ice");
  }

  private killCow(): void {
    if (!this.cow.alive) return;
    this.cow.alive = false;
    this.playAnimation(this.cow, "Death", false);
    this.ui.toast("取得新鮮肉品，靠近即可拾取。", "warm");
    for (let index = 0; index < 3; index += 1) {
      const root = this.createMeatPiece(`meat-drop-${this.elapsed}-${index}`, 0.55);
      const angle = index / 3 * Math.PI * 2 + 0.3;
      root.position.set(this.cow.root.position.x + Math.cos(angle) * 0.9, this.cow.root.position.y + 0.45, this.cow.root.position.z + Math.sin(angle) * 0.9);
      root.rotation.set(0.2, angle, Math.PI / 2);
      this.drops.push({ root, baseY: root.position.y, phase: index * 2.1 });
    }
    window.setTimeout(() => this.cow.root.setEnabled(false), 1100);
    window.setTimeout(() => {
      this.cow.root.position.set(PASTURE_CENTER.x + 1.5, this.heightAt(PASTURE_CENTER.x + 1.5, PASTURE_CENTER.z - 1), PASTURE_CENTER.z - 1);
      this.cow.root.setEnabled(true);
      this.cow.hp = 3;
      this.cow.alive = true;
      this.cow.behaviorTimer = 3;
      this.playAnimation(this.cow, "Eating", true);
      this.ui.toast("牧場又有牛隻進入圍欄。", "ice");
    }, 9000);
  }

  private updateDrops(dt: number): void {
    for (let index = this.drops.length - 1; index >= 0; index -= 1) {
      const drop = this.drops[index];
      drop.phase += dt * 2.7;
      drop.root.position.y = drop.baseY + Math.sin(drop.phase) * 0.12;
      drop.root.rotation.y += dt * 0.7;
      if (!this.started || this.state.carriedMeat >= 6 || Vector3.Distance(drop.root.position, this.player.root.position) > 1.55) continue;
      drop.root.dispose(false, true);
      this.drops.splice(index, 1);
      this.state.carriedMeat += 1;
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
    this.updateMeatVisuals();
    this.customerCooldown = Math.min(this.customerCooldown, 0.6);
    this.ui.toast(`${deposited} 份肉品已陳列，顧客正在前來。`, "warm");
  }

  private updateCustomer(dt: number): void {
    if (!this.customer) return;
    if (this.customer.phase === "hidden") {
      this.customerCooldown -= dt;
      if (this.started && this.state.displayedMeat > 0 && this.customerCooldown <= 0) this.spawnCustomer();
      return;
    }
    if (this.customer.phase === "arriving") {
      if (this.moveActorToward(this.customer, STALL_POSITION.add(new Vector3(0, 0, 1.3)), 2.25, dt)) {
        this.customer.phase = "buying";
        this.customer.timer = 1.15;
        this.playAnimation(this.customer, "Idle", true);
      }
      return;
    }
    if (this.customer.phase === "buying") {
      this.customer.timer -= dt;
      if (this.customer.timer <= 0) {
        if (this.state.displayedMeat > 0) {
          this.state.displayedMeat -= 1;
          this.state.money += 20;
          this.updateMeatVisuals();
          saveState(this.state);
          this.ui.toast("交易完成 · 收入 ✦ 20", "warm");
        }
        this.customer.phase = "leaving";
        this.playAnimation(this.customer, "Walk", true);
      }
      return;
    }
    if (this.moveActorToward(this.customer, new Vector3(-18, 0, -10), 2.5, dt)) {
      this.customer.root.setEnabled(false);
      this.customer.phase = "hidden";
      this.customerCooldown = 2.2;
    }
  }

  private spawnCustomer(): void {
    this.customer.root.position.set(-18, this.heightAt(-18, -10), -10);
    this.customer.root.setEnabled(true);
    this.customer.phase = "arriving";
    this.playAnimation(this.customer, "Walk", true);
    this.ui.toast("遠方的旅人正朝肉舖走來。", "ice");
  }

  private updateCow(dt: number): void {
    if (!this.cow?.alive) return;
    this.cow.behaviorTimer -= dt;
    if (this.cow.behaviorTimer <= 0) {
      this.cow.isMoving = !this.cow.isMoving;
      this.cow.behaviorTimer = this.cow.isMoving ? 3 + Math.sin(this.elapsed) : 4.5 + Math.cos(this.elapsed);
      if (this.cow.isMoving) {
        const angle = this.elapsed * 1.7;
        this.cow.roamTarget.set(PASTURE_CENTER.x + Math.cos(angle) * 3.1, 0, PASTURE_CENTER.z + Math.sin(angle * 1.31) * 2.6);
        this.playAnimation(this.cow, "Walk", true);
      } else {
        this.playAnimation(this.cow, "Eating", true);
      }
    }
    if (this.cow.isMoving) this.moveActorToward(this.cow, this.cow.roamTarget, 0.75, dt);
  }

  private tryBuildTower(): void {
    if (this.state.towerBuilt) return;
    if (this.state.money < 60) {
      this.ui.toast(`尚缺 ✦ ${60 - this.state.money}，先把肉賣給顧客。`, "danger");
      return;
    }
    this.state.money -= 60;
    this.state.towerBuilt = true;
    this.towerRoot.setEnabled(true);
    this.towerRoot.scaling.setAll(0.01);
    this.towerPad.setEnabled(false);
    const animateBuild = (): void => {
      const next = Math.min(1, this.towerRoot.scaling.x + 0.065);
      this.towerRoot.scaling.setAll(1 + Math.sin(next * Math.PI) * 0.06);
      if (next < 1) requestAnimationFrame(animateBuild);
      else this.towerRoot.scaling.setAll(1);
    };
    animateBuild();
    saveState(this.state);
    this.ui.toast("獵風弩塔完工。鐘聲可以敲響了。", "warm");
  }

  private tryStartWave(): void {
    if (!this.state.towerBuilt || this.state.waveActive || this.state.wave >= 3) return;
    this.state.waveActive = true;
    this.state.baseHealth = Math.min(100, this.state.baseHealth + 15);
    this.enemiesToSpawn = 2 + this.state.wave * 2;
    this.spawnTimer = 0.4;
    this.state.enemiesRemaining = this.enemiesToSpawn;
    this.ui.toast(`警報：第 ${this.state.wave + 1} 波屍群穿越北境！`, "danger");
  }

  private updateWave(dt: number): void {
    if (!this.state.waveActive) return;
    if (this.enemiesToSpawn > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnZombie(this.enemiesToSpawn);
        this.enemiesToSpawn -= 1;
        this.spawnTimer = 1.15;
      }
    }
    for (const zombie of this.zombies) {
      if (!zombie.alive) continue;
      const target = SHOP_POSITION.add(new Vector3(0, 0, 1.8));
      const distance = Vector3.Distance(zombie.root.position, target);
      if (distance > 2.5) {
        this.moveActorToward(zombie, target, zombie.speed, dt);
        this.playAnimation(zombie, "Walk", true);
      } else {
        zombie.attackTimer -= dt;
        this.playAnimation(zombie, "Idle_Attack", true);
        if (zombie.attackTimer <= 0) {
          zombie.attackTimer = 0.8;
          this.state.baseHealth -= 6;
          this.ui.toast("殭屍正在破壞肉舖壁壘！", "danger");
          if (this.state.baseHealth <= 0) {
            this.finishGame(false);
            return;
          }
        }
      }
    }
    if (this.enemiesToSpawn === 0 && !this.zombies.some((zombie) => zombie.alive)) this.completeWave();
  }

  private spawnZombie(order: number): void {
    const x = -6 + ((order * 4.7) % 12);
    const z = 20 - (order % 2) * 1.8;
    const actor = this.instantiateActor("zombie.glb", `zombie-wave-${this.state.wave + 1}-${order}-${this.elapsed}`, new Vector3(x, 0, z), 0.94 + this.state.wave * 0.04);
    const zombie: ZombieActor = {
      ...actor,
      hp: 3 + this.state.wave * 2,
      alive: true,
      speed: 0.95 + this.state.wave * 0.15 + (order % 2) * 0.08,
      attackTimer: 0.2,
    };
    zombie.root.position.y = this.heightAt(x, z);
    this.playAnimation(zombie, "Walk", true);
    this.addActorShadows(zombie);
    this.zombies.push(zombie);
  }

  private updateTower(): void {
    if (!this.state.towerBuilt || !this.state.waveActive) return;
    const target = this.findNearestZombie(this.towerRoot.position, 17);
    if (!target) return;
    const delta = target.root.position.subtract(this.towerRoot.position);
    this.towerWeapon.rotation.y = Math.atan2(delta.x, delta.z);
    if (this.towerCooldown > 0) return;
    this.towerCooldown = 0.92;
    const arrow = this.instantiateStatic("tower/arrow.glb", `tower-arrow-${this.elapsed}`);
    arrow.position.copyFrom(this.towerRoot.position.add(new Vector3(0, 3.5, 0)));
    arrow.scaling.setAll(1.8);
    this.projectiles.push({ root: arrow, target, progress: 0, start: arrow.position.clone() });
  }

  private updateProjectiles(dt: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.projectiles[index];
      if (!projectile.target.alive) {
        projectile.root.dispose(false, true);
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
      projectile.target.hp -= 2;
      this.playAnimation(projectile.target, "HitReact", false);
      if (projectile.target.hp <= 0) this.killZombie(projectile.target);
      projectile.root.dispose(false, true);
      this.projectiles.splice(index, 1);
    }
  }

  private killZombie(zombie: ZombieActor): void {
    if (!zombie.alive) return;
    zombie.alive = false;
    this.playAnimation(zombie, "Death", false);
    this.state.money += 5;
    this.state.enemiesRemaining = Math.max(0, this.state.enemiesRemaining - 1);
    window.setTimeout(() => zombie.root.setEnabled(false), 1700);
  }

  private completeWave(): void {
    this.state.waveActive = false;
    this.state.wave += 1;
    this.state.bestWave = Math.max(this.state.bestWave, this.state.wave);
    const reward = 20 + this.state.wave * 10;
    this.state.money += reward;
    saveState(this.state);
    this.ui.toast(`第 ${this.state.wave} 波已清除 · 防守獎金 ✦ ${reward}`, "warm");
    if (this.state.wave >= 3) window.setTimeout(() => this.finishGame(true), 900);
  }

  private finishGame(won: boolean): void {
    if (this.endShown) return;
    this.endShown = true;
    this.state.waveActive = false;
    if (won) saveState(this.state);
    this.ui.showResult(won, won
      ? `你守住三波夜襲，肉舖仍在風雪中營業。本次累積資金 ✦ ${this.state.money}。完整 30 波戰役將在後續版本開放。`
      : `肉舖壁壘遭到突破。保留資金與已建設施，重新集結後再戰。`);
  }

  private updateAtmosphere(dt: number): void {
    const targetNight = this.state.waveActive ? 1 : 0;
    this.nightBlend += (targetNight - this.nightBlend) * Math.min(1, dt * 1.15);
    const microCycle = Math.sin(this.elapsed * 0.045) * 0.08;
    this.sun.intensity = 2.35 - this.nightBlend * 1.58 + microCycle;
    this.skyLight.intensity = 1.05 - this.nightBlend * 0.57;
    this.shopLight.intensity = 14 + this.nightBlend * 12;
    this.scene.fogDensity = 0.012 + this.nightBlend * 0.008;
    const dayFog = new Color3(0.58, 0.68, 0.72);
    const nightFog = new Color3(0.11, 0.2, 0.29);
    this.scene.fogColor.copyFrom(Color3.Lerp(dayFog, nightFog, this.nightBlend));
    const clear = Color3.Lerp(new Color3(0.57, 0.69, 0.74), new Color3(0.045, 0.09, 0.16), this.nightBlend);
    this.scene.clearColor.set(clear.r, clear.g, clear.b, 1);
  }

  private updateCamera(dt: number): void {
    const target = this.player.root.position.add(new Vector3(0, 1.2, 0));
    this.camera.target.copyFrom(Vector3.Lerp(this.camera.target, target, Math.min(1, dt * 4.8)));
    const desiredRadius = this.state.waveActive ? 25 : 19;
    this.camera.radius += (desiredRadius - this.camera.radius) * Math.min(1, dt * 1.8);
    this.snowEmitter.position.copyFrom(this.camera.target.add(new Vector3(-2, 10, 0)));
  }

  private updateObjective(): void {
    let id = "hunt";
    let content: [string, string, string] = ["01", "前往東側牧場", "接近牛隻，按空白鍵或攻擊鍵揮動砍刀。"];
    if (this.state.waveActive) {
      id = "defend";
      content = ["05", `守住第 ${this.state.wave + 1} 波`, "弩塔會自動射擊；你也能靠近殭屍揮砍支援。"];
    } else if (this.state.wave >= 3) {
      id = "complete";
      content = ["06", "北境暫時安全", "三波驗證完成。後續版本將延伸至三十波。"];
    } else if (this.state.towerBuilt) {
      id = "wave";
      content = ["04", "敲響守夜鐘", `按下畫面下方按鈕，啟動第 ${this.state.wave + 1} 波夜襲。`];
    } else if (this.state.money >= 60) {
      id = "build";
      content = ["03", "建造獵風弩塔", "資金已足夠。點擊右上建造按鈕建立第一道防線。"];
    } else if (this.state.displayedMeat > 0) {
      id = "sell";
      content = ["03", "等待旅人購買", "肉品已上架。顧客會沿雪徑抵達並自動付款。"];
    } else if (this.state.carriedMeat > 0) {
      id = "deliver";
      content = ["02", "把肉送回肉舖", "走近西側亮著暖燈的紅色攤位，肉品會自動陳列。"];
    }
    if (id === this.lastObjective) return;
    this.lastObjective = id;
    this.ui.setObjective(...content);
  }

  private updateContextPrompt(): void {
    if (this.state.waveActive && this.findNearestZombie(this.player.root.position, 3.1)) {
      this.ui.setPrompt("SPACE", "揮砍殭屍", true);
    } else if (this.cow.alive && Vector3.Distance(this.player.root.position, this.cow.root.position) < 3.3) {
      this.ui.setPrompt("SPACE", "揮砍牛隻", true);
    } else if (this.state.carriedMeat > 0 && Vector3.Distance(this.player.root.position, STALL_POSITION) < 5) {
      this.ui.setPrompt("AUTO", "靠近攤位自動陳列", true);
    } else if (!this.state.towerBuilt && Vector3.Distance(this.player.root.position, TOWER_POSITION) < 4) {
      this.ui.setPrompt("B", "建造獵風弩塔 · ✦ 60", true);
    } else {
      this.ui.setPrompt("WASD", "穿越雪地 · 空白鍵揮砍", true);
    }
  }

  private instantiateActor(file: string, name: string, position: Vector3, scale: number): Actor {
    const container = this.assets.get(file)!;
    const entries = container.instantiateModelsToScene((source) => `${name}-${source}`, false, { doNotInstantiate: true });
    const root = new TransformNode(name, this.scene);
    for (const node of entries.rootNodes) node.parent = root;
    root.position.copyFrom(position);
    root.scaling.setAll(scale);
    return { root, animations: entries.animationGroups, currentAnimation: "" };
  }

  private instantiateStatic(file: string, name: string): TransformNode {
    const container = this.assets.get(file)!;
    const entries = container.instantiateModelsToScene((source) => `${name}-${source}`, false);
    const root = new TransformNode(name, this.scene);
    for (const node of entries.rootNodes) node.parent = root;
    for (const mesh of root.getChildMeshes()) this.castShadows(mesh);
    return root;
  }

  private playAnimation(actor: Actor, name: string, loop: boolean): void {
    if (actor.currentAnimation === name) return;
    for (const animation of actor.animations) animation.stop();
    const selected = actor.animations.find((animation) => animation.name === name)
      ?? actor.animations.find((animation) => animation.name.toLowerCase().includes(name.toLowerCase()));
    if (!selected) return;
    selected.reset();
    selected.play(loop);
    actor.currentAnimation = name;
    if (!loop) {
      selected.onAnimationGroupEndObservable.addOnce(() => {
        if (actor.currentAnimation === name && actor.root.isEnabled()) {
          actor.currentAnimation = "";
          this.playAnimation(actor, "Idle", true);
        }
      });
    }
  }

  private addActorShadows(actor: Actor): void {
    for (const mesh of actor.root.getChildMeshes()) this.castShadows(mesh);
  }

  private castShadows(mesh: AbstractMesh): void {
    mesh.receiveShadows = true;
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
    const root = new TransformNode(name, this.scene);
    root.scaling.setAll(scale);
    const meatMaterial = this.scene.getMaterialByName("fresh-meat-material") as PBRMaterial | null ?? (() => {
      const material = new PBRMaterial("fresh-meat-material", this.scene);
      material.albedoColor = new Color3(0.55, 0.055, 0.035);
      material.roughness = 0.6;
      material.clearCoat.isEnabled = true;
      material.clearCoat.intensity = 0.25;
      return material;
    })();
    const fatMaterial = this.scene.getMaterialByName("marrow-material") as PBRMaterial | null ?? (() => {
      const material = new PBRMaterial("marrow-material", this.scene);
      material.albedoColor = new Color3(0.94, 0.78, 0.62);
      material.roughness = 0.75;
      return material;
    })();
    const steak = MeshBuilder.CreateCapsule(`${name}-steak`, { height: 1.35, radius: 0.48, tessellation: 12 }, this.scene);
    steak.parent = root;
    steak.scaling.z = 0.34;
    steak.material = meatMaterial;
    const bone = MeshBuilder.CreateCylinder(`${name}-bone`, { height: 0.39, diameter: 0.34, tessellation: 12 }, this.scene);
    bone.parent = root;
    bone.position.set(0.15, 0.19, 0.18);
    bone.rotation.x = Math.PI / 2;
    bone.material = fatMaterial;
    this.castShadows(steak);
    this.castShadows(bone);
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
    const particles = new ParticleSystem("campfire-flames", 120, this.scene);
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
    particles.emitRate = 85;
    particles.direction1 = new Vector3(-0.15, 1.2, -0.15);
    particles.direction2 = new Vector3(0.15, 2.1, 0.15);
    particles.gravity = new Vector3(0, 1, 0);
    particles.blendMode = ParticleSystem.BLENDMODE_ADD;
    particles.start();
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
