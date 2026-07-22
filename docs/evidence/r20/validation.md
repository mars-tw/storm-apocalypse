# R20 validation evidence

日期：2026-07-22（Asia/Taipei）

## Deterministic balance regression

| Gate | Command | Result |
| --- | --- | --- |
| R19 before | `npm run sim:balance -- --profile r19 --output docs/evidence/r20/before.json` | PASS；20 seeds × 3 站位 × 2 配置 × 6 波次＝720 runs |
| R20 after + compare | `npm run sim:balance -- --profile r20 --output docs/evidence/r20/after.json --compare docs/evidence/r20/before.json --comparison-output docs/evidence/r20/comparison.json` | PASS；滿配 W30 66.7%、一般 W30 0%、W25–29 逐局相同 |

機讀證據：

- `before.json`：R19 profile 全部逐局輸出與彙總。
- `after.json`：R20 profile 全部逐局輸出與彙總。
- `comparison.json`：相同 seed、W25–29 identical 與兩項 W30 通關率 gate。

## Build and smoke gates

| Gate | Command | Result |
| --- | --- | --- |
| TypeScript | `npm run typecheck` | PASS；exit 0 |
| Production build | `npm run build` | PASS；exit 0；Vite 8.1.4，3224 modules transformed |
| Full smoke | `$env:SMOKE_OUTPUT='docs/evidence/r20/smoke-results.json'; npm run test:smoke` | PASS；182/182，0 failed，D3D11 |
| Diff whitespace | `git diff --check` | PASS；零錯誤（僅 Git 的 CRLF 提示） |

smoke 機讀摘要：`measuredAt=2026-07-22T09:24:47.172Z`、`passed=182`、`total=182`、`failures=0`、`allPass=true`。

Vite 的既有 unresolved-at-build-time public image URL 與 bundle-size 訊息仍是 warning，沒有造成 build 或 smoke failure。

## Version and secret gates

| Gate | Scope | Result |
| --- | --- | --- |
| Previous version | 全 repo（排除 `.git`、build output 與 dependencies）搜尋前版號 | PASS；0 matches |
| Active old UI marker | `src scripts README.md` 搜尋舊 R19 UI marker | PASS；0 matches |
| Secret patterns | 本輪候選檔與 `docs/evidence/r20/`；AWS、Google、GitHub、OpenAI/Stripe、Slack token 與 private-key header 模式 | PASS；0 matches |

歷史文件 `docs/CODEX_RESPONSE_R19.md` 與 `docs/OPTIM_PLAN_R19.md` 以「當時發行版號」保留史實，避免前版號字面殘留。
