# R21 validation evidence

| Gate | Command | Result |
| --- | --- | --- |
| Spawn cadence fidelity | `npm run test:simulation-fidelity -- --output docs/evidence/r21/spawn-fidelity.json` | PASS；0.496→0.496000s、0.510→0.510000s；兩者誤差 0.0000% |
| Corrected R20 baseline | `node scripts/sim-wave-balance.mjs --profile r20 --output docs/evidence/r21/before.json` | PASS；720 runs；W26/W27 一般皆 0/60 |
| Final R21 + guard report | `node scripts/sim-wave-balance.mjs --profile r21 --output docs/evidence/r21/after.json --compare docs/evidence/r21/before.json --comparison-output docs/evidence/r21/comparison.json --report-only` | 守門誠實 FAIL；一般 W30 0/60 未達 15–40%；滿配 40/60 通過 50–70%；720 runs 與 R20 逐欄相同 |
| R20 reevaluation | `node scripts/sim-wave-balance.mjs --profile r20 --output docs/evidence/r21/r20-after.json --compare docs/evidence/r21/r20-before.json --comparison-output docs/evidence/r21/r20-comparison.json` | PASS；滿配 W30 4/60→40/60；3/3 gates true |
| HP candidate audit | `npm run sim:r21-candidates -- --output docs/evidence/r21/hp-candidate-sweep.json` | 完成；20 seeds × 3 站位；結果離散且非單調，不採逐波 HP 過擬合 |
| TypeScript | `npm run typecheck` | PASS |
| Production build | `npm run build` | PASS；3224 modules transformed |
| Browser smoke | `$env:SMOKE_OUTPUT='docs/evidence/r21/smoke-results.json'; npm run test:smoke` | PASS；184/184 |
| Diff hygiene | `git diff --check` | PASS |

正式曲線每 profile 使用 20 fixed seeds × 3 declared positions × 2 loadouts × waves 25–30 = 720 runs。1/60 秒修正後，本機單批約 2.8–3.3 秒，另加診斷約 1.5–1.6 秒；未降低 seeds、站位或波次。

`--report-only` 只讓 R21 一般 W30 的預期紅燈可寫入 evidence；省略此旗標時，同一比較仍會以非零退出阻擋平衡驗收。
