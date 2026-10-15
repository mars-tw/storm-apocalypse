# 共用素材與樣板感稽核

日期：2026-10-15。狀態：VERIFIED（本機來源範圍）；實際商店安裝包比對 BLOCKED。

方法：唯讀列出本作與其他遊戲 Git 追蹤的執行期圖像、音訊、GLB、程式、CSS、HTML，排除 docs、測試、工具、依賴、建置輸出；逐檔 SHA-256。擴大掃描共 130 個本作候選檔，**沒有與掃描對象完全相同的檔案**。詳細檔案定位與來源雜湊：`../evidence/r25-store/shared-assets.json`、`shared-assets-full.json`、`shared-design.json`。同機其他線路可能同時更新，因此只代表記錄時間點；雜湊不同不保證視覺不同。

| 本作檔案／項目 | 與哪款重複或相似 | 處理方式與限制 |
|---|---|---|
| `src/styles.css`：Noto Sans TC／Microsoft JhengHei 字型名稱 | 小小列車長、島嶼鐵道學校有相同或相近系統字型堆疊；飛行學校也有 Noto Sans TC | 標準字型名稱保留列示；移除 Google Fonts `@import`，改為裝置字型回退。沒有下載第三方字型 |
| `src/styles.css`、`index.html` 的版型與載入畫面 | 無完全相同檔；小小列車長只有 body／button／setting-row 等通用 selector 重合，selector Jaccard 約 0.0031 | 新增銅棕色肉舖戰術單、三落點操作與俯視引怪鏡頭。既有雪地 9-slice 按鈕沿用本作素材。不能把通用 selector 相同認作抄版 |
| `public/images/ui/chrome/*`、`atlas/*`、角色立繪與主畫面 | 擴大雜湊掃描無完全相同檔 | 沿用本作既有正式資產；來源見 CREDITS 與 R15／R8 manifest。沒有以換色相同圖片宣稱獨立美術 |
| `public/favicon.svg` | 無完全相同檔；原有自製北境閃電，不是 Vite 預設圖示 | 保留；App 原生圖示與 launch storyboard 是 native-kit 的另一項，未在本輪修改或宣稱已更新 |
| `public/models/custom/*`、`public/models/tower/arrow.glb`、營火石／裝飾 | 無掃描命中；仍含 Kenney／Quaternius 等標準第三方來源或保留資產 | 完整來源／授權／載入狀態見 CREDITS。未把第三方元件當作獨家內容。走路／攻擊維持骨架動畫與命中幀 |
| `src/game/audio.ts`、`music.ts` | 無完全相同檔；WebAudio oscillator 是標準瀏覽器能力 | 增加本作選位上行音、取消下行音、完成委託三音鐘聲，三個獨立 cue。背景暫停時關閉配樂。音檔／合成來源不混稱 |
| `src/game/ui.ts` 文案、版本列與效能列 | 無完全相同檔；原本有開發輪次、FPS／DC 與等級英文縮寫 | 玩家畫面移除輪次與除錯數字，改成遊戲內容說明；等級與秒數改繁中。專有名稱 STORM APOCALYPSE 保留 |
| `package.json`：Babylon.js、Vite、TypeScript；native-kit 的 Capacitor | 標準第三方框架；同帳號交通／數學作品有 Capacitor，其他作品可能也有 Vite。Crackveil 為 Godot | 依第三方標準框架例外列出。不能只因使用不同引擎聲稱玩法差異，也不能宣稱完全沒有共用標準程式碼 |
| `src/game/baitLayout.ts`、`ui.ts`、`StormGame.ts` | 本輪新增／修改；與掃描對象無檔案雜湊命中 | 本作專屬落點、試守塔、肉資源扣除、真敵人追蹤與戰術單紀錄，沒有引入其他遊戲模板 |
| 專屬誘餌／守夜委託新圖示 | 尚缺；原有肉 emoji 不算本作專屬圖示 | **BLOCKED**：本次可用圖片工具不能指定並核對 `gpt-image-2` model slug，且工作單禁止透過服務派工／送出內容。沒有呼叫產圖，也沒有用程序化方塊冒充交付。見 asset-manifest.json |

掃描對象：Crackveil、灰燼護航、無盡塔防、裂潮卡牌、陽光農場、村莊攻防、七期、Rift Forge 3D、交通學院、小小列車長、飛行學校、鐵道學校。夜行列車目前只有重製企劃／預覽資料，另記錄唯讀目錄與 HTML 雜湊，未把它當成可比對的完整 Git 執行期。

原生包裝：native-kit 為唯讀。其共用 Capacitor／原生啟動畫面與 App icon，需要由有權修改包裝的總線另做最後成品比對。本輪只修改本 repo，沒有擅改其他線路。
