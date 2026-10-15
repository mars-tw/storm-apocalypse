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
const FRESH_SEEDS = Object.freeze([
  0x020E_44F0, 0xBBA6_72EC, 0x9C90_1A21, 0xE417_9943, 0xACE8_C269,
  0x772E_856C, 0xD75F_2C1C, 0xFEFC_0D66, 0x279C_6BD1, 0x56B0_D7B7,
  0x6CFD_73A8, 0xC4B9_7FE0, 0x06CF_AD16, 0xA367_B773, 0x8C74_B0FB,
  0xAA07_3F91, 0x922D_4301, 0xE685_B0FE, 0xD897_4A53, 0xD870_9682,
]);
const SEED_SETS = Object.freeze({ fixed: FIXED_SEEDS, fresh: FRESH_SEEDS });
const WAVES = Object.freeze([25, 26, 27, 28, 29, 30]);
const GENERAL_FINAL_WIN_RATE = Object.freeze({ min: 0.15, max: 0.4 });
const MAXED_FINAL_WIN_RATE = Object.freeze({ min: 0.5, max: 0.7 });
const MAXED_W29_WIN_RATE = Object.freeze({ min: 0.4, max: 0.6 });
const GENERAL_MID_WIN_RATES = Object.freeze({
  25: Object.freeze({ min: 0.7, max: 0.95 }),
  26: Object.freeze({ min: 0.55, max: 0.85 }),
  27: Object.freeze({ min: 0.45, max: 0.8 }),
  28: Object.freeze({ min: 0.35, max: 0.75 }),
});
const MAX_CROSS_SEED_WIN_RATE_DELTA = 0.15;

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

function inRange(value, range) {
  return value >= range.min && value <= range.max;
}

function mean(values) {
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
}

function summaryFor(batch, loadout, wave) {
  const summary = batch.summaries.find((entry) => entry.loadout === loadout && entry.wave === wave);
  assert(summary, `missing ${loadout} W${wave} summary`);
  return summary;
}

function isNonIncreasing(values) {
  return values.every((value, index) => index === 0 || value <= values[index - 1]);
}

function isNonDecreasing(values) {
  return values.every((value, index) => index === 0 || value >= values[index - 1]);
}

function buildR22Acceptance(batch) {
  const generalMid = [25, 26, 27, 28].map((wave) => summaryFor(batch, "general", wave));
  const maxedLate = [28, 29, 30].map((wave) => summaryFor(batch, "maxed", wave));
  const maxedW27 = summaryFor(batch, "maxed", 27);
  const totalEnemyHp = WAVES.map((wave) => summaryFor(batch, "maxed", wave).totalEnemyHp);
  const generalW30 = summaryFor(batch, "general", 30);
  const generalMidRates = generalMid.map((entry) => entry.winRate);
  const maxedLateRates = maxedLate.map((entry) => entry.winRate);
  const gates = {
    generalW25To28WithinPlayableRanges: generalMid.every((entry) => inRange(entry.winRate, GENERAL_MID_WIN_RATES[entry.wave])),
    generalW25To28NonIncreasing: isNonIncreasing(generalMidRates),
    generalW25To28DropsAtLeast15Points: generalMidRates[0] - generalMidRates.at(-1) >= 0.15,
    maxedW27OrW28BelowPerfect: maxedW27.winRate < 1 || maxedLate[0].winRate < 1,
    maxedW29WinRate40To60: inRange(maxedLate[1].winRate, MAXED_W29_WIN_RATE),
    maxedWave30WinRate50To70: inRange(maxedLate[2].winRate, MAXED_FINAL_WIN_RATE),
    maxedW28To30NonIncreasing: isNonIncreasing(maxedLateRates),
    totalEnemyHpW25To30NonDecreasing: isNonDecreasing(totalEnemyHp),
  };
  return {
    thresholds: {
      generalMidWinRates: GENERAL_MID_WIN_RATES,
      maxedW29WinRate: MAXED_W29_WIN_RATE,
      maxedWave30WinRate: MAXED_FINAL_WIN_RATE,
      generalMidMinimumDrop: 0.15,
    },
    informational: {
      generalWave30WinRate: generalW30.winRate,
      status: "informational_only",
      reason: "W30 general is not a representative persistent-roguelite end-state loadout",
    },
    observed: {
      generalW25To28WinRates: generalMidRates,
      maxedW28To30WinRates: maxedLateRates,
      totalEnemyHpW25To30: totalEnemyHp,
    },
    gates,
    pass: Object.values(gates).every(Boolean),
  };
}

