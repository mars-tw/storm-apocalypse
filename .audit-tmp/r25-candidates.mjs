import { createServer } from 'vite';
import { readFile, writeFile } from 'node:fs/promises';
const v=await createServer({appType:'custom',server:{middlewareMode:true},logLevel:'error'});
try {
 const m=await v.ssrLoadModule('/src/game/waveSimulation.ts');
 const w=await v.ssrLoadModule('/src/game/waveDirector.ts');
 const b=JSON.parse(await readFile('docs/evidence/r25-store/balance-before.json','utf8'));
 const text=await readFile('scripts/sim-wave-balance.mjs','utf8');
 const fresh=[...text.match(/const FRESH_SEEDS[\s\S]*?\]\);/)[0].matchAll(/0x[0-9A-F_]+/g)].map(m=>Number(m[0].replaceAll('_','')));
 const rows=[];
 for(const damage of [1,1.025,1.05,1.075,1.1,1.125]) for(const [name,seeds] of [['fixed',b.seeds],['fresh',fresh]]) {
  const runs=[];
  for(const loadout of m.SIMULATION_LOADOUTS) for(const strategy of m.SIMULATION_STRATEGIES) for(const seed of seeds) runs.push(m.simulateWave(seed,29,loadout,w.WAVE_BALANCE_PROFILES.r22,strategy,{damageMultiplier:damage}));
  rows.push({damage,set:name,rates:m.SIMULATION_LOADOUTS.map(l=>({loadout:l.id,rate:runs.filter(r=>r.loadout===l.id&&r.result==='victory').length/60}))});
 }
 await writeFile('docs/evidence/r25-store/elite-candidates.json',JSON.stringify(rows,null,2));
 console.log(rows);
} finally {await v.close()}
