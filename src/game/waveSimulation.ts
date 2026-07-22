import {
  COMBAT_POSITIONS,
  COMBAT_TIMING,
  enemyAttackTimings,
  enemyCombatStats,
  enemySpawnPosition,
  playerAttackStats,
  towerCombatStats,
  type CombatPoint,
} from "./combatRules";
import type { EmployeeId, ProtagonistId, TowerId, WeaponId } from "./state";
import {
  enemyTypeForWave,
  getWavePlan,
  WAVE_BALANCE_PROFILES,
  type DirectorZombieType,
  type WaveBalanceProfile,
} from "./waveDirector";

const TOWER_ORDER: readonly TowerId[] = ["ballista", "frost", "cannon"];
const MAX_SECONDS = 180;
export const SIMULATION_STEP_SECONDS = 1 / 60;

export interface SpawnClockAdvance {
  nextTimer: number;
  triggerCount: number;
}

/**
 * Advance a fractional spawn clock without discarding sub-step remainder.
 * The loop also keeps the clock correct if a future profile uses an interval
 * shorter than one simulation step.
 */
export function advanceSpawnClock(
  timer: number,
  stepSeconds: number,
  spawnInterval: number,
  remainingSpawns = Number.POSITIVE_INFINITY,
): SpawnClockAdvance {
  if (!(stepSeconds > 0) || !(spawnInterval > 0) || remainingSpawns <= 0) {
    return { nextTimer: timer, triggerCount: 0 };
  }
  let nextTimer = timer - stepSeconds;
  let triggerCount = 0;
  while (nextTimer <= 0 && triggerCount < remainingSpawns) {
    triggerCount += 1;
    nextTimer += spawnInterval;
  }
  return { nextTimer, triggerCount };
}

export function observeSpawnCadence(
  spawnInterval: number,
  spawnCount = 1_001,
  stepSeconds = SIMULATION_STEP_SECONDS,
): { observedAverageInterval: number; relativeError: number; spawnCount: number } {
  if (!(spawnInterval > 0) || spawnCount < 2 || !(stepSeconds > 0)) {
    throw new RangeError("spawnInterval and stepSeconds must be positive; spawnCount must be at least 2");
  }
  const spawnTimes: number[] = [];
  let elapsed = 0;
  let timer = spawnInterval;
  while (spawnTimes.length < spawnCount) {
    elapsed += stepSeconds;
    const advanced = advanceSpawnClock(timer, stepSeconds, spawnInterval, spawnCount - spawnTimes.length);
    timer = advanced.nextTimer;
    for (let index = 0; index < advanced.triggerCount; index += 1) spawnTimes.push(elapsed);
  }
  const observedAverageInterval = (spawnTimes[spawnTimes.length - 1] - spawnTimes[0]) / (spawnTimes.length - 1);
  return {
    observedAverageInterval,
    relativeError: Math.abs(observedAverageInterval - spawnInterval) / spawnInterval,
    spawnCount: spawnTimes.length,
  };
}

export interface SimulationLoadout {
  id: "maxed" | "general";
  label: string;
  protagonistId: ProtagonistId;
  towers: Readonly<Record<TowerId, number>>;
  employees: Readonly<Record<EmployeeId, number>>;
  customerAffinity: number;
  availableWeapons: readonly WeaponId[];
  operator: {
    initialReactionSeconds: readonly [number, number];
    retapDelaySeconds: readonly [number, number];
    axeCrowdThreshold: number;
  };
}

export interface SimulationStrategy {
  id: "default_frontline" | "left_intercept" | "towerline_support";
  label: string;
  position: CombatPoint;
}

export const SIMULATION_STRATEGIES: readonly SimulationStrategy[] = [
  { id: "default_frontline", label: "預設前線持續 SMG", position: { ...COMBAT_POSITIONS.playerStart } },
  { id: "left_intercept", label: "左側攔截持續 SMG", position: { x: -2, z: -1 } },
  { id: "towerline_support", label: "塔線支援持續 SMG", position: { ...COMBAT_POSITIONS.towers.ballista } },
] as const;

