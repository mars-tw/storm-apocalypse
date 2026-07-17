import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const modelRoot = new URL("../public/models/custom/world/", import.meta.url);

const specs = [
  ["cow-brown.glb", "cow", [1_600, 3_000], true],
  ["cow-strong.glb", "cow", [1_600, 3_000], true],
  ["pine-sentinel.glb", "pine", [250, 650], false],
  ["pine-windswept.glb", "pine", [250, 650], false],
  ["pine-young.glb", "pine", [220, 600], false],
  ["rock-shelf.glb", "rock", [180, 500], false],
  ["rock-spire.glb", "rock", [180, 500], false],
  ["fence-rail.glb", "fence", [220, 600], false],
  ["fence-gate.glb", "fence", [220, 650], false],
  ["snowhouse-shell.glb", "snowhouse", [350, 900], false],
  ["snowhouse-door.glb", "snowhouse", [220, 600], false],
  ["snowhouse-window.glb", "snowhouse", [180, 500], false],
];

function parseGlb(buffer) {
  if (buffer.subarray(0, 4).toString("ascii") !== "glTF" || buffer.readUInt32LE(4) !== 2) throw new Error("Not GLB 2.0");
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trimEnd());
}

function triangleCount(json) {
  return (json.meshes ?? []).reduce((total, mesh) => total + mesh.primitives.reduce((subtotal, primitive) => {
    const accessor = primitive.indices ?? primitive.attributes?.POSITION;
    return subtotal + Math.floor((json.accessors?.[accessor]?.count ?? 0) / 3);
  }, 0), 0);
}

const assets = [];
for (const [filename, category, budget, animated] of specs) {
  const url = new URL(filename, modelRoot);
  const bytes = await readFile(url);
  const info = await stat(url);
  const json = parseGlb(bytes);
  const triangles = triangleCount(json);
  const clips = (json.animations ?? []).map((animation) => animation.name);
  const bones = json.skins?.[0]?.joints?.length ?? 0;
  const hasColor0 = (json.meshes ?? []).flatMap((mesh) => mesh.primitives).every((primitive) => primitive.attributes?.COLOR_0 !== undefined);
  const expectedClips = ["idle", "Eating", "Walk", "Idle_HitReact1", "Death"];
  const pass = triangles >= budget[0]
    && triangles <= budget[1]
    && hasColor0
    && (!animated || bones === 19 && expectedClips.every((clip) => clips.includes(clip)));
  assets.push({
    path: `models/custom/world/${filename}`,
    category,
    bytes: info.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    triangles,
    triangle_budget: budget,
    bones,
    clips,
    materials: (json.materials ?? []).map((material) => ({
      name: material.name,
      roughness: material.pbrMetallicRoughness?.roughnessFactor ?? 1,
      metallic: material.pbrMetallicRoughness?.metallicFactor ?? 0,
    })),
    color_0_on_all_primitives: hasColor0,
    pass,
  });
}

const manifest = {
  release: "storm R13",
  pipeline: {
    authoring: "Blender MCP execute_code over localhost:9876",
    source: "tools/blender/world_r13.py",
    blender: "5.1",
    view_transform: "AgX",
    look: "AgX Base",
    exposure_ev: 1.25,
    lighting: "R8 warm key / cold fill / ember rim / cold bounce",
    material_response: "R8 COLOR_0 vertical value breakup with roughness-separated PBR surfaces",
    units: "meters",
    format: "GLB 2.0 Y-up",
  },
  counts: { total: assets.length, cow: 2, pine: 3, rock: 2, fence: 2, snowhouse: 3 },
  all_gates_pass: assets.every((asset) => asset.pass),
  assets,
};

if (assets.length !== 12 || !manifest.all_gates_pass) throw new Error("R13 world manifest gate failed");
await writeFile(new URL("manifest-r13.json", modelRoot), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`R13 world manifest: ${assets.length} assets, ${assets.reduce((sum, asset) => sum + asset.triangles, 0)} tris, all gates pass`);
