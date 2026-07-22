import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const LEGACY_STEP_SECONDS = 0.25;
const SAMPLE_COUNT = 1_001;
const TARGET_INTERVALS = Object.freeze([0.496, 0.510]);

function option(name) {
  const index = process.argv.findIndex((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (index < 0) return undefined;
  const argument = process.argv[index];
  return argument.includes("=") ? argument.slice(argument.indexOf("=") + 1) : process.argv[index + 1];
}

function observeLegacyResetCadence(spawnInterval, spawnCount, stepSeconds) {
  const spawnTimes = [];
  let timer = spawnInterval;
  let elapsed = 0;
  while (spawnTimes.length < spawnCount) {
    elapsed += stepSeconds;
    timer -= stepSeconds;
    if (timer <= 0) {
      spawnTimes.push(elapsed);
      timer = spawnInterval;
    }
  }
  return (spawnTimes.at(-1) - spawnTimes[0]) / (spawnTimes.length - 1);
}

function rounded(value) {
  return Number(value.toFixed(9));
}

const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const simulation = await vite.ssrLoadModule("/src/game/waveSimulation.ts");
  const cases = TARGET_INTERVALS.map((targetInterval) => {
    const legacyObserved = observeLegacyResetCadence(targetInterval, SAMPLE_COUNT, LEGACY_STEP_SECONDS);
    const corrected = simulation.observeSpawnCadence(targetInterval, SAMPLE_COUNT);
    assert(
      corrected.relativeError < 0.01,
      `corrected cadence error must stay below 1% for ${targetInterval}s; observed ${corrected.observedAverageInterval}s`,
    );
    return {
      targetInterval,
      legacyObservedAverageInterval: rounded(legacyObserved),
      legacyRelativeError: rounded(Math.abs(legacyObserved - targetInterval) / targetInterval),
      correctedObservedAverageInterval: rounded(corrected.observedAverageInterval),
      correctedRelativeError: rounded(corrected.relativeError),
      correctedPassesUnderOnePercent: corrected.relativeError < 0.01,
    };
  });
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sampleCount: SAMPLE_COUNT,
    legacyMethod: {
      stepSeconds: LEGACY_STEP_SECONDS,
      timerPolicy: "reset to spawnInterval after each spawn; discarded overshoot",
    },
    correctedMethod: {
      stepSeconds: simulation.SIMULATION_STEP_SECONDS,
      timerPolicy: "fractional remainder carry; multiple triggers allowed in one step",
    },
    acceptance: "absolute relative error < 1% for every target interval",
    cases,
    pass: cases.every((entry) => entry.correctedPassesUnderOnePercent),
  };
  for (const entry of cases) {
    console.log(
      `spawn=${entry.targetInterval.toFixed(3)}s legacy=${entry.legacyObservedAverageInterval.toFixed(6)}s corrected=${entry.correctedObservedAverageInterval.toFixed(6)}s error=${(entry.correctedRelativeError * 100).toFixed(4)}%`,
    );
  }
  const output = option("output");
  if (output) {
    const outputPath = resolve(root, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    console.log(`wrote ${output}`);
  }
} finally {
  await vite.close();
}
