# Storm Apocalypse 暴風啟示錄全面稽核報告

稽核日期：2026-07-16
稽核角色：資深遊戲 QA 兼製作人
範圍：只稽核；未修改任何遊戲程式、素材或測試檔。唯一新增檔案為本報告。

## 稽核方法與實測紀錄

- 已讀：AGENTS.md、README.md、CREDITS.md、docs/*.md、src/game/content.ts、src/game/input.ts、src/game/quality.ts、src/game/quests.ts、src/game/state.ts、src/game/StormGame.ts、src/game/ui.ts、src/styles.css、scripts/test-smoke.mjs。
- 已跑：npm run test:smoke，透過系統 npm CLI 實際執行 package.json:10 的 node scripts/test-smoke.mjs。
- smoke 結果：資產/動畫前 6 項 PASS，之後 Playwright 無法啟動管理版 Chromium 而中止。
  - stdout 開頭：> storm-apocalypse@0.2.3 test:smoke
  - 已 PASS：R8.1 立繪亮度、R8 角色/動畫資產、Boss walk/attack/hurt/death、R10 員工/顧客/牧羊犬、強化牛配件、runtime 不使用 legacy staff/dog。
  - stderr：browserType.launch: Executable doesn't exist at ... chromium_headless_shell-1228 ...，Playwright 提示 npx playwright install。
- 已補充跑本機 Chrome + Vite：
  - 1440x900、390x844、844x390：塔 dock、wave、weapon、attack、joystick、手冊/整備 toggle 的中心點均在 viewport 內、命中區 >= 44px、無重疊。
  - 首玩 390x844：選角畫面可見三主角，預設選中屠夫老闆娘，按鈕文字為「確認屠夫老闆娘」並可進遊戲。
  - 非 smoke 桌機 30 秒觀察：未見 GL_INVALID/WebGL sampler 類警告；唯一 console error 是 /favicon.ico 404。

## 總結

- P0：0
- P1：6
- P2：12
- 整體判定：Alpha 主循環已可玩，動畫契約大致達標，R11 控制可達性在補充視口檢查中通過；目前最大風險不是「不能玩」，而是 QA 門檻失效、缺少暫停/設定/音訊回饋、30 波節奏仍公式化，以及少數會削弱生存壓力或污染 console 的 shipped bug。

## Top 5 優先

1. P1 修復 smoke gate：安裝/快取 Playwright Chromium，並讓 CI 與本機 npm run test:smoke 可完整跑到桌機/手機/觸控/動畫檢查。
2. P1 補暫停與設定選單：音量、畫質、粒子/陰影、色弱/高對比、重新綁鍵、重置存檔入口。
3. P1 明確保存或設計化壁壘生命：避免重新整理直接滿血，破壞生存/塔防壓力。
4. P1 強化 30 波導演與戰鬥回饋：目前波次主要是公式與 modulo，音效也完全缺席。
5. P1 清掉 favicon 404：小修但會破壞 console error = 0 驗收。

## 1. 可玩性

### P1: 30 波節奏仍偏公式化，後期容易從「策略」變成「等數值跑完」

證據：
- 開波只檢查有塔、非戰鬥中、未滿 30 波，沒有白晝時間壓力或波間事件：src/game/StormGame.ts:1577
- 敵數為固定公式 min(42, 4 + ceil(wave * 1.22))，Boss 波只額外 +1：src/game/StormGame.ts:1581
- 敵種由 wave/order 的 modulo 決定：src/game/StormGame.ts:1684
- UI 預告只有四段粗分類：src/game/ui.ts:701

影響：30 波可以成立，但玩家學會「殺牛、擺塔、按下一波」後，變化主要來自血量/數量，而不是新決策。塔防 + 生存 + 經營三循環的骨架在，但中後段缺少事件、壓力選擇與波間風險管理。

建議修法：加入 wave director 資料表，至少每 5 波引入一個可讀事件或限制，例如暴風能見度、偷貨夜、塔位封鎖、特殊抗性、顧客避難委託。波間讓玩家在「補貨、修壁壘、建塔、追好感」之間做取捨，而不是無成本立刻下一波。

### P1: 沒有音效/音樂，命中、銷售、倒塔與 Boss 壓力缺少即時回饋

證據：
- 授權文件明寫現行 repo 沒有音樂、音效：CREDITS.md:41
- Roadmap 將武器音效與分層音樂列為後續：docs/ROADMAP.md:38、docs/ROADMAP.md:61
- src/ 搜尋不到 audio、sound、volume 相關 runtime 實作。

影響：目前所有成功/失敗回饋主要靠 toast、動畫與特效，戰鬥手感不夠扎實。尤其近戰命中幀雖正確，但沒有聲音/震動/短暫鏡頭回饋時，玩家不容易感到「打中了」。

建議修法：先做最小聲音包：近戰命中/落空、SMG、塔發射、殭屍受擊/死亡、顧客結帳、波次警報、Boss 進場。與設定選單一起做 master/SFX/music 音量與靜音。

### P2: 三主角被動清楚，但長線平衡仍需實測

證據：
- 屠夫：賣肉 +10%、狙擊手：每次命中 +1、機械師：塔費 -10%：src/game/content.ts:24
- 狙擊手加成套在每次 playerWeaponDamage，SMG 三段傷害會各 +1：src/game/StormGame.ts:1089、src/game/StormGame.ts:1120

影響：設計語意是清楚的，但長線來看，狙擊手在 SMG 解鎖後是直接把每輪 6 傷提高到 9 傷；屠夫與機械師則依經營/塔投入間接轉換。這不一定壞，但需要 30 波真人/自動通關資料支持。

建議修法：加一個平衡 smoke 或離線模擬，分三主角跑固定經濟/塔配置，記錄 W10/W20/W30 的剩餘資金、壁壘血量、玩家擊殺占比。

### 存檔風險（詳 BUG P1）: 壁壘生命不存檔，重新整理會回滿血，削弱生存壓力

證據：
- SaveState 沒有 baseHealth 欄位：src/game/state.ts:44
- loadState() 每次 runtime 都設 baseHealth: 100：src/game/state.ts:271
- saveState() snapshot 也沒有寫入 baseHealth：src/game/state.ts:287
- 下一波開始還會再補到最多 100：src/game/StormGame.ts:1580

影響：玩家若在中後段殘血，可以重新整理回滿，讓「30 波守住壁壘」變成可逃避的壓力。若這是刻意降低挫折，遊戲內也沒有說明。

建議修法：二選一。若要硬派生存，將 baseHealth 納入存檔並在波後只給固定修復/花錢修復。若要輕量遊戲，則明文寫成「每次回到黎明會修滿壁壘」，並移除半隱性 reload exploit。

## 2. 畫質

### OK: 角色/敵人/員工動畫契約基本達標

證據：
- AGENTS 要求：run 必須改變肢體姿勢、攻擊要 anticipation/impact/recovery、傷害在 impact/hitbox、敵人 hurt/death：AGENTS.md:1
- 玩家攻擊有 impact/recovery 時序，傷害在 impactAt 後解析：src/game/StormGame.ts:1050、src/game/StormGame.ts:1063
- 敵人攻擊先進 anticipation，倒數到 impact 才扣壁壘血：src/game/StormGame.ts:1624
- 敵人受擊/死亡播放 HitReact/Death：src/game/StormGame.ts:1830、src/game/StormGame.ts:1840
- smoke 已 PASS：Boss 有 Idle, Walk, Idle_Attack, HitReact, Death；R10 員工/顧客/牧羊犬有 rig/clip/forward contract。

建議：保留現有契約，下一步把「玩家受擊/壁壘受擊」也做明確 VFX/SFX，而不是只有 toast。

### P2: 場景與牛仍是第三方/自製混搭，角色一致性已進步但世界一致性未完全收斂

證據：
- 牛仍用 Quaternius cow.glb：CREDITS.md:9
- 松樹、岩石、柵欄、雪屋仍用 Kenney/Quaternius/Kenney 混合：CREDITS.md:11、CREDITS.md:13
- 肉舖雪屋由 holiday/cabin-*.glb 組裝：src/game/StormGame.ts:708
- 強化牛仍以 cow.glb 為底，只加自製配件：src/game/StormGame.ts:1467、src/game/StormGame.ts:1481

影響：角色、敵人、員工已轉到 R8/R10 自建低模語言，但場景/牛/建築仍會在輪廓、材質 response、細節密度上露出來源混搭。第一眼已可接受，但精品化時會被看出拼裝。

建議修法：先重做高頻焦點物件：牛、柵欄、雪屋門窗、松樹一套。保留 Kenney 版作 fallback，但 runtime 預設載入自建 custom/environment/*。

### P2: QA debug shadow 狀態有矛盾，會誤導效能/畫質判讀

證據：
- canvas dataset 用 blobShadowsActive || !this.shadows ? blob : realtime：src/game/StormGame.ts:345
- __stormDebug.shadowMode 只看 this.shadows ? realtime : blob：src/game/StormGame.ts:1007
- 效能降級時保留 shadow generator 但開 blobShadowsActive = true：src/game/StormGame.ts:2398
- 本機 30 秒非 smoke 檢查中，canvas 顯示 shadowMode=blob，__stormDebug.shadowMode=realtime。

影響：玩家不受影響，但 QA/性能報表會把降級後的 blob fallback 誤判為 realtime shadow。

建議修法：統一 debug 欄位，讓 __stormDebug.shadowMode 使用同一個判斷式，或拆成 shadowGeneratorRetained 與 visibleShadowMode。

## 3. 玩家適應性

### P1: 暫停/設定/無障礙入口缺席，且 viewport 禁止縮放

證據：
- index.html 設 user-scalable=no：index.html:5
- Roadmap 將設定選單、音量、色弱模式、陰影/粒子品質列為待做：docs/ROADMAP.md:62
- Roadmap 也列出尚未加入無障礙重新綁鍵：docs/ROADMAP.md:70
- src/ 搜尋不到 pause/settings/volume runtime 實作；結果頁只有重整與清除進度：src/game/ui.ts:208

影響：桌機和手機的基本控制可玩，但玩家不能暫停、不能手動降畫質、不能調音量、不能改鍵、不能開高對比/色弱模式。這會直接影響首玩留存與全平台可及性。

建議修法：做一個可由 Esc、右上按鈕、手機整備列進入的 Pause/Settings overlay。第一版至少包含繼續、重新開始/清除存檔、音量、畫質低/中/高/自動、減少動態、色弱/高對比、鍵位說明。

### P2: 首玩任務方向清楚，但牧場互動標記可能提早暴露「牧場 2」鎖定訊息

證據：
- 首章任務是前往東側牧場：src/game/content.ts:127
- 初始 prompt 只是移動/攻擊提示：src/game/StormGame.ts:1958
- 牧場柵欄、gate、marker 都被標成 pasture2 world action：src/game/StormGame.ts:793、src/game/StormGame.ts:804
- pastureActionState 對未解鎖玩家顯示手冊章節鎖：src/game/ui.ts:514

影響：新手到牧場時若點到 marker/柵欄，可能看到「牧場 2/手冊 7」而不是「殺牛取肉」；這會把教學焦點提前跳到中期擴張。

建議修法：Ch1-Ch6 期間不要對牧場 1 的 fence/gate 顯示牧場 2 action；或把 action 文案改成「這是牧場，先擊倒牛隻」直到 Ch7 完成。

### OK: 選角畫面資訊足夠，手機首玩可操作

證據：
- 三主角卡有 runSummary、名稱、台詞、被動與被動描述：src/game/ui.ts:121
- 本機 Chrome 390x844 首玩檢查：可見「誰來走進暴風？」、三主角、預設屠夫老闆娘、確認按鈕與觸控提示。

建議：新增「適合新手/高風險/塔防偏好」短標籤，降低第一次選角壓力。

## 4. BUG

### P1: npm run test:smoke 在目前工作區無法完整執行

證據：
- package.json:10 定義 test:smoke 為 node scripts/test-smoke.mjs
- smoke 使用 Playwright chromium.launch(...)：scripts/test-smoke.mjs:933
- 實測輸出：前 6 項 PASS 後中止，錯誤為 Executable doesn't exist at ... chromium_headless_shell-1228 ...，Playwright 提示 npx playwright install。

影響：目前無法用正式 smoke 驗證桌機、手機、觸控、角色動畫與 console gate。這是 QA 門檻 P1，不代表遊戲一定壞，但代表出貨前缺少可信自動驗證。

建議修法：在本機/CI 明確執行 npx playwright install chromium；若 CI 已做，則把瀏覽器 cache key 與 Playwright 版本綁定。也可在 smoke 啟動前檢查 browser binary，給出更短的 actionable error。

### P1: favicon 404 會污染 console，破壞「console errors = 0」驗收

證據：
- 本機 Chrome 補充檢查三個遊戲視口均出現 Failed to load resource: the server responded with a status of 404 (Not Found)。
- CDP 追蹤來源：http://127.0.0.1:4173/favicon.ico
- index.html 有 canonical/OG/Twitter 圖，但沒有 favicon link：index.html:10
- public/ 內沒有 favicon.ico 或 manifest icon。

影響：玩家只看到瀏覽器 console 噪音，但 smoke 的 console error gate 會失敗。這類小錯也會掩蓋真正的 WebGL/資產錯誤。

建議修法：加入 public/favicon.ico 或 link rel=icon，並在 smoke 中保留 console error = 0。

### P1: 壁壘血量 reload 回滿，屬可利用存檔漏洞

證據：同「可玩性 P2」的 baseHealth 不存檔鏈路：src/game/state.ts:44、src/game/state.ts:271、src/game/state.ts:287。

可重現步驟：
1. 進入中後期任一波，讓殭屍攻擊壁壘到低血量。
2. 清波前或清波後重新整理頁面。
3. loadState() 重新給 runtime baseHealth=100，下一波再 +12 上限補滿。

建議修法：將 baseHealth 存檔，或把「黎明自動修滿」做成明確規則並加成本/文案。

### P2: smoke 與 debug selector 有資料屬性碰撞風險

證據：
- UI 選角卡使用 [data-protagonist]：src/game/ui.ts:121
- canvas 每幀也寫 canvas.dataset.protagonist：src/game/StormGame.ts:349
- 補充檢查抓 [data-protagonist] 時會多抓到 canvas 空項。

影響：玩家不受影響，但測試/自動化 selector 容易誤抓。這已在補充測試輸出中出現。

建議修法：選角卡改用 data-protagonist-card，canvas debug 改用 data-debug-protagonist。

## 5. 說明

### P2: README 版本與 package 版本不一致

證據：
- README badge 是 0.2.1：README.md:4
- README 宣稱目前版本為 0.2.1 且與 package/lockfile 一致：README.md:43
- package.json 實際是 0.2.3：package.json:4

影響：對外文件與 npm metadata 不一致，玩家/維護者會不確定線上版到底是哪個修訂。

建議修法：版本單一來源化。README badge 改由 package 自動產生，或改成不寫死版本，只連到 release/tag。

### P2: CREDITS 已落後於 R10 runtime

證據：
- CREDITS 說 survivor.glb 作獵人、customer.glb 作收銀員與匿名顧客：CREDITS.md:10
- runtime 實際載入 R10 自建 staff/customer：src/game/StormGame.ts:148、src/game/StormGame.ts:154
- smoke 已 PASS：runtime uses only authored R10 staff, dog and strong-cow accessory assets — legacy=none。

影響：授權文件與實際載入不一致，會讓素材審查誤判第三方依賴範圍。

建議修法：更新 CREDITS，把 Quaternius zombie kit 改成 repo 保留/未載入，並列 R10 自建 staff/customer 實際用途。

### P2: 遊戲內數值說明不足，塔/武器升級的 DPS、射程、冷卻未透明

證據：
- 武器描述只有「傷害 2」「傷害 3」「傷害 2×3」：src/game/content.ts:80
- 塔描述只有類型，不列升級後傷害/冷卻/射程：src/game/content.ts:92
- 實際塔數值在 runtime 公式中：src/game/StormGame.ts:1738、src/game/StormGame.ts:1744、src/game/StormGame.ts:1754

影響：玩家很難做「升弩塔 vs 建寒霜 vs 存錢買 SMG」的策略比較，只能憑感覺。

建議修法：整備面板顯示目前/下一級的傷害、攻速、射程、減速、濺射半徑，並用簡短 tag 標出「單體 DPS」「控場」「群傷」。

## 6. 選單

### 同 P1-玩家適應性: 沒有暫停/設定選單，導覽少一個中樞

證據：
- src/ 搜尋不到 pause/settings/設定/暫停 runtime。
- 目前可開的主要 overlay 是手冊、整備、世界操作、結果頁：src/game/ui.ts:154、src/game/ui.ts:169、src/game/ui.ts:193、src/game/ui.ts:208
- Roadmap 仍把設定選單列為後續：docs/ROADMAP.md:62

影響：玩家想暫停、調整效能、查鍵位、重新開始或退出時沒有一致入口。手機玩家尤其容易把「整備」誤當成系統選單。

建議修法：新增 Pause 按鈕與 Esc，面板內分「繼續、設定、操作、重置、關於」。整備仍只負責遊戲內購買，避免承擔系統設定。

### P2: 桌機手冊與整備面板預設常駐，缺少收合選擇

證據：
- .panel-toggle 預設 display: none：src/styles.css:92
- 手冊/整備 panel 在桌機直接定位兩側，沒有桌機收合入口：src/styles.css:63、src/styles.css:96
- 手機/觸控才顯示 toggle 並可 slide in/out：src/styles.css:255

影響：桌機資訊密度高，但兩側常駐會壓縮 3D 場景閱讀，對已熟悉玩家是噪音。

建議修法：桌機也保留小型手冊/整備 toggle，預設可以根據章節自動展開，玩家可手動收合並記住偏好。

### OK: R11 底部控制列目前沒有重疊或不可點問題

證據：
- 補充 Chrome 檢查：1440x900、390x844、844x390 的底部控制全部 >= 44px、中心可 hit self、無重疊；桌機 joystick 不顯示。
- 對應 CSS：src/styles.css:133、src/styles.css:255、src/styles.css:324

建議：把補充檢查收斂回正式 smoke，避免只靠人工補測。

## 7. 全平台 UX

### P2: 正式跨平台 smoke 覆蓋目前被 Playwright browser 缺失阻塞

證據：
- smoke 原本覆蓋 R11 控制、桌機/手機/橫向、console errors：scripts/test-smoke.mjs:315、scripts/test-smoke.mjs:379、scripts/test-smoke.mjs:973
- 實測 npm run test:smoke 在 chromium_headless_shell-1228 缺失時中止。

影響：補充 Chrome 檢查只能證明本機三個視口此刻可用，不能替代正式 smoke 對角色動畫、品質判定、戰鬥流程、console gate 的完整覆蓋。

建議修法：先修 Playwright 安裝，再把 favicon 404 修掉，最後要求 PR 前 npm run test:smoke 必須完整 PASS。

### P2: 缺少實體中低階手機長時間壓測證據

證據：
- Roadmap 自己列「仍需在實體中低階 Android/iOS 長時間壓力測試」：docs/ROADMAP.md:71
- 目前品質判定與降級路徑存在：src/game/quality.ts:17、src/game/StormGame.ts:2371
- 本機 headless Chrome 不是真手機 GPU；補充檢查只驗證布局與 console。

影響：手機短時間 UI 可達，但 20-30 分鐘連續 30 波的發熱、降頻、觸控誤觸、記憶體回收仍未被證明。

建議修法：建立最小實機矩陣：低階 Android、iPhone 舊機、平板各 1；跑 15 分鐘與 30 波自動流程，記錄 FPS、崩潰、觸控命中、電量/溫度。

### P2: 自動畫質可用，但缺少玩家手動覆寫

證據：
- 自動畫質依 UA/touch/CPU/memory 判斷：src/game/quality.ts:17
- 低 FPS 會兩階段降 render scale 與特效：src/game/StormGame.ts:2371
- UI 只顯示目前畫質/FPS/DC，沒有設定入口：src/game/ui.ts:409

影響：自動判定能保護大多數裝置，但玩家若想「畫面優先」或「穩幀優先」無法控制。這也是設定選單缺席的直接後果。

建議修法：設定選單提供「自動/低/中/高」與「粒子低/高」；手動選擇寫入 localStorage，並保留緊急降級保護。

## 交付狀態

本報告只新增 docs/AUDIT_full.md。沒有修改 src/、public/、scripts/ 或既有 docs/ 檔案。

AUDIT_DONE
P0=0
P1=6
