import type { ProtagonistId, TowerId, WeaponId } from "./state";
import type { DirectorZombieType, WavePlan } from "./waveDirector";

export interface CombatPoint {
  x: number;
  z: number;
}

export interface EnemyCombatStats {
  hp: number;
  speed: number;
  damage: number;
  reward: number;
}

export interface TowerCombatStats {
  range: number;
  cooldown: number;
  damage: number;
  splash: number;
  slow: number;
}

export interface PlayerAttackStats {
  impact: number;
  recovery: number;
  range: number;
  hitDamages: readonly number[];
  area: boolean;
}

export const COMBAT_TIMING = Object.freeze({
  waveSpawnDelay: 0.4,
  projectileTravelSeconds: 1 / 2.65,
  barrierAttackRange: 2.5,
  frostSlowFactor: 0.55,
  waveRepair: 12,
  nurseBlockChance: 0.08,
  nurseBlockReduction: 1,
});

export const COMBAT_POSITIONS = Object.freeze({
  barrierTarget: Object.freeze({ x: -8, z: -2.2 }),
  playerStart: Object.freeze({ x: -0.5, z: -1.5 }),
  playerChoke: Object.freeze({ x: -8, z: 1 }),
  towers: Object.freeze<Record<TowerId, Readonly<CombatPoint>>>({
    ballista: Object.freeze({ x: -1, z: 4.2 }),
    frost: Object.freeze({ x: -5.2, z: 5.7 }),
    cannon: Object.freeze({ x: 3.5, z: 5.6 }),
  }),
});

export function enemySpawnPosition(order: number): CombatPoint {
  return { x: -6 + ((order * 4.7) % 12), z: 20 - (order % 2) * 1.8 };
}

export function enemyCombatStats(wave: number, type: DirectorZombieType, plan: WavePlan): EnemyCombatStats {
  const baseHp = 3 + Math.floor(wave * 0.72);
  const hp = Math.round(baseHp * (type === "boss" ? 8 : type === "brute" ? 2.35 : type === "runner" ? 0.72 : 1) * plan.hpMultiplier);
  const speed = (0.92 + wave * 0.025) * (type === "runner" ? 1.75 : type === "brute" ? 0.72 : type === "boss" ? 0.62 : 1) * plan.speedMultiplier;
  return {
    hp,
    speed,
    damage: (type === "boss" ? 16 : type === "brute" ? 10 : type === "runner" ? 5 : 6) * plan.damageMultiplier,
    reward: type === "boss" ? 25 + wave : type === "brute" ? 5 : type === "runner" ? 3 : 2,
  };
}

export function enemyAttackTimings(type: DirectorZombieType): { impact: number; recovery: number } {
  if (type === "runner") return { impact: 0.22, recovery: 0.36 };
  if (type === "boss") return { impact: 14 / 24, recovery: 0.62 };
  if (type === "brute") return { impact: 0.38, recovery: 0.58 };
  return { impact: 0.32, recovery: 0.5 };
}

export function towerCombatStats(id: TowerId, level: number): TowerCombatStats {
  return {
    range: id === "cannon" ? 19 + level : 17 + level * 1.5,
    cooldown: id === "ballista" ? 0.98 - level * 0.12 : id === "frost" ? 1.25 - level * 0.14 : 2.35 - level * 0.25,
    damage: id === "ballista" ? 2 + level : id === "frost" ? 1 + level : 4 + level * 2,
    splash: id === "cannon" ? 3 + level * 0.45 : 0,
    slow: id === "frost" ? 1.7 + level * 0.65 : 0,
  };
}

export function playerAttackStats(weapon: WeaponId, protagonistId: ProtagonistId): PlayerAttackStats {
  const bonus = protagonistId === "vet_sniper" ? 1 : 0;
  if (weapon === "smg") {
    return { impact: 8 / 24, recovery: 18 / 24, range: 13, hitDamages: [2 + bonus, 2 + bonus, 2 + bonus], area: false };
  }
  if (weapon === "axe") {
    return { impact: 13 / 24, recovery: 24 / 24, range: 3.5, hitDamages: [3 + bonus], area: true };
  }
  return { impact: 13 / 24, recovery: 24 / 24, range: 2.7, hitDamages: [2 + bonus], area: false };
}