export const SIMULATION_LOADOUTS: readonly SimulationLoadout[] = [
  {
    id: "maxed",
    label: "滿配：三塔 Lv.3／員工 Lv.2／常客 10／退伍狙擊手",
    protagonistId: "vet_sniper",
    towers: { ballista: 3, frost: 3, cannon: 3 },
    employees: { hunter: 2, cashier: 2, dog: 2 },
    customerAffinity: 10,
    availableWeapons: ["machete", "axe", "smg"],
    operator: {
      initialReactionSeconds: [0.18, 0.58],
      retapDelaySeconds: [0.025, 0.14],
      axeCrowdThreshold: 999,
    },
  },
  {
    id: "general",
    label: "一般：三塔 Lv.2／員工 Lv.1／常客 6／屠夫老闆娘",
    protagonistId: "butcher_matron",
    towers: { ballista: 2, frost: 2, cannon: 2 },
    employees: { hunter: 1, cashier: 1, dog: 1 },
    customerAffinity: 6,
    availableWeapons: ["machete", "axe", "smg"],
    operator: {
      initialReactionSeconds: [0.28, 0.78],
      retapDelaySeconds: [0.06, 0.22],
      axeCrowdThreshold: 999,
    },
  },
] as const;

interface EnemyState {
  id: number;
  type: DirectorZombieType;
  hp: number;
  maxHp: number;
  x: number;
  z: number;
  speed: number;
  damage: number;
  slowTimer: number;
  attackPhase: "approach" | "anticipation" | "recovery";
  attackTimer: number;
  alive: boolean;
}

interface ProjectileState {
  source: TowerId;
  targetId: number;
  remaining: number;
  damage: number;
  splash: number;
  slow: number;
}

interface PendingPlayerAttack {
  weapon: WeaponId;
  elapsed: number;
  resolved: boolean;
}

type DamageSource = "player" | TowerId;

export interface WaveSimulationRun {
  seed: number;
  profile: WaveBalanceProfile["id"];
  loadout: SimulationLoadout["id"];
  strategy: SimulationStrategy["id"];
  wave: number;
  event: string;
  result: "victory" | "defeat";
  failureReason: "cleared" | "barrier_destroyed" | "time_limit";
  survivalSeconds: number;
  clearSeconds: number | null;
  spawned: number;
  unspawned: number;
  killed: number;
  remainingEnemies: number;
  remainingHp: number;
  startingHp: number;
  totalEnemyHp: number;
  composition: Record<DirectorZombieType, number>;
  killsBySource: Record<DamageSource, number>;
  damageBySource: Record<DamageSource, number>;
  effectiveDamageBySource: Record<DamageSource, number>;
  barrierDamage: number;
  barrierHits: number;
  nurseBlocks: number;
  firstBarrierImpactSeconds: number | null;
  maxAlive: number;
  maxAtBarrier: number;
  playerAttacks: number;
  playerImpacts: number;
  playerWhiffs: number;
  playerAttackUptime: number;
  spawnInterval: number;
}

export interface WaveSimulationBatch {
  schemaVersion: 1;
  generatedAt: string;
  profile: WaveBalanceProfile;
  seeds: readonly number[];
  waves: readonly number[];
  timestepSeconds: number;
  method: {
    engine: string;
    spawnClock: string;
    spatialModel: string;
    operatorModel: string;
    deterministicInputs: string;
  };
  loadouts: readonly SimulationLoadout[];
  strategies: readonly SimulationStrategy[];
  runs: WaveSimulationRun[];
  summaries: WaveSimulationSummary[];
}

export interface DistributionSummary {
  mean: number;
  p10: number;
  median: number;
  p90: number;
}

export interface WaveSimulationSummary {
  loadout: SimulationLoadout["id"];
  wave: number;
  runs: number;
  wins: number;
  winRate: number;
  survivalSeconds: DistributionSummary;
  killed: DistributionSummary;
  remainingHp: DistributionSummary;
  barrierDamage: DistributionSummary;
  totalEnemyHp: number;
  spawnInterval: number;
  composition: Record<DirectorZombieType, number>;
  failureReasons: Record<WaveSimulationRun["failureReason"], number>;
  meanMaxAlive: number;
  meanMaxAtBarrier: number;
  meanDamageBySource: Record<DamageSource, number>;
}

