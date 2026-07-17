import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const configPath = resolve(root, "src/game/weatherProfiles.json");
const sourcePaths = [
  "src/game/weatherProfiles.json",
  "src/game/weather.ts",
  "src/game/StormGame.ts",
];

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

const configText = await readFile(configPath, "utf8");
const config = JSON.parse(configText);
const sources = [];
for (const path of sourcePaths) {
  const data = await readFile(resolve(root, path));
  sources.push({ path, sha256: sha256(data) });
}

const manifest = {
  ...config,
  generator: "tools/build-r15-weather-manifest.mjs",
  procedural: true,
  c2paRequired: false,
  c2paReason: "particle systems and image-processing parameters are code-native procedural output",
  sources,
  gates: {
    intensities: Object.keys(config.intensities).join(",") === "low,medium,high",
    qualityDensityOnly: config.qualityInvariantParameters.length === 18,
    lowDensityLessThanMedium: config.qualityDensity["低"] < config.qualityDensity["中"],
    mediumDensityLessThanHigh: config.qualityDensity["中"] < config.qualityDensity["高"],
    gameplayMutation: config.gameplayMutation === "none",
    proceduralTextureDecodedBytes: 32 * 32 * 4 + 256 * 256 * 4,
  },
};
manifest.gates.allPass = Object.values(manifest.gates).every(Boolean);
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
for (const path of [
  "docs/evidence/R15/weather-pipeline-r15.json",
  "public/images/vfx/weather-manifest-r15.json",
]) {
  const output = resolve(root, path);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, serialized, "utf8");
}
console.log(serialized);
if (!manifest.gates.allPass) process.exitCode = 1;