function summarizeDiagnosticRuns(id, label, runs) {
  return {
    id,
    label,
    wins: runs.filter((run) => run.result === "victory").length,
    runs: runs.length,
    winRate: Number((runs.filter((run) => run.result === "victory").length / runs.length).toFixed(3)),
    meanSurvivalSeconds: mean(runs.map((run) => run.survivalSeconds)),
    meanKills: mean(runs.map((run) => run.killed)),
    meanMaxAlive: mean(runs.map((run) => run.maxAlive)),
    meanMaxAtBarrier: mean(runs.map((run) => run.maxAtBarrier)),
    meanBarrierDamage: mean(runs.map((run) => run.barrierDamage)),
  };
}

function buildCliffAnalysis(batch, module) {
  const from = batch.summaries.find((entry) => entry.loadout === "general" && entry.wave === 26);
  const to = batch.summaries.find((entry) => entry.loadout === "general" && entry.wave === 27);
  assert(from && to, "missing general W26/W27 summaries");
  const fromCount = Object.values(from.composition).reduce((sum, value) => sum + value, 0);
  const toCount = Object.values(to.composition).reduce((sum, value) => sum + value, 0);
  const baseHp = (wave) => 3 + Math.floor(wave * 0.72);
  const speedBase = (wave) => 0.92 + wave * 0.025;
  const hpMultiplierAtW26Durability = baseHp(26) / baseHp(27);
  const speedMultiplierAtW26Pace = speedBase(26) / speedBase(27);
  const general = module.SIMULATION_LOADOUTS.find((entry) => entry.id === "general");
  assert(general, "missing general loadout");
  const scenarios = [
    ["baseline_w27", "W27 原始值", {}],
    ["w26_enemy_count", "只把敵數維持 W26", { enemyCount: fromCount }],
    ["w26_enemy_hp", "只把單體 HP 維持 W26", { hpMultiplier: hpMultiplierAtW26Durability }],
    ["w26_spawn_interval", "只把生成間隔維持 W26", { spawnInterval: from.spawnInterval }],
    ["w26_enemy_speed", "只把移速維持 W26", { speedMultiplier: speedMultiplierAtW26Pace }],
    ["w26_all_inputs", "敵數、HP、間隔、移速皆維持 W26", {
      enemyCount: fromCount,
      hpMultiplier: hpMultiplierAtW26Durability,
      spawnInterval: from.spawnInterval,
      speedMultiplier: speedMultiplierAtW26Pace,
    }],
  ].map(([id, label, overrides]) => {
    const runs = [];
    for (const strategy of module.SIMULATION_STRATEGIES) {
      for (const seed of batch.seeds) runs.push(module.simulateWave(seed, 27, general, batch.profile, strategy, overrides));
    }
    return { ...summarizeDiagnosticRuns(id, label, runs), overrides };
  });
  const strategyRows = [26, 27].flatMap((wave) => module.SIMULATION_STRATEGIES.map((strategy) => {
    const runs = batch.runs.filter((run) => run.loadout === "general" && run.wave === wave && run.strategy === strategy.id);
    return { wave, strategy: strategy.id, ...summarizeDiagnosticRuns("observed", strategy.label, runs) };
  }));
  return {
    question: "修正生成時鐘後，一般配置 W26→W27 是否仍有額外斷崖？",
    observedInputs: {
      enemyCount: { w26: fromCount, w27: toCount, delta: toCount - fromCount },
      totalEnemyHp: { w26: from.totalEnemyHp, w27: to.totalEnemyHp, delta: to.totalEnemyHp - from.totalEnemyHp, ratio: Number((to.totalEnemyHp / from.totalEnemyHp).toFixed(3)) },
      meanHpPerEnemy: { w26: Number((from.totalEnemyHp / fromCount).toFixed(3)), w27: Number((to.totalEnemyHp / toCount).toFixed(3)) },
      spawnInterval: { w26: from.spawnInterval, w27: to.spawnInterval, ratio: Number((to.spawnInterval / from.spawnInterval).toFixed(3)) },
      observedAverageSpawnCadence: {
        w26: module.observeSpawnCadence(from.spawnInterval),
        w27: module.observeSpawnCadence(to.spawnInterval),
      },
      heavyComposition: {
        w26: { brute: from.composition.brute, boss: from.composition.boss, share: Number(((from.composition.brute + from.composition.boss) / fromCount).toFixed(3)) },
        w27: { brute: to.composition.brute, boss: to.composition.boss, share: Number(((to.composition.brute + to.composition.boss) / toCount).toFixed(3)) },
      },
      baseSpeed: { w26: Number(speedBase(26).toFixed(3)), w27: Number(speedBase(27).toFixed(3)), ratio: Number((speedBase(27) / speedBase(26)).toFixed(3)) },
      towerLevels: general.towers,
      towerStatsChanged: false,
    },
    observedOutputs: {
      winRate: { w26: from.winRate, w27: to.winRate },
      meanMaxAlive: { w26: from.meanMaxAlive, w27: to.meanMaxAlive },
      meanMaxAtBarrier: { w26: from.meanMaxAtBarrier, w27: to.meanMaxAtBarrier },
      meanKills: { w26: from.killed.mean, w27: to.killed.mean },
      meanBarrierDamage: { w26: from.barrierDamage.mean, w27: to.barrierDamage.mean },
      meanDamageBySource: { w26: from.meanDamageBySource, w27: to.meanDamageBySource },
    },
    counterfactuals: scenarios,
    byStrategy: strategyRows,
  };
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
      beforeTotalEnemyHp: baseline.totalEnemyHp,
      afterTotalEnemyHp: current.totalEnemyHp,
      beforeMeanMaxAlive: baseline.meanMaxAlive,
      afterMeanMaxAlive: current.meanMaxAlive,
      beforeMeanMaxAtBarrier: baseline.meanMaxAtBarrier,
      afterMeanMaxAtBarrier: current.meanMaxAtBarrier,
      beforeSpawnInterval: baseline.spawnInterval,
      afterSpawnInterval: current.spawnInterval,
    };
  });
  const earlierBefore = before.runs.filter((run) => run.wave < 30).map(comparableRun);
  const earlierAfter = after.runs.filter((run) => run.wave < 30).map(comparableRun);
  const waves25To29Identical = JSON.stringify(earlierBefore) === JSON.stringify(earlierAfter);
  const allGameplayRunsIdentical = JSON.stringify(before.runs.map(comparableRun)) === JSON.stringify(after.runs.map(comparableRun));
  const maxedFinal = after.summaries.find((entry) => entry.loadout === "maxed" && entry.wave === 30);
  const generalFinal = after.summaries.find((entry) => entry.loadout === "general" && entry.wave === 30);
  assert(maxedFinal && generalFinal, "missing wave 30 summaries");
  const isR20Reevaluation = before.profile.id === "r19" && after.profile.id === "r20";
  const isR22Acceptance = after.profile.id === "r22";
  const acceptance = isR22Acceptance ? buildR22Acceptance(after) : undefined;
  const gates = isR22Acceptance
    ? acceptance.gates
    : isR20Reevaluation
    ? {
        maxedWave30WinRate50To70: inRange(maxedFinal.winRate, MAXED_FINAL_WIN_RATE),
        generalWave30RemainsAtOrBelow40: generalFinal.winRate <= GENERAL_FINAL_WIN_RATE.max,
        waves25To29Unchanged: waves25To29Identical,
      }
    : {
        maxedWave30WinRate50To70: inRange(maxedFinal.winRate, MAXED_FINAL_WIN_RATE),
        waves25To29Unchanged: waves25To29Identical,
        rejectedR21GameplayFullyRemoved: allGameplayRunsIdentical,
      };
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    comparisonKind: isR22Acceptance ? "r22_balance_acceptance" : isR20Reevaluation ? "r20_reevaluation" : "r21_guard_revalidation",
    beforeProfile: before.profile,
    afterProfile: after.profile,
    sameSeeds: true,
    waves25To29Identical,
    allGameplayRunsIdentical,
    thresholds: acceptance?.thresholds ?? {
        maxedWave30WinRate: MAXED_FINAL_WIN_RATE,
    },
    informational: acceptance?.informational ?? {
      generalWave30WinRate: generalFinal.winRate,
      status: "informational_only",
      legacyReferenceRange: GENERAL_FINAL_WIN_RATE,
      reason: "general-at-W30 is not a representative persistent-roguelite end-state loadout",
    },
    gates,
    pass: Object.values(gates).every(Boolean),
    rows,
  };
}

