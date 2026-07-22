---
goal: Reproduce and minimally correct the wave 30 balance wall
version: 1.0
date_created: 2026-07-22
last_updated: 2026-07-22
owner: Codex
status: 'Completed'
tags: [process, balance, simulation, regression, r20]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

建立與實際 `StormGame` 共用戰鬥規則的固定 seed 無頭模擬，先保存 R19 基準，再只調整量測證明必要的最小波次變數，最後以同一組 seed 驗證第 25–30 波、既有 smoke 與版本發布 gate。

## 1. Requirements & Constraints

- **REQ-001**: `scripts/sim-wave-balance.mjs` 必須使用至少 20 個固定 seeds，模擬第 25–30 波的滿配與一般配置，逐局輸出存活秒數、擊殺數、剩餘 HP 與失敗原因。
- **REQ-002**: 模擬器與 `src/game/StormGame.ts` 必須共同引用同一份敵人、塔、玩家攻擊與時序規則，不得另建獨立平衡常數。
- **REQ-003**: `docs/evidence/r20/` 必須保存可由 repo 指令重現的 before、after 與比較 JSON。
- **REQ-004**: 第 30 波滿配合理操作通關率目標為 50% 至 70%，一般配置維持挑戰；第 25–29 波不得因調校而改變。
- **REQ-005**: `npm run typecheck`、`npm run build`、`npm run test:smoke`、active 舊版號檢查與秘密掃描必須通過。
- **REQ-006**: 將 active 版本升為 R20 當輪版本，建立 `docs/CODEX_RESPONSE_R20.md`，並由 `main` 建立一個只含本輪檔案的 commit，不 push。
- **CON-001**: 只修改 `C:/Users/digimkt/Desktop/遊戲/storm-apocalypse`，保留且不提交使用者既有的 `docs/playtest/` 未追蹤資料。
- **CON-002**: 平衡數值必須在 before 資料產生後才能改動；before 與 after 必須使用完全相同的 seeds、配置、操作模型與 timestep。
- **CON-003**: 角色動畫、physics root、collider 與既有 R18/R19 行為不得退化。
- **GUD-001**: 優先採單一終波變數調整；若一個變數足以達標，不得連帶提高塔傷、玩家傷害或壁壘生命。
- **PAT-001**: 使用 Vite SSR 載入 TypeScript 純規則模組，固定 0.25 秒 timestep 並讓每個 seed 跑三個預先宣告站位，避免新增執行期依賴並保持瀏覽器遊戲與 Node 模擬來源一致。

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: 建立可重播基準與定位失衡來源。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | 從 `src/game/StormGame.ts` 抽出敵人生成位置、HP、速度、傷害、攻擊時序、塔射程／冷卻／彈道、玩家武器 impact／recovery 至 `src/game/combatRules.ts`，並讓遊戲回接這些函式。 | Yes | 2026-07-22 |
| TASK-002 | 在 `src/game/waveSimulation.ts` 實作固定 0.25 秒 timestep 的無渲染戰鬥迴圈，保留真實生成、移動、選敵、彈道、範圍傷、寒霜減速、壁壘 impact 與 nurse seed 隨機事件。 | Yes | 2026-07-22 |
| TASK-003 | 在 `scripts/sim-wave-balance.mjs` 定義固定 seeds、滿配／一般配置與三站位可稽核操作模型，輸出逐局與彙總 JSON。 | Yes | 2026-07-22 |
| TASK-004 | 執行 R19 profile，將基準寫入 `docs/evidence/r20/before.json`，以傷害來源、同時抵牆數、HP demand 與通關率辨識瓶頸。 | Yes | 2026-07-22 |

### Implementation Phase 2

