# storm R9 UX/RWD 重設計回報

## 稽核對照

- A. 建塔/升級改 diegetic 點物件：已在 3D build-pad、已建塔 mesh 上標記互動 metadata，`POINTERPICK` 命中後顯示就地小操作彈窗，動作仍走既有 `buyOrUpgradeTower`。
- B. 下緣塔 dock：新增三顆固定塔按鈕，顯示塔種、等級/成本/鎖定狀態；金額不足、章節鎖、夜襲中、滿級都會灰化。
- C. 整備面板分頁：整備面板改為「武裝 / 員工 / 常客 / 擴張」tabs，一次只顯示一類；塔 section 已移出面板。武器切換改為攻擊鈕旁的「武器」小圖示鈕，循環已解鎖武器。
- D. 牧場/員工就地操作：牧場圍欄、牧場 ring、攤位、收銀台、狗屋與已生成員工可點擊並顯示擴張/雇用/升級彈窗，沿用既有商店邏輯。
- E. 手機戰鬥動線：手機底部整合搖桿、攻擊、武器、塔 dock、wave button；直向不需打開整備 drawer 即可戰鬥與建塔，橫向低高度改為底部水平 dock 以免遮住 3D build-pad。

## 改動檔案

- `src/game/ui.ts`：R9 UI 結構、tabs、塔 dock、武器鈕、世界操作彈窗與共用動作狀態。
- `src/game/StormGame.ts`：3D pick metadata、世界操作命中處理、武器解鎖/切換、smoke-only 驗證 helper。
- `src/game/state.ts`：`SAVE_VERSION` 升至 4，新增 `weapons` 擁有狀態並相容舊存檔遷移。
- `src/styles.css`：RWD 底部控制列、tabs、dock、popover、橫向低高度布局。
- `src/main.ts`：接上武器循環 callback。
- `scripts/test-smoke.mjs`：新增 R9 UX smoke 斷言，穩定 hero/quality 等待。
- `package.json` / `package-lock.json`：版本 bump 至 `0.2.2`。

## 截圖

- 桌機 1440×900：`docs/evidence/R9_ux/desktop-1440x900-build-pad-popover.png`
- 手機直向 390×844：`docs/evidence/R9_ux/mobile-390x844-combat-dock.png`
- 手機橫向 844×390：`docs/evidence/R9_ux/landscape-844x390-tabbed-panel.png`

## 驗證

- `npm run typecheck`
- `npm run test:smoke`：108/108 passed
- 秘密掃描：排除 `.git/node_modules/dist`，零命中
