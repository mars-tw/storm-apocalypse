# storm R14 選單 modal 互斥驗證

## 分類與處置

| 稽核發現 | 分類 | R14 判定／處置 |
| --- | --- | --- |
| 開場／選角 overlay 與整備分頁、武器列表、塔 dock、wave-button 的 rect 相交 | modal 覆蓋背景，但背景原先未 inert，屬真問題 | 將背景 HUD 收斂到 `#game-ui`；modal 開啟時同步 `inert`、`aria-hidden="true"`、`visibility:hidden` |
| 主角卡 tagline／start-button 與背景 HUD 相交 | modal 覆蓋背景，但背景原先仍在視覺與命中樹，屬真問題 | intro 與 selection 共用 modal 狀態，背景互動元素中心 `elementFromPoint` 不得命中自身 |
| 手機 weapon-button 與 start-button 相交 | 開啟時屬真問題；關閉後不得殘留 | intro 開啟時 weapon-button 不可見、不可命中；intro 完成後 start-button 已移除，weapon-button 恢復命中 |
| 暫停設定／結算與 HUD 相交 | 合理 modal 幾何覆蓋，但背景必須互斥 | system／result 開啟時套用同一背景 inert／hidden 契約；Esc 不會在 intro／result 上誤開設定 |

3D canvas 可作為設定與結算的設計暗底，但同樣套用 `inert` 與 `aria-hidden`；HUD、整備列表與戰鬥控制不會視覺透出。

## 新增守門

桌機 `1366×600` 與手機 `390×844` 各驗證：

- 舊存檔 intro。
- 首次遊戲 selection。
- 暫停／設定 system modal。
- result modal。
- 所有背景互動元素中心點以 `document.elementFromPoint` 掃描，必須零次命中自身。
- `#game-ui` 必須同時為 inert、`aria-hidden="true"`、computed `visibility:hidden`。
- canvas 必須 inert 且 `aria-hidden="true"`。
- 手機額外驗 intro 關閉後 start-button 已移除、weapon-button 可見且中心恢復命中自身。

手機整備抽屜在 390×844、844×390 各新增一項背景 HUD inert／hidden／elementFromPoint 守門。

R14 新增 11 項守門；原 141 項 smoke 保留，正式總數為 152 項。

## 證據圖

| viewport | intro | selection | settings | result |
| --- | --- | --- | --- | --- |
| 1366×600 | `after-1366x600-intro.png` | `after-1366x600-selection.png` | `after-1366x600-settings.png` | `after-1366x600-result.png` |
| 390×844 | `after-390x844-intro.png` | `after-390x844-selection.png` | `after-390x844-settings.png` | `after-390x844-result.png` |

8 張 PNG 均在 modal mutex 斷言通過後由同一瀏覽器狀態擷取；視覺 QA 確認沒有 HUD、整備分頁、武器鋪、塔 dock、wave-button 或 weapon-button 穿透。

## 閘門結果

| 閘門 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| R14 專項 | PASS，21/21（12 個既有靜態資產守門 + 9 個全畫面 modal 守門）；整備抽屜 2 項隨手機 layout 情境執行 |
| 正式 smoke | PASS，152/152、0 failure、`allPass=true`；低記憶體主機採四個綠色 isolated scenario 彙整，來源與失敗 full attempt 均保留於 JSON metadata |
| 高信心秘密 pattern 掃描 | PASS，0 命中 |
| 版本一致性 | `package.json`、lockfile、README = 0.2.7；UI marker = R14 |

`smoke-r14.json` 明確標記 `execution.mode=segmented-consolidation`。單一長程序 full attempt 因主機 socket／資產載入飢餓，在 1440×900、390×844 載入階段超時，原始輸出保留為 `smoke-r14-full-attempt.json`；相同斷言、timeout 與 SwiftShader 後端未放寬，改以同版本 Playwright `chromium_headless_shell-1228` 隔離重跑後，R14 modals 21/21、1440×900 66/66、390×844 55/55、844×390 36/36 全綠，按邏輯 check 去重並保留重複攻擊狀態後為 152/152。