function buildSeedSetComparison(reference, validation) {
  assert(reference.profile.id === "r22" && validation.profile.id === "r22", "cross-seed comparison requires two R22 batches");
  assert.deepEqual(reference.waves, validation.waves, "cross-seed wave arrays differ");
  assert(reference.seeds.length === 20 && validation.seeds.length === 20, "cross-seed comparison requires 20 seeds per set");
  assert(reference.seeds.every((seed) => !validation.seeds.includes(seed)), "fixed and fresh seed sets overlap");
  const rows = validation.summaries.map((current) => {
    const baseline = summaryFor(reference, current.loadout, current.wave);
    return {
      loadout: current.loadout,
      wave: current.wave,
      fixedWinRate: baseline.winRate,
      freshWinRate: current.winRate,
      absoluteDelta: Number(Math.abs(current.winRate - baseline.winRate).toFixed(3)),
    };
  });
  const fixedAcceptance = buildR22Acceptance(reference);
  const freshAcceptance = buildR22Acceptance(validation);
  const maxAbsoluteDelta = Math.max(...rows.map((row) => row.absoluteDelta));
  const gates = {
    fixedAcceptancePasses: fixedAcceptance.pass,
    freshAcceptancePasses: freshAcceptance.pass,
    allW25To30WinRateDeltasAtMost15Points: maxAbsoluteDelta <= MAX_CROSS_SEED_WIN_RATE_DELTA,
  };
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    comparisonKind: "r22_fixed_fresh_validation",
    profile: validation.profile,
    fixedSeeds: reference.seeds,
    freshSeeds: validation.seeds,
    thresholds: { maxAbsoluteWinRateDelta: MAX_CROSS_SEED_WIN_RATE_DELTA },
    fixedAcceptance,
    freshAcceptance,
    observed: { maxAbsoluteWinRateDelta: maxAbsoluteDelta },
    gates,
    pass: Object.values(gates).every(Boolean),
    rows,
  };
}

