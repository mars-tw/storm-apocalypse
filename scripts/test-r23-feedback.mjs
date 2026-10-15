// R23 純規則單元測試：連斬、誘餌、波次評級、結算建議、訊息合併。
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ root, appType: "custom", server: { middlewareMode: true }, logLevel: "error" });
let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
};
try {
  const f = await vite.ssrLoadModule("/src/game/feedback.ts");

  check("combo chains inside window and resets outside", () => {
    const combo = f.createCombo();
    assert.equal(f.registerComboKill(combo, 0).count, 1);
    assert.equal(f.registerComboKill(combo, 1).count, 2);
    assert.equal(f.registerComboKill(combo, 1 + f.COMBO_WINDOW_SECONDS).count, 3);
    assert.equal(f.comboExpired(combo, 1 + f.COMBO_WINDOW_SECONDS * 2 + 0.01), true);
    assert.equal(f.registerComboKill(combo, 20).count, 1);
    assert.equal(combo.best, 3);
  });

  check("combo bonus starts at 5 and is capped", () => {
    const combo = f.createCombo();
    const bonuses = Array.from({ length: 20 }, (_, index) => f.registerComboKill(combo, index * 0.5).bonus);
    assert.deepEqual(bonuses.slice(0, 4), [0, 0, 0, 0]);
    assert.equal(bonuses[4], 1);
    assert.equal(Math.max(...bonuses), f.COMBO_BONUS_CAP);
  });

  check("bait consumes carried meat before stall stock", () => {
    assert.equal(f.pickBaitSource(2, 5), "carried");
    assert.equal(f.pickBaitSource(0, 5), "stock");
    assert.equal(f.pickBaitSource(0, 0), null);
    assert.equal(f.pickBaitSource(2, 5, 1), "scraps");
    assert.equal(f.pickBaitSource(0, 0, 0), null);
  });

  check("bait attracts living non-boss zombies inside radius only", () => {
    const zombies = [
      { type: "walker", alive: true, x: 1, z: 1 },
      { type: "boss", alive: true, x: 0.5, z: 0 },
      { type: "runner", alive: false, x: 0, z: 0 },
      { type: "brute", alive: true, x: 8.9, z: 0 },
      { type: "walker", alive: true, x: 12, z: 0 },
    ];
    assert.deepEqual(f.baitAttractedIndices({ x: 0, z: 0 }, zombies), [0, 3]);
    assert.ok(f.BAIT_RULES.cooldown > f.BAIT_RULES.lifetime, "cooldown must exceed lifetime so bait cannot be chained");
  });

  check("wave grade rewards clean walls and personal kills", () => {
    assert.equal(f.gradeWave({ wallDamage: 0, playerKills: 6, totalKills: 10, bestCombo: 5, stockLost: false }), "S");
    assert.equal(f.gradeWave({ wallDamage: 0, playerKills: 0, totalKills: 10, bestCombo: 0, stockLost: false }), "A");
    assert.equal(f.gradeWave({ wallDamage: 20, playerKills: 2, totalKills: 10, bestCombo: 0, stockLost: false }), "B");
    assert.equal(f.gradeWave({ wallDamage: 60, playerKills: 0, totalKills: 10, bestCombo: 0, stockLost: true }), "C");
    for (const grade of ["S", "A", "B", "C"]) assert.ok(f.WAVE_GRADE_LABEL[grade]);
  });

  check("run advice is data-driven", () => {
    const base = { won: false, wave: 10, playerKills: 10, towerKills: 40, damageTaken: 100, baitsThrown: 3, bestCombo: 3, towersBuilt: 3, maxTowerLevel: 3 };
    assert.match(f.runAdvice({ ...base, towersBuilt: 1 }), /三種塔/);
    assert.match(f.runAdvice({ ...base, baitsThrown: 0 }), /誘餌/);
    assert.match(f.runAdvice({ ...base, wave: 14, maxTowerLevel: 1 }), /Lv\.3/);
    assert.match(f.runAdvice({ ...base, playerKills: 1 }), /前線/);
    assert.match(f.runAdvice({ ...base, won: true }), /下一局|挑戰/);
  });

  check("toast merge finds same message inside merge window only", () => {
    const entries = [{ message: "A", count: 1, shownAt: 0 }, { message: "B", count: 1, shownAt: 1 }];
    assert.equal(f.findMergeableToast(entries, "A", 1), 0);
    assert.equal(f.findMergeableToast(entries, "A", f.TOAST_MERGE_SECONDS + 0.5), -1);
    assert.equal(f.findMergeableToast(entries, "C", 1), -1);
    assert.equal(f.TOAST_MAX_VISIBLE, 3);
  });
} finally {
  await vite.close();
}
console.log(`${passed}/7 R23 feedback rule checks passed.`);
