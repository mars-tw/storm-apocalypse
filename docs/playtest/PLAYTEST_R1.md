# PLAYTEST-R1｜暴風啟示錄 storm-apocalypse

測試日：2026-07-20（Asia/Taipei）  
測試者：Codex 真人試玩機器人  
裁決：**PARTIAL**  
Bug：**P0 0｜P1 2｜P2 1**  
可玩性：**32 / 50，平均 3.2 / 5**

## 1. 版本、方法與限制

- Repository HEAD：`06577ae11741cc9ffe4d7998de6e82f44bd9de4d`（`06577ae 完成 R18.1 硬化收尾`），`main`，package `0.2.9`。
- 依協議先以第一次玩的新手視角盲玩，完成第一輪核心理解後才讀程式定位數值與結算橋段。
- `npm run build` 成功：TypeScript 與 Vite production build 0 error，Vite 約 4.63 秒；主 JS 約 5.77 MB（gzip 約 1.24 MB）。
- 測試站是 `dist/` 的 Node static server：`http://127.0.0.1:4178/storm-apocalypse/`；具 COOP/COEP，`crossOriginIsolated=true`。沒有使用 Vite dev server。
- 所有操作均是 Playwright 的 click/tap、鍵盤、滑鼠／觸控拖曳與滑桿拖曳。只有結局採協議允許的明示注入橋段；詳見「結局與資料可信度」。
- 音效控制與 WebAudio cue 觸發有驗，但此環境不能做真人聽感評分；D 項以畫面打擊、動畫、數值與觸發狀態為主。

### 開機量測

`bootMs` 是 document 內靜態 boot loader 首次可見時間；首互動是 app 的 `storm-first-interactive` 標記，亦即選角／開始介面已掛載。390×844 首次冷啟受機台 Chromium 啟動污染為 4,104 ms，依協議 clean rerun 後採用 1,612 ms；原始值仍保留在 `blind-probe.json`。

| 設備 | 尺寸 | bootMs | 首互動 | 結果 |
|---|---:|---:|---:|---|
| phone-portrait | 390×844 | 10 ms（clean rerun；初跑 38 ms） | 1,612 ms（初跑 4,104 ms） | loader <1 秒可見，選角可點 |
| phone-landscape | 844×390 | 43 ms | 1,094 ms | loader、捲動提示與確認鈕皆可見 |
| laptop-short | 1366×600 | 31 ms | 1,098 ms | 三張卡與確認鈕完整，底緣約 10 px |
| desktop | 1366×768 | 41 ms | 1,304 ms | 完整首屏 |
| tablet | 768×1024 | 38 ms | 1,343 ms | 完整首屏 |

Boot 證據：`phone-portrait-03-clean-boot.png`、`phone-landscape-01-boot.png`、`laptop-short-01-boot.png`、`desktop-01-boot.png`、`tablet-01-boot.png`。

## 2. 每設備實玩敘事

### phone-portrait｜390×844

1. **看到什麼：** 靜態雪地 key art 與 loader 立即出現；就緒後三張角色卡縱向排列，確認鈕固定在底部。  
   **做什麼：** 真實 tap「屠夫老闆娘」再 tap 確認。  
   **發生什麼：** 進入 3D 場景，資金、背包、存貨、手冊、整備、搖桿、武器與攻擊鈕全有非零面積。證據：`phone-portrait-04-touch-selected.png`、`phone-portrait-05-touch-gameplay.png`。
2. **看到什麼：** 直向初始鏡頭能看到牧場與圍欄，但玩家角色掉到畫面底緣／HUD 遮蔽區，攻擊時也看不清自身姿勢。  
   **做什麼：** tap 攻擊；dataset `attackCount` 由 0 → 1，再開關整備與手冊。  
   **發生什麼：** 輸入有效，整備與手冊都能開、以 × 關；但角色不可見嚴重影響走位／命中判讀。證據：`phone-portrait-05-touch-gameplay.png`、`phone-portrait-07-prep-open.png`、`phone-portrait-08-manual-open.png`。