function printTable(batch) {
  console.log(`profile=${batch.profile.id}; wave30EnemyBonus=${batch.profile.finalWaveEnemyBonus}; wave30SpawnMultiplier=${batch.profile.finalWaveSpawnMultiplier}; wave30HpMultiplier=${batch.profile.finalWaveHpMultiplier}; wave30DamageMultiplier=${batch.profile.finalWaveDamageMultiplier}; seeds=${batch.seeds.length}; runs=${batch.runs.length}; timestep=${batch.timestepSeconds}`);
  console.log("loadout wave wins rate survival_p50 kills_p50 hp_p50 enemy_hp max_alive max_at_wall spawn_s");
  for (const row of batch.summaries) {
    console.log([
      row.loadout.padEnd(7),
      String(row.wave).padStart(2),
      `${String(row.wins).padStart(2)}/${row.runs}`,
      row.winRate.toFixed(2),
      row.survivalSeconds.median.toFixed(2).padStart(7),
      row.killed.median.toFixed(1).padStart(5),
      row.remainingHp.median.toFixed(1).padStart(5),
      row.totalEnemyHp.toFixed(0).padStart(8),
      row.meanMaxAlive.toFixed(1).padStart(7),
      row.meanMaxAtBarrier.toFixed(1).padStart(7),
      row.spawnInterval.toFixed(3),
    ].join(" "));
  }
}

