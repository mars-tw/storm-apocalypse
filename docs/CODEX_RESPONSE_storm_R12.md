# storm R12 收尾回報

## 實作

- 補齊 R12 設定中樞：HUD 齒輪入口、暫停 overlay、遊戲/聲音/系統分頁、Esc 開關、焦點循環、繼續/關閉固定可見，並在暫停時停止模擬、輸入與動畫時間。
- 新增玩家設定存檔 `storm-apocalypse-settings-v1`：主音量、效果音、靜音、畫質自動/高/中/低、螢幕震動；設定即時套用並保存。
- 新增 `src/game/audio.ts` 程序化 WebAudio：`hit`、`swing`、`build`、`sale`、`wave`、`boss`、`towerAlarm`、`ui` 八類音效。AudioContext 由首次使用者手勢解鎖；靜音與音量不阻斷遊戲。
- 將 `baseHealth` 納入 `SaveState` v5，載入時正規化 0-100；開波修復、敵人 impact 扣血、建造/交易等路徑寫回存檔，reload 不再回滿。
- 新增 `src/game/waveDirector.ts`，第 6 波等白幕突襲改變出生間隔/奔行者比例，第 9/14/19/24/29 波等精英壓境改變蠻屍比例與 HP；Boss 波保留獨立提示與音效。
- 補 favicon：`public/favicon.svg` 並於 `index.html` 明確引用，headed/smoke 驗證 200 + `image/svg+xml`。
- 雪地地表增加風蝕色帶、霜痕與晶點；低畫質裁減額外紋理細節。
- 版本升至 0.2.4：`package.json`、`package-lock.json`、README badge/說明同步；`CREDITS.md` 補 R12 自製 favicon 與程序化音效授權說明。

## 驗證

- `npm run typecheck`：PASS。
- `npm run test:smoke`：PASS，134/134 checks passed。
- `npm run test:smoke:headed`：PASS，headed Chrome 1440x900 30 秒 WebGL warnings = 0，console warn/error = 0。
- 分段補跑：1440x900、390x844、844x390、heroes 全部 PASS；新增音效、設定選單、控制守門、壁壘存檔、事件波與動畫契約均綠。
- 效能三跑：`docs/evidence/R12/performance-r12.json`。手機 390x844 p95 中位 16.7ms 通過；桌機 1440x900 p95 中位 33.4ms 未達 18ms。量測時有多個長駐 Chrome/Node 與既有 Vite server，桌機結果標記待淨機複測，不列為通過。
- 秘掃：排除 `.git`、`node_modules` 後 `sk-proj-...` / `sk-...` 規則零命中。
- 版本搜尋：active metadata 已為 0.2.4；`0.2.3` 僅保留於歷史稽核/舊回報與 R12 計畫基準文字。

## 證據

- `docs/evidence/R12/after-laptop-1366x600-settings-game.png`
- `docs/evidence/R12/after-mobile-390x844-settings-audio.png`
- `docs/evidence/R12/after-landscape-844x390-settings-system.png`
- `docs/evidence/R12/performance-r12.json`
- `docs/evidence/R12/validation-r12.md`

## 缺件揭露

- 未發現 R8/R10/R12 使用中的主角、NPC、員工、狗、殭屍或 Boss 動畫資產缺件；smoke 驗證仍使用 authored Blender GLB 與 clip，不以單圖位移、旋轉、縮放或 bobbing 冒充動畫。
- 本輪未引入外部音訊素材；所有音效為 repo 內 WebAudio 即時合成。
- 唯一未完全過閘的是桌機 p95 效能數據，原因按目前機況列為待淨機複測。