3. **做什麼：** 開設定、切聲音分頁並關閉；把 viewport 旋轉成 844×390；離線 1.2 秒再連回。  
   **發生什麼：** 設定完整可見且遊戲暫停；旋轉後角色回到清楚可見區，FPS 先瞬降至 24、約 1.2 秒恢復 56；離線期間模擬不中斷。證據：`phone-portrait-06-settings.png`、`phone-portrait-09-rotated-landscape.png`。

### phone-landscape｜844×390

1. **看到什麼：** 矮視口一次主要顯示一張大角色卡，底部有「拖動選擇守燈人」提示與 sticky 確認鈕。  
   **做什麼：** 以 Chrome/Playwright 原生 touch sequence 從 y=300 上滑到 y=105。  
   **發生什麼：** 第一張卡實際捲離、第二張卡進入主視野；不是 `scrollTo`。證據：`phone-landscape-07-real-swipe-before.png` → `phone-landscape-08-real-swipe-after.png`。
2. **做什麼：** 再 tap 第三張「機械師少年」並 tap 確認。  
   **發生什麼：** 選角成功、進入橫向 3D 場景，搖桿／攻擊／武器與頂部資源列皆可見。證據：`phone-landscape-05-mechanic-selected.png`、`phone-landscape-09-real-touch-gameplay.png`。

### desktop｜1366×768（主深玩）

1. **看到什麼：** 三主角被動與本局定位清楚。  
   **做什麼：** 選「退伍狙擊手」並確認。  
   **發生什麼：** 進場後手冊在左、整備在右、3D 核心場景中央可讀。證據：`desktop-03-character-select.png`、`desktop-04-sniper-selected.png`、`desktop-05-first-scene.png`。
2. **做什麼：** 先把整備的武裝／員工／常客／擴張四分頁逐一打開；再開設定，走過遊戲／聲音／系統、畫質自動／高／中／低、震動、靜音、兩個音量滑桿、×／Esc／繼續遊戲。  
   **發生什麼：** 分頁內容不需長捲；所有控制可見、可切、可關；設定期間 `paused=true`，關閉後恢復。重置存檔會進第二段確認，取消不清檔。證據：`desktop-06-loadout-employees.png`～`desktop-13-reset-confirm-stage2.png`、`desktop-66-settings-controls-audit.png`、`desktop-67-system-controls-audit.png`。
3. **看到什麼：** 手冊 1 指示前往東側牧場。  
   **做什麼：** WASD 走位、空白鍵攻擊、追牛與撿肉。  
   **發生什麼：** 跑步明顯有肢體步態；攻擊具前搖／impact／收勢，傷害不是按鍵瞬間發生；牛會受傷、死亡並掉肉。落空也明說「動作會完整收勢」。證據：`desktop-15-move-east.png`、`desktop-20-second-attack.png`、`desktop-21-facing-hit.png`、`desktop-27-hunt-complete.png`。
4. **做什麼：** 收 4 肉返回肉舖並自動上架，等待顧客成交，再開常客頁。  
   **發生什麼：** 庫存 4 很快售完；顧客台詞、成交、資金與好感 +1/+2 都有即時回饋，常客面板顯示林護理 2/10、小包 1/10。證據：`desktop-36-customer-arriving.png`～`desktop-39-regular-affinity-panel.png`。
5. **做什麼：** 招募獵人、解鎖第二牧場、買迴旋斧；用武器鈕切回砍刀再切斧。  
   **發生什麼：** 獵人會自己找牛與攻擊；斧的 360° 範圍與砍刀單體差異可感，切換鈕確實顯示「下一把」圖示。證據：`desktop-40-hunter-recruited.png`、`desktop-41-axe-purchased-equipped.png`、`desktop-42-weapon-switched-next-shown.png`。
