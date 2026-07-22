import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const FIXED_SEEDS = Object.freeze([
  0x0005_1A7E, 0x0012_C0DE, 0x002A_11CE, 0x003D_EF01, 0x0048_8A21,
  0x005F_0B5E, 0x006C_A11E, 0x0077_51DE, 0x0089_BA11, 0x009A_7E57,
  0x00A5_5EED, 0x00B4_1A5E, 0x00C3_0FF5, 0x00D2_F00D, 0x00E1_7E57,
  0x00F0_ACE1, 0x0101_BA5E, 0x0112_CAFE, 0x0123_D00D, 0x0134_F17E,
]);
const HP_SCALES = Object.freeze([1, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]);

function option(name) {
  const index = process.argv.findIndex((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (index < 0) return undefined;
  const argument = process.argv[index];
  return argument.includes("=") ? argument.slice(argument.indexOf("=") + 1) : process.argv[index + 1];
}

function summarizeCandidate(module, director, loadout, wave, hpScale) {
  const profile = director.WAVE_BALANCE_PROFILES.r20;
  const plan = director.getWavePlan(wave, profile);
  const runs = module.SIMULATION_STRATEGIES.flatMap((strategy) => FIXED_SEEDS.map((seed) => module.simulateWave(
    seed,
    wave,
    loadout,
    profile,
    strategy,
    { hpMultiplier: plan.hpMultiplier * hpScale },
  )));
  const strategyWins = Object.fromEntries(module.SIMULATION_STRATEGIES.map((strategy) => [
    strategy.id,
    runs.filter((run) => run.strategy === strategy.id && run.result === "victory").length,
  ]));
  const wins = runs.filter((run) => run.result === "victory").length;
  return {
    loadout: loadout.id,
    wave,
    event: plan.event,
    hpScale,
    effectiveHpMultiplier: Number((plan.hpMultiplier * hpScale).toFixed(6)),
    wins,
    runs: runs.length,
    winRate: Number((wins / runs.length).toFixed(3)),
    strategyWins,
  };
}

const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const [module, director] = await Promise.all([
    vite.ssrLoadModule("/src/game/waveSimulation.ts"),
    vite.ssrLoadModule("/src/game/waveDirector.ts"),
  ]);
  const general = module.SIMULATION_LOADOUTS.find((entry) => entry.id === "general");
  const maxed = module.SIMULATION_LOADOUTS.find((entry) => entry.id === "maxed");
  if (!general || !maxed) throw new Error("simulation loadouts are missing");
  const startedAt = performance.now();
  const rows = [];
  for (const wave of [25, 26, 27, 28, 29, 30]) {
    for (const hpScale of HP_SCALES) rows.push(summarizeCandidate(module, director, general, wave, hpScale));
  }
  for (const hpScale of HP_SCALES) rows.push(summarizeCandidate(module, director, maxed, 29, hpScale));
  const elapsedSeconds = Number(((performance.now() - startedAt) / 1_000).toFixed(3));
  const evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baselineProfile: "r20",
    timestepSeconds: module.SIMULATION_STEP_SECONDS,
    seeds: FIXED_SEEDS,
    strategies: module.SIMULATION_STRATEGIES.map((entry) => entry.id),
    hpScales: HP_SCALES,
    elapsedSeconds,
    rows,
  };
  for (const row of rows) {
    console.log(`${row.loadout} W${row.wave} hpScale=${row.hpScale.toFixed(2)} wins=${row.wins}/${row.runs} rate=${row.winRate.toFixed(3)}`);
  }
  console.log(`elapsedSeconds=${elapsedSeconds}`);
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
