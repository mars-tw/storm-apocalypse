import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';
const vite = await createServer({ appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
const results = [];
const check = (name, fn) => { fn(); results.push({ name, pass: true }); console.log(`PASS ${name}`); };
try {
  const p = await vite.ssrLoadModule('/src/game/patrol.ts');
  const w = await vite.ssrLoadModule('/src/game/waveDirector.ts');
  check('old and corrupt profile falls back safely', () => {
    for (const raw of [null, false, 42, 'bad', {}]) assert.deepEqual(p.normalizePatrol(raw), { version: 1, completedWaves: [], selected: 'standard' });
  });
  check('profile validates, deduplicates and bounds stamps', () => {
    assert.deepEqual(p.normalizePatrol({ completedWaves: [3, 1, 1, -1, 0, 31, 2.5, '2'], selected: 'bounty' }), { version: 1, completedWaves: [1, 3], selected: 'standard' });
  });
  check('locked supply cannot be selected', () => {
    const profile = p.normalizePatrol(null);
    assert.equal(p.selectSupply(profile, 'ration'), false);
    assert.equal(profile.selected, 'standard');
  });
  check('all supply thresholds are reachable and exact', () => {
    for (const s of p.SUPPLIES) {
      const profile = p.normalizePatrol({ completedWaves: Array.from({ length: s.threshold }, (_, i) => i + 1) });
      assert.equal(p.selectSupply(profile, s.id), true);
      if (s.threshold) { profile.completedWaves.pop(); assert.equal(p.selectSupply(profile, s.id), false); }
    }
  });
  check('supply effects remain mutually exclusive', () => {
    assert.deepEqual(p.supplyEffects('standard'), { scraps: 1, repair: 0, bonus: 0 });
    assert.deepEqual(p.supplyEffects('ration'), { scraps: 2, repair: 0, bonus: 0 });
    assert.deepEqual(p.supplyEffects('repair'), { scraps: 1, repair: 6, bonus: 0 });
    assert.deepEqual(p.supplyEffects('bounty'), { scraps: 1, repair: 0, bonus: 15 });
  });
  check('bait objective requires two attracted enemies', () => {
    assert.equal(p.patrolObjective(3, { attracted: 1 }).complete, false);
    assert.equal(p.patrolObjective(3, { attracted: 2 }).complete, true);
  });
  check('player objective requires two impact kills', () => {
    assert.equal(p.patrolObjective(2, { playerKills: 1 }).complete, false);
    assert.equal(p.patrolObjective(2, { playerKills: 2 }).complete, true);
  });
  check('wall objective boundary is 12 damage', () => {
    assert.equal(p.patrolObjective(1, { wallDamage: 12 }).complete, true);
    assert.equal(p.patrolObjective(1, { wallDamage: 13 }).complete, false);
  });
  check('failed objectives and invalid waves give no stamp', () => {
    const profile = p.normalizePatrol(null);
    for (const wave of [0, 31, 1.5, 2]) assert.equal(p.awardPatrol(profile, wave, { playerKills: 0, attracted: 0, wallDamage: 100 }), false);
    assert.equal(profile.completedWaves.length, 0);
  });
  check('completed objective awards once across reload and replay', () => {
    const profile = p.normalizePatrol(null);
    assert.equal(p.awardPatrol(profile, 3, { attracted: 2 }), true);
    assert.equal(p.awardPatrol(p.normalizePatrol(JSON.parse(JSON.stringify(profile))), 3, { attracted: 20 }), false);
  });
  check('quick tap has deadzone and drag aim is bounded', () => {
    assert.equal(p.baitDrag(0, 0).aimed, false);
    assert.equal(p.baitDrag(17, 0).aimed, false);
    assert.equal(p.baitDrag(18, 0).aimed, true);
    assert.equal(p.baitDrag(900, 0).power, 1);
    assert.ok(Math.abs(Math.hypot(p.baitDrag(30, -40).x, p.baitDrag(30, -40).y) - 1) < 1e-9);
  });
  check('wave 3 contains two leading runners and five walkers', () => {
    const plan = w.getWavePlan(3);
    const types = Array.from({ length: plan.enemyCount }, (_, i) => w.enemyTypeForWave(plan, plan.enemyCount - i));
    assert.equal(plan.event, 'hungry_rush');
    assert.deepEqual(types.slice(0, 2), ['runner', 'runner']);
    assert.equal(types.filter(t => t === 'walker').length, 5);
  });
  check('wave 7 contains exactly two brutes and one runner', () => {
    const plan = w.getWavePlan(7);
    const types = Array.from({ length: plan.enemyCount }, (_, i) => w.enemyTypeForWave(plan, i + 1));
    assert.equal(plan.event, 'haulers');
    assert.equal(types.filter(t => t === 'brute').length, 2);
    assert.equal(types.filter(t => t === 'runner').length, 1);
  });
  check('historic profiles and late-wave balance remain unchanged', () => {
    for (const profile of ['r19', 'r20', 'r21']) for (const wave of [3, 7]) assert.equal(w.getWavePlan(wave, w.WAVE_BALANCE_PROFILES[profile]).event, 'standard');
    for (let wave = 1; wave <= 30; wave++) {
      const plan = w.getWavePlan(wave);
      assert.ok(plan.enemyCount > 0 && plan.spawnInterval > 0);
      assert.ok(Array.from({ length: plan.enemyCount }, (_, i) => w.enemyTypeForWave(plan, i + 1)).every(t => ['walker', 'runner', 'brute', 'boss'].includes(t)));
    }
    assert.equal(w.getWavePlan(29).event, 'elite_surge');
    assert.equal(w.getWavePlan(30).hpMultiplier, 1.07);
  });
} finally {
  await mkdir('docs/evidence/r24-mobile', { recursive: true });
  await writeFile('docs/evidence/r24-mobile/rules-results.json', JSON.stringify({ results, passed: results.length }, null, 2));
  await vite.close();
}
console.log(`${results.length}/${results.length} passed`);