export type WaveSimulationOverrides = Partial<Pick<
  ReturnType<typeof getWavePlan>,
  "enemyCount" | "spawnInterval" | "hpMultiplier" | "speedMultiplier" | "damageMultiplier"
>>;

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function distance(left: CombatPoint, right: CombatPoint): number {
  return Math.hypot(left.x - right.x, left.z - right.z);
}

function nearestEnemy(enemies: readonly EnemyState[], origin: CombatPoint, range: number): EnemyState | undefined {
  let nearest: EnemyState | undefined;
  let bestDistance = range;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const candidateDistance = distance(enemy, origin);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      nearest = enemy;
    }
  }
  return nearest;
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const value = sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
  return Number(value.toFixed(3));
}

function distribution(values: readonly number[]): DistributionSummary {
  const mean = values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  return {
    mean: Number(mean.toFixed(3)),
    p10: percentile(values, 0.1),
    median: percentile(values, 0.5),
    p90: percentile(values, 0.9),
  };
}

function roundRecord<T extends string>(record: Record<T, number>): Record<T, number> {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, Number((value as number).toFixed(3))])) as Record<T, number>;
}

export function simulateWave(
  seed: number,
  wave: number,
  loadout: SimulationLoadout,
  profile: WaveBalanceProfile,
  strategy: SimulationStrategy = SIMULATION_STRATEGIES[0],
  overrides: WaveSimulationOverrides = {},
): WaveSimulationRun {
  const gameRng = createRng(seed ^ 0xA511E9B3);
  const strategySalt = strategy.id === "default_frontline" ? 0x165667B1 : strategy.id === "left_intercept" ? 0x27D4EB2F : 0x85EBCA77;
  const operatorRng = createRng(seed ^ strategySalt ^ (loadout.id === "maxed" ? 0x63D83595 : 0xC2B2AE35));
  const plan = { ...getWavePlan(wave, profile), ...overrides };
  const enemies: EnemyState[] = [];
  const projectiles: ProjectileState[] = [];
  const towerCooldowns: Record<TowerId, number> = { ballista: 0, frost: 0, cannon: 0 };
  const composition: Record<DirectorZombieType, number> = { walker: 0, runner: 0, brute: 0, boss: 0 };
  const killsBySource: Record<DamageSource, number> = { player: 0, ballista: 0, frost: 0, cannon: 0 };
  const damageBySource: Record<DamageSource, number> = { player: 0, ballista: 0, frost: 0, cannon: 0 };
  const effectiveDamageBySource: Record<DamageSource, number> = { player: 0, ballista: 0, frost: 0, cannon: 0 };
  let elapsed = 0;
  let spawnTimer: number = COMBAT_TIMING.waveSpawnDelay;
  let enemiesToSpawn = plan.enemyCount;
  let spawned = 0;
  let totalEnemyHp = 0;
  let barrierHp = 100;
  let barrierDamage = 0;
  let barrierHits = 0;
  let nurseBlocks = 0;
  let firstBarrierImpactSeconds: number | null = null;
  let maxAlive = 0;
  let maxAtBarrier = 0;
  let nextEnemyId = 1;
  let playerCooldown = 0;
  let pendingPlayerAttack: PendingPlayerAttack | undefined;
  let playerAttacks = 0;
  let playerImpacts = 0;
  let playerWhiffs = 0;
  let playerActiveSeconds = 0;
  const initialRange = loadout.operator.initialReactionSeconds;
  const retapRange = loadout.operator.retapDelaySeconds;
  let nextPlayerInputAt = initialRange[0] + operatorRng() * (initialRange[1] - initialRange[0]);
  let failureReason: WaveSimulationRun["failureReason"] = "time_limit";

  const applyDamage = (enemy: EnemyState, damage: number, source: DamageSource): void => {
    if (!enemy.alive) return;
    damageBySource[source] += damage;
    effectiveDamageBySource[source] += Math.min(enemy.hp, damage);
    enemy.hp -= damage;
    if (enemy.hp > 0) return;
    enemy.alive = false;
    killsBySource[source] += 1;
  };

  const resolvePlayerAttack = (weapon: WeaponId): void => {
    const attack = playerAttackStats(weapon, loadout.protagonistId);
    playerImpacts += 1;
    if (attack.area) {
      const victims = enemies.filter((enemy) => enemy.alive && distance(enemy, strategy.position) < attack.range);
      for (const victim of victims) for (const damage of attack.hitDamages) applyDamage(victim, damage, "player");
      if (victims.length === 0) playerWhiffs += 1;
      return;
    }
    const target = nearestEnemy(enemies, strategy.position, attack.range);
    if (!target) {
      playerWhiffs += 1;
      return;
    }
    for (const damage of attack.hitDamages) applyDamage(target, damage, "player");
  };

  while (elapsed < MAX_SECONDS) {
    elapsed += SIMULATION_STEP_SECONDS;
    playerCooldown = Math.max(0, playerCooldown - SIMULATION_STEP_SECONDS);
    for (const id of TOWER_ORDER) towerCooldowns[id] = Math.max(0, towerCooldowns[id] - SIMULATION_STEP_SECONDS);

    if (pendingPlayerAttack) {
      const attack = playerAttackStats(pendingPlayerAttack.weapon, loadout.protagonistId);
      pendingPlayerAttack.elapsed += SIMULATION_STEP_SECONDS;
      playerActiveSeconds += SIMULATION_STEP_SECONDS;
      if (!pendingPlayerAttack.resolved && pendingPlayerAttack.elapsed >= attack.impact) {
        pendingPlayerAttack.resolved = true;
        resolvePlayerAttack(pendingPlayerAttack.weapon);
      }
      if (pendingPlayerAttack.elapsed >= attack.recovery) pendingPlayerAttack = undefined;
    }

    if (!pendingPlayerAttack && playerCooldown <= 0 && elapsed >= nextPlayerInputAt) {
      const axeStats = playerAttackStats("axe", loadout.protagonistId);
      const axeTargets = enemies.filter((enemy) => enemy.alive && distance(enemy, strategy.position) < axeStats.range).length;
      const weapon: WeaponId = loadout.availableWeapons.includes("axe") && axeTargets >= loadout.operator.axeCrowdThreshold
        ? "axe"
        : loadout.availableWeapons.includes("smg") ? "smg" : "machete";
      const attack = playerAttackStats(weapon, loadout.protagonistId);
      if (nearestEnemy(enemies, strategy.position, attack.range)) {
        pendingPlayerAttack = { weapon, elapsed: 0, resolved: false };
        playerCooldown = attack.recovery;
        playerAttacks += 1;
      }
      nextPlayerInputAt = elapsed + retapRange[0] + operatorRng() * (retapRange[1] - retapRange[0]);
    }

    if (enemiesToSpawn > 0) {
      const spawnClock = advanceSpawnClock(spawnTimer, SIMULATION_STEP_SECONDS, plan.spawnInterval, enemiesToSpawn);
      spawnTimer = spawnClock.nextTimer;
      for (let spawnIndex = 0; spawnIndex < spawnClock.triggerCount; spawnIndex += 1) {
        const order = enemiesToSpawn;
        const type = enemyTypeForWave(plan, order);
        const stats = enemyCombatStats(wave, type, plan);
        const position = enemySpawnPosition(order);
        enemies.push({
          id: nextEnemyId,
          type,
          hp: stats.hp,
          maxHp: stats.hp,
          x: position.x,
          z: position.z,
          speed: stats.speed,
          damage: stats.damage,
          slowTimer: 0,
          attackPhase: "approach",
          attackTimer: 0.2,
          alive: true,
        });
        nextEnemyId += 1;
        spawned += 1;
        totalEnemyHp += stats.hp;
        composition[type] += 1;
        enemiesToSpawn -= 1;
      }
    }

    let atBarrier = 0;
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      enemy.slowTimer = Math.max(0, enemy.slowTimer - SIMULATION_STEP_SECONDS);
      const target = COMBAT_POSITIONS.barrierTarget;
      const targetDistance = distance(enemy, target);
      if (targetDistance > COMBAT_TIMING.barrierAttackRange) {
        const slowFactor = enemy.slowTimer > 0 ? COMBAT_TIMING.frostSlowFactor : 1;
        const step = Math.min(targetDistance, enemy.speed * slowFactor * SIMULATION_STEP_SECONDS);
        enemy.x += (target.x - enemy.x) / targetDistance * step;
        enemy.z += (target.z - enemy.z) / targetDistance * step;
        enemy.attackPhase = "approach";
        enemy.attackTimer = 0;
      } else {
        atBarrier += 1;
        const timings = enemyAttackTimings(enemy.type);
        if (enemy.attackPhase === "approach") {
          enemy.attackPhase = "anticipation";
          enemy.attackTimer = timings.impact;
        } else {
          enemy.attackTimer -= SIMULATION_STEP_SECONDS;
        }
        if (enemy.attackPhase === "anticipation" && enemy.attackTimer <= 0) {
          const blocked = loadout.customerAffinity >= 6 && gameRng() < COMBAT_TIMING.nurseBlockChance;
          const damage = Math.max(0, enemy.damage - (blocked ? COMBAT_TIMING.nurseBlockReduction : 0));
          if (blocked) nurseBlocks += 1;
          barrierHp = Math.max(0, barrierHp - damage);
          barrierDamage += damage;
          barrierHits += 1;
          firstBarrierImpactSeconds ??= elapsed;
          enemy.attackPhase = "recovery";
          enemy.attackTimer = timings.recovery;
          if (barrierHp <= 0) {
            failureReason = "barrier_destroyed";
            break;
          }
        } else if (enemy.attackPhase === "recovery" && enemy.attackTimer <= 0) {
          enemy.attackPhase = "approach";
          enemy.attackTimer = 0;
        }
      }
    }
    const aliveCount = enemies.filter((enemy) => enemy.alive).length;
    maxAlive = Math.max(maxAlive, aliveCount);
    maxAtBarrier = Math.max(maxAtBarrier, atBarrier);
    if (barrierHp <= 0) break;

    for (const id of TOWER_ORDER) {
      const level = loadout.towers[id];
      if (level <= 0) continue;
      const stats = towerCombatStats(id, level);
      const target = nearestEnemy(enemies, COMBAT_POSITIONS.towers[id], stats.range);
      if (!target || towerCooldowns[id] > 0) continue;
      towerCooldowns[id] = stats.cooldown;
      projectiles.push({
        source: id,
        targetId: target.id,
        remaining: COMBAT_TIMING.projectileTravelSeconds,
        damage: stats.damage,
        splash: stats.splash,
        slow: stats.slow,
      });
    }

    for (let index = projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = projectiles[index];
      const target = enemies.find((enemy) => enemy.id === projectile.targetId);
      if (!target?.alive) {
        projectiles.splice(index, 1);
        continue;
      }
      projectile.remaining -= SIMULATION_STEP_SECONDS;
      if (projectile.remaining > 0) continue;
      const victims = projectile.splash > 0
        ? enemies.filter((enemy) => enemy.alive && distance(enemy, target) <= projectile.splash)
        : [target];
      for (const victim of victims) {
        if (projectile.slow > 0) victim.slowTimer = Math.max(victim.slowTimer, projectile.slow);
        applyDamage(victim, projectile.damage, projectile.source);
      }
      projectiles.splice(index, 1);
    }

    if (enemiesToSpawn === 0 && !enemies.some((enemy) => enemy.alive)) {
      failureReason = "cleared";
      break;
    }
  }

  const killed = Object.values(killsBySource).reduce((sum, value) => sum + value, 0);
  const result = failureReason === "cleared" ? "victory" : "defeat";
  return {
    seed,
    profile: profile.id,
    loadout: loadout.id,
    strategy: strategy.id,
    wave,
    event: plan.event,
    result,
    failureReason,
    survivalSeconds: Number(elapsed.toFixed(3)),
    clearSeconds: result === "victory" ? Number(elapsed.toFixed(3)) : null,
    spawned,
    unspawned: enemiesToSpawn,
    killed,
    remainingEnemies: plan.enemyCount - killed,
    remainingHp: barrierHp,
    startingHp: 100,
    totalEnemyHp,
    composition,
    killsBySource,
    damageBySource: roundRecord(damageBySource),
    effectiveDamageBySource: roundRecord(effectiveDamageBySource),
    barrierDamage: Number(barrierDamage.toFixed(3)),
    barrierHits,
    nurseBlocks,
    firstBarrierImpactSeconds: firstBarrierImpactSeconds === null ? null : Number(firstBarrierImpactSeconds.toFixed(3)),
    maxAlive,
    maxAtBarrier,
    playerAttacks,
    playerImpacts,
    playerWhiffs,
    playerAttackUptime: Number((playerActiveSeconds / elapsed).toFixed(3)),
    spawnInterval: Number(plan.spawnInterval.toFixed(6)),
  };
}