const profile = option("profile", "r22");
assert(["r19", "r20", "r21", "r22"].includes(profile), `unknown profile: ${profile}`);
const seedSet = option("seed-set", "fixed");
assert(seedSet in SEED_SETS, `unknown seed set: ${seedSet}`);
const output = option("output");
const comparePath = option("compare");
const comparisonOutput = option("comparison-output");
const compareSeedsPath = option("compare-seeds");
const seedComparisonOutput = option("seed-comparison-output");
const reportOnly = process.argv.includes("--report-only");
const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
try {
  const module = await vite.ssrLoadModule("/src/game/waveSimulation.ts");
  const batchStartedAt = performance.now();
  const simulated = module.simulateBalanceBatch(profile, SEED_SETS[seedSet], WAVES);
  const acceptance = profile === "r22" ? buildR22Acceptance(simulated) : undefined;
  const batch = acceptance ? { ...simulated, seedSet, acceptance } : { ...simulated, seedSet };
  const batchElapsedSeconds = Number(((performance.now() - batchStartedAt) / 1_000).toFixed(3));
  printTable(batch);
  if (acceptance) console.log(`R22 acceptance gates: ${JSON.stringify(acceptance.gates)}`);
  console.log(`batchElapsedSeconds=${batchElapsedSeconds}`);
  if (output) {
    const diagnosticStartedAt = performance.now();
    const diagnostics = { w26ToW27Cliff: buildCliffAnalysis(batch, module) };
    const diagnosticElapsedSeconds = Number(((performance.now() - diagnosticStartedAt) / 1_000).toFixed(3));
    const evidence = { ...batch, performance: { batchElapsedSeconds, diagnosticElapsedSeconds }, diagnostics };
    const outputPath = resolve(root, output);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
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
    if (!reportOnly) assert(comparison.pass, `comparison gate failed: ${JSON.stringify(comparison.gates)}`);
  }
  if (compareSeedsPath) {
    const reference = JSON.parse(await readFile(resolve(root, compareSeedsPath), "utf8"));
    const seedComparison = buildSeedSetComparison(reference, batch);
    console.log(`fixed/fresh gates: ${JSON.stringify(seedComparison.gates)}`);
    if (seedComparisonOutput) {
      const seedComparisonPath = resolve(root, seedComparisonOutput);
      await mkdir(dirname(seedComparisonPath), { recursive: true });
      await writeFile(seedComparisonPath, `${JSON.stringify(seedComparison, null, 2)}\n`, "utf8");
      console.log(`wrote ${seedComparisonOutput}`);
    }
    if (!reportOnly) assert(seedComparison.pass, `fixed/fresh gate failed: ${JSON.stringify(seedComparison.gates)}`);
  }
  if (acceptance && !reportOnly) assert(acceptance.pass, `R22 acceptance gate failed: ${JSON.stringify(acceptance.gates)}`);
} finally {
  await vite.close();
}
