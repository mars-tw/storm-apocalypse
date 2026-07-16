# storm R12.1 手機 HUD P0 收尾

## 完成項目

- 將手機 HUD 改為分區佈局：頂部資源列自適應，整備鈕併入資源列，任務手冊籌碼獨立成 HUD 第三列，避免左上籌碼與資金、右上存貨與整備鈕互疊。
- 將觸控提示列改為 3 秒淡出 toast 型提示，固定在頂部 HUD 下方，不再壓到塔 dock。
- 將塔 dock 與波次鈕拆成上下兩列，390x844 與 844x390 都保留 11px 以上垂直間距。
- 更新 UI marker、設定頁版本字樣、README 與 package metadata 至 `R12.1` / `0.2.5`。
- smoke 新增「手機 HUD 互斥」守門：所有可見互動/HUD 元素兩兩檢查 rect，排除父子 element.contains，X/Y 交疊皆大於 8px 即 FAIL。

## 驗證

- `npm run typecheck`：PASS
- `npm run test:smoke`：PASS，136/136 checks
- `git diff --check`：PASS
- 秘掃：PASS，0 命中

## 證據

- 修復前直式：`docs/evidence/R12_1/before-mobile-390x844-hud-overlap.png`
- 修復後直式：`docs/evidence/R12_1/after-mobile-390x844-hud-zones.png`
- 修復前橫式：`docs/evidence/R12_1/before-mobile-844x390-hud-overlap.png`
- 修復後橫式：`docs/evidence/R12_1/after-mobile-844x390-hud-zones.png`
- rect 與 smoke 摘要：`docs/evidence/R12_1/validation-r12-1.md`

本次只做本地 commit，未 push。