6. **做什麼：** 建弩塔、寒霜塔，連打第 1～5 波；第 3～5 波主動到路線前方走位／斧擊。  
   **發生什麼：** 箭、冰、血跡、受擊／死亡反應清楚；第 4～5 波玩家有實際擊殺，但前期多數仍由塔自動清。第 5 波後出現電台廣播：「……燈還亮著就回覆。」證據：`desktop-43-first-tower-built.png`、`desktop-45-wave3-player-combat.png`、`desktop-46-wave4-melee-impact.png`、`desktop-48-wave5-dispatch-b.png`。
7. **做什麼：** 戰役中離線 1.8 秒後恢復；另以 headed Chromium 量 5 秒 rAF。  
   **發生什麼：** 離線期間仍跑、回線後 56 FPS；headed 樣本 183 frames，avg 27.41 ms、p95 35.53 ms、7 個 >50 ms frame。戰鬥 HUD 約 38–56 FPS，會自動降為低畫質。證據：`desktop-49-offline-continuity.png`。

### laptop-short｜1366×600（抽驗）

1. **看到什麼：** 選角三卡與確認鈕均在首屏，沒有被裁掉，但確認鈕離底邊只約 10 px。證據：`laptop-short-02-ready.png`。
2. **做什麼：** 以第 5 波存檔進場、打開設定→系統、再以 Esc 關閉。  
   **發生什麼：** 卡片 620×303，內容 `scrollHeight=clientHeight=282`，重置與繼續都完整可見；關閉後 `paused=false`。證據：`laptop-short-03-settings-system-spot.png`。

### tablet｜768×1024（抽驗）

1. **看到什麼：** 直向角色卡、確認鈕與觸控提示完整。證據：`tablet-02-ready.png`。
2. **做什麼：** tap 進場、tap 設定→系統、tap × 關閉。  
   **發生什麼：** 設定卡 620×303，重置與繼續都不需捲動；關閉後正常恢復。證據：`tablet-03-settings-system-spot.png`。

## 3. 結局與資料可信度

### 敗北：實際遊戲邏輯抵達

- **注入橋段：** 只把存檔放在第 29 波、壁壘 1%、留一座 Lv.1 弩塔；其後是真實點「啟動第 30 波」並不防守。
- 約 6.8 秒後由殭屍實際打空壁壘，出現「最後的燈熄了」與 29/30 統計。證據：`desktop-60-wave30-defeat-bridge-active.png`、`desktop-61-defeat-result-bridge.png`。
- 真實點「清除進度並重開」→第二段確認→取消，存檔仍在；再開→確認清除，localStorage 已空並回到選角。證據：`desktop-62-result-clear-stage2.png`、`desktop-63-clear-confirmed-character-select.png`。

### 勝利：僅 UI 注入橋段，不能算自然通關

- 先做了兩次更接近通關的橋段：第 29 波、壁壘 100%、三塔全 Lv.3、三員工 Lv.2、四常客好感 10、全武器；其後以真實操作啟動第 30 波。
- 策略一：前線持續 SMG；約 18 秒敗，僅清 26 隻。策略二：移到肉舖匯流口持續斧擊；約 24 秒敗，僅清 28 隻。證據：`desktop-50-wave30-bridge-active.png`、`desktop-51-victory-result-bridge.png`、`desktop-57-wave30-axe-choke-active.png`、`desktop-58-wave30-result-bridge.png`。
- 因此沒有把勝利冒充真人通關。為完成結果頁可見性／按鈕覆蓋，最後以 **DOM-only 勝利 UI 注入橋段** 填入既有結果 modal；「帶著進度重整」仍是真實 click 且成功 reload。證據：`desktop-64-victory-ui-injection-bridge.png`、`desktop-65-victory-retained-reload-bridge.png`。
- 結論：勝利結果頁版面與重整按鈕 PASS；**第 30 波自然勝利未驗成，不能宣稱 30 波可合理通關**。

## 4. Bug 表

