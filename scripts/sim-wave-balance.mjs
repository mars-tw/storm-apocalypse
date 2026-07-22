import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const WAVES = Object.freeze([25, 26, 27, 28, 29, 30]);

function option(name, fallback) {
  const index = process.argv.findIndex((value) => value === `--${name}` || value.startsWith(`--${name}=`));
  if (index < 0) return fallback;
  const argument = process.argv[index];
  return argument.includes("=") ? argument.slice(argument.indexOf("=") + 1) : process.argv[index + 1];
}

function comparableRun(run) {
  const { profile: _profile, ...comparable } = run;
  return comparable;
}

function buildComparison(before, after) {
  assert.deepEqual(after.seeds, before.seeds, "before/after seed arrays differ");
  assert.deepEqual(after.waves, before.waves, "before/after wave arrays differ");
  const rows = after.summaries.map((current) => {
    const baseline = before.summaries.find((entry) => entry.loadout === current.loadout && entry.wave === current.wave);
    assert(baseline, `missing baseline summary for ${current.loadout} wave ${current.wave}`);
    return {
      loadout: current.loadout,
      wave: current.wave,
      beforeWinRate: baseline.winRate,
      afterWinRate: current.winRate,
      winRateDelta: Number((current.winRate - baseline.winRate).toFixed(3)),
      beforeMedianSurvivalSeconds: baseline.survivalSeconds.median,
      afterMedianSurvivalSeconds: current.survivalSeconds.median,
      beforeMedianKills: baseline.killed.median,
      afterMedianKills: current.killed.median,
      beforeMedianRemainingHp: baseline.remainingHp.median,
      afterMedianRemainingHp: current.remainingHp.median,
      beforeSpawnInterval: baseline.spawnInterval,
      afterSpawnInterval: current.spawnInterval,
    };
  });
  const earlyBefore = before.runs.filter((run) => run.wave < 30).map(comparableRun);
  const earlyAfter = after.runs.filter((run) => run.wave < 30).map(comparableRun);
  const earlierWavesIdentical = JSON.stringify(earlyBefore) === JSON.stringify(earlyAfter);
  const maxedFinal = after.summaries.find((entry) => entry.loadout === "maxed" && entry.wave === 30);
  const generalFinal = after.summaries.find((entry) => entry.loadout === "general" && entry.wave === 30);
  assert(maxedFinal && generalFinal, "missing wave 30 summaries");
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    beforeProfile: before.profile,
    afterProfile: after.profile,
    sameSeeds: true,
    earlierWavesIdentical,
    gates: {
      maxedWave30WinRate50To70: maxedFinal.winRate >= 0.5 && maxedFinal.winRate <= 0.7,
      generalWave30RemainsChallenging: generalFinal.winRate <= 0.4,
      waves25To29Unchanged: earlierWavesIdentical,
    },
    rows,
  };
}

function printTable(batch) {
  console.log(`profile=${batch.profile.id}; wave30EnemyBonus=${batch.profile.finalWaveEnemyBonus}; wave30SpawnMultiplier=${batch.profile.finalWaveSpawnMultiplier}; wave30HpMultiplier=${batch.profile.finalWaveHpMultiplier}; wave30DamageMultiplier=${batch.profile.finalWaveDamageMultiplier}; seeds=${batch.seeds.length}; runs=${batch.runs.length}`);
  console.log("loadout wave wins rate survival_p50 kills_p50 hp_p50 max_alive max_at_wall spawn_s");
  for (const row of batch.summaries) {
    console.log([
      row.loadout.padEnd(7),
      String(row.wave).padStart(2),
      `${String(row.wins).padStart(2)}/${row.runs}`,
      row.winRate.toFixed(2),
      row.survivalSeconds.median.toFixed(2).padStart(7),
      row.killed.median.toFixed(1).padStart(5),
      row.remainingHp.median.toFixed(1).padStart(5),
      row.meanMaxAlive.toFixed(1).padStart(7),
      row.meanMaxAtBarrier.toFixed(1).padStart(7),
      row.spawnInterval.toFixed(3),
    ].join(" "));
  }
}

const profile = option("profile", "r20");
assert(["r19", "r20"].includes(profile), `unknown profile: ${profile}`);
const output = option("output");
const comparePath = option("compare");
const comparisonOutput = option("comparison-output");
const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const module = await vite.ssrLoadModule("/src/game/waveSimulation.ts");
  const batch = module.simulateBalanceBatch(profile, FIXED_SEEDS, WAVES);
  printTable(batch);
  if (output) {
    const outputPath = resolve(root, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");
    console.log(`wrote ${output}`);
  }
  if (comparePath) {
    const before = JSON.parse(await readFile(resolve(root, comparePath), "utf8"));
    const comparison = buildComparison(before, batch);
    console.log(`comparison gates: ${JSON.stringify(comparison.gates)}`);
    if (comparisonOutput) {
      const comparisonPath = resolve(root, comparisonOutput);
      await mkdir(dirname(comparisonPath), { recursive: true });
      await writeFile(comparisonPath, `${JSON.stringify(comparison, null, 2)}\n`, "utf8");
      console.log(`wrote ${comparisonOutput}`);
    }
    assert(Object.values(comparison.gates).every(Boolean), `comparison gate failed: ${JSON.stringify(comparison.gates)}`);
  }
} finally {
  await vite.close();
}
