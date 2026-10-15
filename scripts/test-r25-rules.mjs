import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const v = await createServer({appType:'custom',server:{middlewareMode:true},logLevel:'error'});
const results=[];
const check=(name,fn)=>{fn();results.push({name,pass:true});console.log(`PASS ${name}`);};
const store=new Map();
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
try {
 const layout=await v.ssrLoadModule('/src/game/baitLayout.ts');
 const state=await v.ssrLoadModule('/src/game/state.ts');
 const director=await v.ssrLoadModule('/src/game/waveDirector.ts');
 check('starter grants only at fresh wave with no existing tower',()=>{
  assert.equal(layout.canClaimStarter(0,{ballista:0,frost:0,cannon:0}),true);
  for(const wave of [1,29,30])assert.equal(layout.canClaimStarter(wave,{ballista:0,frost:0,cannon:0}),false);
  for(const id of ['ballista','frost','cannon'])assert.equal(layout.canClaimStarter(0,{ballista:0,frost:0,cannon:0,[id]:1}),false);
 });
 check('invalid layout safely selects center; every route has a distinct world point',()=>{
  assert.equal(layout.layoutFor('bad').id,'center');
  assert.equal(new Set(layout.BAIT_LAYOUTS.map(l=>`${l.x},${l.z}`)).size,3);
 });
 check('tactical goal requires two actual attraction events',()=>{
  for(const n of [0,1,-1])assert.equal(layout.layoutObjective(n),false);
  for(const n of [2,10])assert.equal(layout.layoutObjective(n),true);
 });
 check('reopen preserves meat, tower, resources and selected protagonist',()=>{
  const s=state.loadState();Object.assign(s,{carriedMeat:4,displayedMeat:6,money:87,protagonistId:'vet_sniper'});s.towers.ballista=1;
  state.saveState(s);const loaded=state.loadState();
  assert.equal(loaded.carriedMeat,4);assert.equal(loaded.displayedMeat,6);assert.equal(loaded.money,87);assert.equal(loaded.towers.ballista,1);assert.equal(loaded.protagonistId,'vet_sniper');
 });
 check('legacy save without inventory migrates to empty without discarding progress',()=>{
  const raw=JSON.parse(store.get('storm-apocalypse-save-v1'));delete raw.carriedMeat;delete raw.displayedMeat;store.set('storm-apocalypse-save-v1',JSON.stringify(raw));
  const s=state.loadState();assert.equal(s.carriedMeat,0);assert.equal(s.displayedMeat,0);assert.equal(s.money,87);
 });
 check('corrupt inventory is bounded and malformed JSON remains playable',()=>{
  store.set('storm-apocalypse-save-v1',JSON.stringify({carriedMeat:-9,displayedMeat:1e9}));const s=state.loadState();assert.equal(s.carriedMeat,0);assert.equal(s.displayedMeat,24);
  store.set('storm-apocalypse-save-v1','{');assert.equal(state.loadState().wave,0);
 });
 check('storage failure does not stop gameplay saves',()=>{
  const original=localStorage.setItem;localStorage.setItem=()=>{throw new Error('quota');};
  assert.doesNotThrow(()=>state.saveState(state.loadState()));localStorage.setItem=original;
 });
 check('tighter elite column applies to all elite waves with unchanged HP budget and boss',()=>{
  for(const wave of [9,14,19,29]) {
   const plan=director.getWavePlan(wave);assert.equal(plan.event,'elite_surge');
   assert.ok(Math.abs(plan.spawnInterval-((.86-(wave-1)*.014)-.027))<1e-10);assert.equal(plan.hpMultiplier,1.07);assert.equal(plan.speedMultiplier,1);
  }
  assert.equal(director.getWavePlan(24).event,'whiteout');
  assert.equal(director.getWavePlan(30).hpMultiplier,1.07);assert.equal(director.getWavePlan(30).damageMultiplier,1.075);
 });
} finally { await writeFile('docs/evidence/r25-store/r25-rules.json',JSON.stringify(results,null,2));await v.close(); }