export function summarizeRuns(runs: readonly WaveSimulationRun[]): WaveSimulationSummary[] {
  const summaries: WaveSimulationSummary[] = [];
  for (const loadout of SIMULATION_LOADOUTS) {
    const waves = [...new Set(runs.filter((run) => run.loadout === loadout.id).map((run) => run.wave))].sort((left, right) => left - right);
    for (const wave of waves) {
      const selected = runs.filter((run) => run.loadout === loadout.id && run.wave === wave);
      if (selected.length === 0) continue;
      const meanDamageBySource = { player: 0, ballista: 0, frost: 0, cannon: 0 } satisfies Record<DamageSource, number>;
      for (const source of Object.keys(meanDamageBySource) as DamageSource[]) {
        meanDamageBySource[source] = selected.reduce((sum, run) => sum + run.damageBySource[source], 0) / selected.length;
      }
      summaries.push({
        loadout: loadout.id,
        wave,
        runs: selected.length,
        wins: selected.filter((run) => run.result === "victory").length,
        winRate: Number((selected.filter((run) => run.result === "victory").length / selected.length).toFixed(3)),
        survivalSeconds: distribution(selected.map((run) => run.survivalSeconds)),
        killed: distribution(selected.map((run) => run.killed)),
        remainingHp: distribution(selected.map((run) => run.remainingHp)),
        barrierDamage: distribution(selected.map((run) => run.barrierDamage)),
        totalEnemyHp: selected[0].totalEnemyHp,
        spawnInterval: selected[0].spawnInterval,
        composition: selected[0].composition,
        failureReasons: {
          cleared: selected.filter((run) => run.failureReason === "cleared").length,
          barrier_destroyed: selected.filter((run) => run.failureReason === "barrier_destroyed").length,
          time_limit: selected.filter((run) => run.failureReason === "time_limit").length,
        },
        meanMaxAlive: Number((selected.reduce((sum, run) => sum + run.maxAlive, 0) / selected.length).toFixed(3)),
        meanMaxAtBarrier: Number((selected.reduce((sum, run) => sum + run.maxAtBarrier, 0) / selected.length).toFixed(3)),
        meanDamageBySource: roundRecord(meanDamageBySource),
      });
    }
  }
  return summaries;
}