| ID | 分級 | 設備 | 重現步驟 | 影響／截圖 | 根因初判 |
|---|---|---|---|---|---|
| SA-R1-01 | P1 | phone-portrait 390×844 | 新檔選任一角色→確認→不移動觀察首場→tap 攻擊 | 玩家模型落在底緣／下方 HUD 與圍欄遮蔽區，攻擊計數有增加但看不到自身姿勢或命中方向；旋轉橫向才清楚。`phone-portrait-05-touch-gameplay.png`、`phone-portrait-09-rotated-landscape.png` | ArcRotateCamera 的 target/radius 只依波中／波外調整，未針對極窄 aspect ratio 與上下 HUD 保留角色安全區。 |
| SA-R1-02 | P1 | desktop，第 30 波 | 注入第 29 波滿血、所有塔 Lv.3／員工 Lv.2／常客 10→真實開第 30 波→SMG 前線或斧守匯流口 | 兩次分別約 18/24 秒敗，只清 26/28 隻；極限資源仍被 43 敵快速壓垮，終局像數值牆而非策略驗收。`desktop-50-wave30-bridge-active.png`、`desktop-57-wave30-axe-choke-active.png`、`desktop-58-wave30-result-bridge.png` | 第 30 波 43 敵、約 0.34 秒生成間隔與高 HP/重型倍率，集中壁壘傷害高於滿塔＋玩家的清場吞吐；缺少終波專屬防守手段／臨場修復。需用正式長局資料再確認。 |
| SA-R1-03 | P2 | phone rotate | 390×844 進場→旋轉 844×390→立即讀 FPS→等待約 1.2 秒 | 旋轉後瞬時 24 FPS，約 1.2 秒回 56 FPS；短暫但可感。`phone-portrait-09-rotated-landscape.png` | resize 時重建 Babylon render target／相機與 CSS layout，同幀負載尖峰；穩定後無持續掉幀。 |

未列為遊戲 bug：headless SwiftShader 曾只有 5–15 FPS 並出現 WebGL context lost；clean 改用 headed D3D11 後恢復 56 FPS，故判定為測試機況。Headed Chromium 偶有 `GL_INVALID_VALUE glGetProgramiv` warning，但無 pageerror、console error 或資產 request failure。

## 5. 可玩性 A–J

| 項目 | 分數 | 一句佐證 |
|---|---:|---|
| A. 首玩上手清晰度 | 4/5 | 手冊 1→牧場→殺牛→撿肉→回攤的文字與方向很清楚，落空也會說明完整收勢；`desktop-15-move-east.png`。 |
| B. time-to-first-fun | 3/5 | loader 約 1.1–1.6 秒即可互動，但第一次真正有趣的命中／掉肉仍約需 2–3 分鐘的自然走位與追牛；稽核插入選單測試時牆鐘約 9 分鐘。 |
| C. 核心循環吸引力 | 4/5 | 狩獵→上架→顧客→招募→建塔→開波的跨系統因果成立，比單純塔防更有個性。 |
| D. 回饋與爽度 | 3/5 | 攻擊有前搖、impact、收勢、血跡、冰擊、死亡掉落；混戰低畫質時粒子與輪廓會糊在一起。`desktop-46-wave4-melee-impact.png`。 |
| E. 操控手感與響應 | 3/5 | 桌機 WASD/空白鍵和手機 tap 都即時，44 px 以上觸控目標足夠；直向看不到自己抵銷優點。 |
| F. 難度曲線與公平性 | 2/5 | 1–5 波常由塔自動清，終波卻在極限配置下兩次快速敗，曲線疑似從過鬆跳到數值牆。 |
| G. 獎勵與成長意義 | 4/5 | 任務獎金、獵人自動化、第二牧場、斧與三塔都直接改變玩法；`desktop-40-hunter-recruited.png`、`desktop-41-axe-purchased-equipped.png`。 |
| H. 節奏 | 3/5 | 顧客成交快、波次短；早期追移動牛與中期等塔清場有空轉，第 5 波廣播才第一次強化長線情緒。 |
| I. 視覺可讀性 | 3/5 | 桌機／橫向的雪地、牛、殭屍與塔好辨；直向相機遮角、低畫質平面化與混戰重疊扣分。 |
| J. 續玩拉力 | 3/5 | 顧客好感、武器、員工與廣播讓人想看後續，但終波公平性與 30 波重複感會阻止再開。 |