- GOAL-002: 實施單一最小調整並完成發布 gate。

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | 只修改 `src/game/waveDirector.ts` 中量測證明必要的終波參數，保留可重播 R19 profile 並讓遊戲預設使用 R20 profile。 | Yes | 2026-07-22 |
| TASK-006 | 以相同 seeds 重跑 `docs/evidence/r20/after.json`，產生 `docs/evidence/r20/comparison.json` 並驗證滿配目標與第 25–29 波不變。 | Yes | 2026-07-22 |
| TASK-007 | 更新 `package.json`、`package-lock.json`、`README.md`、`src/game/ui.ts` 與 smoke 的 active 版本標記為 R20。 | Yes | 2026-07-22 |
| TASK-008 | 執行 typecheck、build、smoke、模擬回歸、active 舊版號與秘密掃描，記錄於 `docs/evidence/r20/validation.md`。 | Yes | 2026-07-22 |
| TASK-009 | 撰寫 `docs/CODEX_RESPONSE_R20.md`，檢查 diff 與未追蹤檔案後建立含指定共同作者 trailer 的 file-scoped `main` commit。 | Yes | 2026-07-22 |

## 3. Alternatives

- **ALT-001**: 以總 HP 除以理論 DPS 的試算表估算；拒絕，因為會漏掉空窗、選敵、彈道失效、範圍命中、減速與抵牆攻擊時序。
- **ALT-002**: 每個 seed 啟動完整 Babylon/Chromium 場景；不選為主要回歸，因 720 次以上資產載入與 GPU/幀率噪音不適合固定 timestep 統計，但可用既有真人結果校準模擬合理性。
- **ALT-003**: 同時降低 HP、減少重型並提高塔傷；拒絕，因無法歸因且會把 W25–29 一併削弱。

## 4. Dependencies

- **DEP-001**: 既有 `src/game/waveDirector.ts` 的波次、事件與敵人組成規則。
- **DEP-002**: 既有 Vite 開發依賴，用於 Node 腳本載入 TypeScript 規則與模擬模組。
- **DEP-003**: 既有 Playwright smoke 與本機 Chromium，用於 R18/R19 回歸 gate。

## 5. Files

- **FILE-001**: `src/game/combatRules.ts`：瀏覽器遊戲與模擬共用的戰鬥規則。
- **FILE-002**: `src/game/waveSimulation.ts`：固定 timestep 無渲染戰鬥迴圈。
- **FILE-003**: `src/game/StormGame.ts`、`src/game/waveDirector.ts`：共用規則接線與最小終波調整。
- **FILE-004**: `scripts/sim-wave-balance.mjs`、`scripts/test-smoke.mjs`、`package.json`：回歸入口與版本 gate。
- **FILE-005**: `docs/evidence/r20/`、`docs/CODEX_RESPONSE_R20.md`、`README.md`、`src/game/ui.ts`、`package-lock.json`：證據、回報與 active 版本面。

## 6. Testing

- **TEST-001**: `npm run sim:balance -- --profile r19 --output docs/evidence/r20/before.json` 必須成功且含 20 個固定 seeds、兩配置與第 25–30 波逐局資料。
- **TEST-002**: `npm run sim:balance -- --profile r20 --output docs/evidence/r20/after.json --compare docs/evidence/r20/before.json --comparison-output docs/evidence/r20/comparison.json` 必須證明第 30 波滿配通關率在 50% 至 70%，第 25–29 波 before/after 完全相同。
- **TEST-003**: `npm run typecheck` 與 `npm run build` 必須 exit 0。
- **TEST-004**: `npm run test:smoke` 必須全部通過，包含既有 R18/R19 assertions。
- **TEST-005**: repo-wide 不得再含前版號，active surfaces 不得含 R19 標記；秘密模式掃描必須零命中。

## 7. Risks & Assumptions

- **RISK-001**: 純規則模擬不渲染 terrain Y 與動畫，但 combat 決策不得依賴動畫；使用共用距離、速度、冷卻與 impact 規則，並將差異與真人校準結果寫入報告。
- **RISK-002**: 終波門檻附近的通關率可能對操作模型敏感；before/after 固定同一輸入序列，並保留每 seed 逐局資料供人工檢查。
- **ASSUMPTION-001**: 「一般配置」固定為三塔 Lv.2、員工 Lv.1、常客好感 6 與已解鎖 SMG；「滿配」對齊 SA-R1-02 的三塔 Lv.3、員工 Lv.2、常客好感 10、退伍狙擊手與全武器。

## 8. Related Specifications / Further Reading

[`docs/OPTIM_PLAN_R19.md`](../docs/OPTIM_PLAN_R19.md)

[`docs/playtest/PLAYTEST_R1.md`](../docs/playtest/PLAYTEST_R1.md)