export function simulateBalanceBatch(profileId: WaveBalanceProfile["id"], seeds: readonly number[], waves: readonly number[]): WaveSimulationBatch {
  const profile = WAVE_BALANCE_PROFILES[profileId];
  const runs: WaveSimulationRun[] = [];
  for (const loadout of SIMULATION_LOADOUTS) {
    for (const wave of waves) {
      for (const strategy of SIMULATION_STRATEGIES) {
        for (const seed of seeds) runs.push(simulateWave(seed, wave, loadout, profile, strategy));
      }
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    profile,
    seeds,
    waves,
    timestepSeconds: SIMULATION_STEP_SECONDS,
    method: {
      engine: "60 Hz fixed-step headless combat loop sharing src/game/combatRules.ts and src/game/waveDirector.ts with StormGame",
      spawnClock: "fractional remainder carry with multiple triggers allowed per step; intended cadence error guarded below 1%",
      spatialModel: "2D X/Z gameplay plane; exact spawn, target, range, speed, cooldown, projectile, splash, slow, impact and recovery rules; rendering/terrain Y/animation omitted",
      operatorModel: "R1-calibrated held-SMG defense at three predeclared reasonable positions: default frontline, left intercept and ballista towerline; every seed runs every position",
      deterministicInputs: "separate Mulberry32-derived streams for player input timing and the game's 8% nurse barrier block; identical seed streams across profiles",
    },
    loadouts: SIMULATION_LOADOUTS,
    strategies: SIMULATION_STRATEGIES,
    runs,
    summaries: summarizeRuns(runs),
  };
}