**平均：3.2 / 5。**

## 6. 合理性

### 經濟

- 起始 35；首四章實際得到 +10、+20、+25 等任務金，顧客首單與任務再帶 +30，能在第一次明確存錢後買 140 的獵人。這段「先手動、再自動化」合理且有成長感。
- 第二牧場 260、斧 120、弩塔 60、寒霜塔 110，使玩家必須在經營擴張、武器與防線間取捨；價格語意清楚。
- 但前五波塔的擊殺占比太高，玩家武器投資對守波結果的主導感不足；若後期又突然要求極高 DPS，會讓前期學到的「塔會處理」成為錯誤教學。

### 難度與進度

- 1–5 波：威脅可讀、冰塔慢速與斧擊有配合，但壁壘幾乎無壓力。
- 第 30 波：以最強存檔橋段仍快速敗北，沒有看到讓玩家理解「這次敗在哪個配置」的結算拆解；目前疑似過陡。
- 手冊成長與解鎖節奏有意義，顧客好感也有輕量回饋；波間故事只在里程碑出現，30 波的中段仍可能公式化。

## 7. 人類樂趣裁決

**PARTIAL。** 人類玩家確實能在「親手殺牛掉肉 → 上架被具名顧客買走 → 用收入招人／建塔 → 夜裡自己衝進冰箭和屍群」這條鏈上得到好玩之處；第 5 波電台句子也讓系統第一次有世界感。它不是只有能跑的 tech demo。

但目前我不會裁成 YES：主流手機直向一進場看不到自己的角色；前期防守偏自動，最終波又在滿配下像數值牆；勝利只能用 UI 注入橋段驗畫面，不能證明長局能公平收束。

### 阻擋樂趣的前 5 名（依玩家感受排序）

1. **重做第 30 波的公平性與可解讀性。** 降同時到牆數／生成密度，或給終波專屬臨場修復、集火指令、Boss 弱點；結算顯示漏怪、塔傷、玩家傷與壁壘受擊來源。
2. **修正 390×844 角色安全框。** 相機 target/radius/角度要依 aspect ratio 和 HUD safe area 調整，確保角色、最近威脅、攻擊方向始終在中央可讀區。
3. **讓玩家戰鬥不是塔防旁觀。** 增加需要玩家打斷／處理的特殊敵人、塔過熱或集火窗口；目前 1–5 波很容易只等塔清。
4. **更快交付第一個爽點。** 首章給更近或短暫停留的教學牛、地面路徑／距離提示，讓首次命中與掉肉在 60–90 秒內發生。
5. **拉開 30 波的敘事與戰場變化。** 把顧客、廣播、天候、庫存威脅做成更密的互相影響，而不是每幾波一條 toast；同時強化低畫質下敵我／hit VFX 輪廓。

## 8. 覆蓋總結

- 選角：PASS；844×390 原生 swipe、第三角 tap、確認均成功。
- 整備／手冊：PASS；四分頁、開／關與矮視口內容可達。
- 作戰：PASS 到第 5 波；移動、三段攻擊時序、命中、受傷／死亡、武器切換與下一把圖示均有實證。
- 顧客／好感：PASS；具名台詞、成交、好感與面板均有實證。
- 波間敘事：PASS；第 5 波廣播有實證。
- 暫停／設定／旋轉／離線／重整：PASS；旋轉有 P2 瞬時 hitch。
- 敗北／二段清檔：PASS，操作是真實輸入。
- 勝利頁：**僅 UI 注入橋段 PASS；自然通關 NOT VERIFIED**。

