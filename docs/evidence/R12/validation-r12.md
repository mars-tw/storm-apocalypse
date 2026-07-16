# storm R12 驗證摘要

日期：2026-07-16

## 測試

- `npm run typecheck`：PASS，`tsc --noEmit` 無錯誤。
- `npm run test:smoke`：PASS，134/134 checks passed。
- `npm run test:smoke:headed`：PASS，10/10 checks passed；headed Chrome 1440x900 連續 30 秒 WebGL warnings = 0、console warn/error = 0。
- 分段補跑：
  - `SMOKE_SCENARIO=1440×900 npm run test:smoke`：PASS，62/62。
  - `SMOKE_SCENARIO=390×844 npm run test:smoke`：PASS，49/49。
  - `SMOKE_SCENARIO=844×390 npm run test:smoke`：PASS，31/31。
  - `SMOKE_SCENARIO=heroes npm run test:smoke`：PASS，38/38。

## 效能三跑

輸出檔：`docs/evidence/R12/performance-r12.json`

- desktop-1440x900：p95 = 33.4 / 33.4 / 33.4 ms，中位 33.4 ms，未達 18 ms 閘門。
- mobile-390x844：p95 = 16.7 / 16.7 / 16.8 ms，中位 16.7 ms，通過 18 ms 閘門。

量測時機器存在多個長駐 Chrome / Node 程序與既有 4173 Vite server；桌機數據標記為受機況影響，需淨機複測，不假報通過。

## 其他守門

- 秘密掃描：`rg -n --hidden -g '!node_modules/**' -g '!.git/**' "sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}" .`，零命中。
- 舊版號搜尋：active metadata 已升 0.2.4；`0.2.3` 僅留在 `docs/AUDIT_full.md`、`docs/CODEX_RESPONSE_storm_R11_controls.md`、`docs/OPTIM_PLAN_R12.md` 的歷史/基準敘述。
