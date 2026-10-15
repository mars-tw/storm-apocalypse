// Diagnostic calibration only. Acceptance lives unchanged in sim-wave-balance.mjs.
import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
const v=await createServer({appType:'custom',server:{middlewareMode:true},logLevel:'error'});
try {
 const m=await v.ssrLoadModule('/src/game/waveSimulation.ts');
 const w=await v.ssrLoadModule('/src/game/waveDirector.ts');
 const baseline=JSON.parse(await readFile('docs/evidence/r25-store/balance-before.json','utf8'));
 const source=await readFile('scripts/sim-wave-balance.mjs','utf8');
 const fresh=[...source.match(/const FRESH_SEEDS[\s\S]*?\]\);/)[0].matchAll(/0x[0-9A-F_]+/g)].map(m=>Number(m[0].replaceAll('_','')));
 const rows=[];
 for(const tightening of [0,.01,.02,.027,.03,.04,.06]) for(const [name,seeds] of [['fixed',baseline.seeds],['fresh',fresh]]) {
  const runs=[];
  for(const loadout of m.SIMULATION_LOADOUTS) for(const strategy of m.SIMULATION_STRATEGIES) for(const seed of seeds)
   runs.push(m.simulateWave(seed,29,loadout,w.WAVE_BALANCE_PROFILES.r22,strategy,{spawnInterval:.468-tightening}));
  rows.push({tightening,seedSet:name,rates:m.SIMULATION_LOADOUTS.map(l=>({loadout:l.id,wins:runs.filter(r=>r.loadout===l.id&&r.result==='victory').length,runs:60}))});
 }
 await writeFile('docs/evidence/r25-store/elite-calibration.json',JSON.stringify({limitation:'Calibration is not an independent beta test or unseen seed validation.',rows},null,2));
 console.log(JSON.stringify(rows));
} finally {await v.close()}
