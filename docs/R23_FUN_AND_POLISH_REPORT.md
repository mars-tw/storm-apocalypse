# R23｜好玩 × 美觀 實作報告

日期：2026-10-15　版本：0.2.13 → **0.2.14**　UI 標記：**R23**
執行：Claude 獨立完成（未派 Codex、未用 Blender MCP、未新增 AI 2D 原畫；全程 headless，沒有開任何可見視窗）
計畫：[`OPTIM_PLAN_R23.md`](OPTIM_PLAN_R23.md)

## 0. 開工前的工作樹

工作樹原有未提交的 R22 平衡改動。逐項檢查後（typecheck 綠、simulation-fidelity 綠、`docs/evidence/r22` 驗收 pass、smoke 182/184）原樣封存成獨立 commit `5624934`，數值未動。
基線 smoke 的兩個 FAIL：
- `director/R12`：靜態正則沒涵蓋 R22 精英波三元式，屬測試過時，已改正則（保留 legacy 1.2 斷言）。
- `1366×768 R19 player silhouette`：主角被牧場圍欄擋住，是真問題，R23 以遮擋淡化修好（見 F5）。

## 1. 做了什麼、為什麼比較好玩／好看

| ID | 內容 | 為什麼更好 |
|---|---|---|
| F1 打擊回饋 | 命中時在目標頭上跳傷害數字（衝鋒槍三連發合併成一個數字），暴擊放大成金色「暴擊 N」；擊殺跳 `+✦N`；近戰命中後 hit-stop（砍刀 60ms、斧 75ms，凍結模擬並把 `animationTimeScale` 降到 0.06），揮空不停頓只跳「落空」；玩家打中的殭屍白閃 90ms | 以前命中只有地面特效和小震動，錢在右上角默默變多。現在每一下都看得到數字，暴擊和斧頭橫掃有「頓一下」的手感 |
| F2 連斬 | 2.6 秒內連續親手擊殺累計連斬，右側徽章顯示「N 連斬」並彈跳，5 連斬起每殺加發 ✦1～3；記錄本局最高連斬 | 給玩家上前線的理由。以前塔會把怪清光，玩家站著也能過 |
| F3 招牌玩法「鮮肉誘餌」 | 夜襲時按 `Q`／點「誘餌」，把 1 份肉丟在身前 2.4m；9m 內非 Boss 殭屍 4.5 秒內改追誘餌、到了原地啃食，不打壁壘。冷卻 9 秒。每波附 1 份免費邊角料，用完才扣背包、再扣攤位存貨 | 把「肉舖經營」直接接到「塔防戰術」：白天打的肉可以拿去賣，也可以留著晚上把屍群拉進塔的射界或斧的範圍。其他塔防換皮遊戲沒有這種玩法，是這款遊戲自己的招牌 |
| F4 訊息降噪 | toast 字級 9px→12px（手機 11px）；同一句 2.2 秒內合併成「×N」；同時最多 3 則；牛隻血量和揮空改成角色頭上的浮字 | 基線清波畫面同時疊 6～7 則，其中 4 則是同一句「奔行者正在破壞肉舖壁壘！」。現在最多 3 則，重複的訊息合併成一則加 ×N（最終手機錄證為 ×3） |
| F5 遮擋淡化 | 從鏡頭往主角打 5 條射線，擋住的圍欄、樹、房屋（整件道具一起）淡到 28%，離開後恢復；只對快取的靜態候選網格做檢查 | 修好基線 FAIL：1366×768 主角可見取樣 4/9→9/9。實玩時主角也不會再躲在房子或圍欄後面 |
| F6 開場導引 | 前 3 波的白天，場景中央立一根金色光柱＋浮動箭頭指向當前目標（牛→掉落的肉→紅色攤位→可建塔點）；桌機手冊 1～4 章先收起右側整備欄（這幾章本來就沒有能買的東西），第 5 章解鎖防線商店時才滑進來 | 以前桌機開場右側整備欄正好蓋住牧場和牛，目標只能讀左側文字。現在第一眼就看到牛和光柱 |
| F7 戰報 | 清波時上方出現評級卡（S 滴水不漏／A 防線穩固／B 勉強守住／C 險些失守，看壁壘承傷、親手擊殺比例、連斬、有沒有掉存貨），列出擊殺、親手、最高連斬、壁壘承傷、獎金；敗北／勝利結算多 4 欄（親手／塔擊殺、本局最高連斬、壁壘總承傷、丟出誘餌），再依數據給一句「下一局建議」 | 回應 Playtest CRIT-11（結算頁學不到東西），也給「再打一局拿 S」的理由 |
| F8 配樂 | 新增 `MusicDirector`：白天／夜襲兩層循環，依晝夜交叉淡入淡出，音量跟主音量／靜音連動。兩段音樂由本機 AI 派工器 `music` 生成（見 §4），轉成 ogg 放 `public/audio/`；檔案缺失或解碼失敗時自動改用程序化 WebAudio 配樂 | 原本完全沒有配樂 |
| F9 版面 | 桌機底部「WASD／空白鍵」提示原本疊在塔快捷列上，移到上方；誘餌鈕桌機在武器鈕上方，手機在攻擊鈕上方，四個視口都不重疊 | 修掉基線截圖看得到的重疊 |
| 手感 | 按住攻擊鍵時所有武器都會自動接下一擊（每一擊仍走完整前搖／命中／收勢），不再只有衝鋒槍才行 | 實玩時按住斧頭只會砍一次，手機長按也一樣，很不順手 |

動畫鐵律：沒有新增任何「整張圖位移」的假動畫。hit-stop 只放慢既有骨架動畫的時間，傷害還是在原本的命中幀結算；啃食用的是殭屍既有的 `Idle_Attack` 片段。

## 2. 實玩證據（Playwright 自啟 headless Chromium，四視口）

腳本：`docs/playtest/r23-playtest.mjs`（新玩家開局＋第 6 波實戰）、`docs/playtest/r23-result-capture.mjs`（第 29 波、壁壘 1% 存檔橋段，之後真實點擊開第 30 波且不防守，讓殭屍實際打空壁壘）。before 是 `5624934` 的程式快照，after 是本輪程式。

| 項目 | before | after |
|---|---|---|
| 清波時畫面上的 toast 數（桌機／筆電／直式／橫式） | 7／6／7／7 | 2／2／2／2 |
| toast 字級 | 9px | 12px（手機 11px） |
| 傷害浮字 | 無 | 桌機第 6 波 26 個 |
| 第 6 波桌機機器人（同一路線、同一操作）壁壘承傷 | 50 | 0（丟誘餌當下引走 6 隻，持續期間累計 9 隻）；評級 A |
| 1366×768 主角可見取樣（smoke R19） | 4/9 FAIL | 9/9 PASS |
| 開場到第一頭牛倒下（桌機） | 9.6 秒 | 9.0 秒（腳本走位，差異在誤差內，沒有退步） |
| 結算頁 | 6 欄、無建議 | 10 欄＋「下一局建議」 |

before/after 對照圖（左 before、右 after）：`docs/evidence/r23/compare/`
- `desktop-1366x768-02-first-frame.png`：開場整備欄收起、提示不再疊塔列、主角前的圍欄淡化
- `desktop-1366x768-03-first-hit.png`：目標光柱
- `laptop-1366x600-06-wave-combat.png`、`phone-portrait-390x844-06-wave-combat.png`：戰鬥中訊息降噪、浮字
- `desktop-1366x768-08-wave-clear.png`、`phone-portrait-390x844-08-wave-clear.png`、`phone-landscape-844x390-08-wave-clear.png`：清波戰報與 ×N 合併
- `phone-portrait-390x844-09-result.png`：結算戰報與建議

原始截圖與數據：`docs/evidence/r23/playtest/{before,after}-*.png`、`before-report.json`、`after-report.json`、`before-result-report.json`、`after-result-report.json`。誘餌截圖：`after-*-05b-bait.png`。

機器人限制（照實寫）：手機兩個視口的機器人不會走位，只在出生點丟誘餌，當下 9m 內沒有殭屍，所以手機的「引走數」是 0；誘餌的吸引行為由桌機實玩與 smoke（1440×900 引走 5、390×844 引走 5）驗證。before 清波截圖在清波後 0.7 秒擷取，after 是 1.3 秒（為了等戰報動畫），toast 數比較以同一時間點讀到的 DOM 為準。

## 3. 測試與品質閘門（實際執行的輸出）

| 閘門 | 結果 |
|---|---|
| `npm run typecheck` | 通過（0 error） |
| `npm run build`（CI 實際跑的 deploy.yml 只有 `npm ci` + `npm run build`） | 通過；Vite 照舊提示主 chunk >500 kB（既有狀況） |
| `npm run test:smoke`（headless，SMOKE_URL 指向 5101） | **196/196**（基線 182/184）；新增 R23 斷言 9 條：toast 合併×2、誘餌鈕版面×2、誘餌投擲×2、夜襲配樂×2、命中浮字／白閃／連斬×2、hit-stop 只在命中、誘餌／評級／建議接線 |
| `npm run test:r23-feedback`（新增單元測試） | 7/7：連斬視窗與獎勵上限、誘餌扣肉順序（邊角料→背包→存貨）、誘餌吸引（Boss 免疫、半徑、死亡排除、冷卻大於壽命）、評級、建議、訊息合併 |
| `npm run test:simulation-fidelity` | 通過（生成時鐘誤差 0.0000%） |
| 效能 `scripts/measure-performance.mjs`（3 跑） | before 快照：桌機 p95 66.7／16.7／16.7ms，手機 16.7／16.7／16.8ms。after：桌機 16.7／16.8／16.8ms，手機 16.8／16.8／16.8ms，**6 跑全部 ≤18ms**，`pass=true`。檔案：`docs/evidence/r23/perf-{before,after}.json` |
| 秘密掃描 `grep -rniE "sk-proj-…|sk-[a-z0-9]{40}"`（排除 .git／node_modules） | 0 命中 |
| 版本 | `package.json`／lockfile／README 0.2.14；`src` 內舊號 0.2.13 與 `"R22"` 標記 0 命中 |

效能補充：第一次量 after 時 p95 33～550ms。那時 GPU 正在跑派工器的音樂生成（nvidia-smi 100%），而且遮擋偵測每 0.12 秒對全場約 1000 個網格做 5 次 `multiPickWithRay`。改成只快取靜態候選、先比 bounding box 再比三角形，白閃也只給玩家命中，在 GPU 0% 時重量才得到上表的數字。上表是同一台機器、背景還有其他代理在跑時量的，不是乾淨機況。

## 4. 素材與來源

- **配樂**（本機 AI 派工器 `POST /v1/dispatch`，capability `music`）：
  - 夜襲：task `24117624-02f6-4e32-8f14-0a5fa60c9565`，worker `ace_step_turbo`，原檔 `C:\AI\outputs\comfyui\DISPATCH_MUSIC_TURBO_24117624-02f_00001.flac`（sha256 `212bafad…800b`）。尾端 6.8 秒是靜音，裁成 23.0 秒、淡出、loudnorm −18 LUFS，存成 `public/audio/bgm-night.ogg`。
  - 白天：task `0966865a-63fc-4551-9d8f-b2b4b49f333e`，worker `ace_step_base_backup`（turbo 排隊逾時後由備援產出），原檔 `DISPATCH_MUSIC_BASE_0966865a-63f_00001.flac`（sha256 `b4ac3e65…18c4`）。頻譜圖顯示 22 秒後只剩單一持續低音，裁成 22.0 秒、淡出、loudnorm −20 LUFS，存成 `public/audio/bgm-day.ogg`。
  - 前 4 次派工因 GPU 被其他工作佔用，回報 `resource queue timeout for gpu_exclusive` 失敗（`7f82a591…`、`e60a7da9…`、`f697ab1a…` 三筆皆 queue timeout；`8b4ad68b…` queue timeout；`6eae55a7…` turbo 逾時、base 回報 `exit 1`），沒有重複送已成功的工作。
  - 驗證：瀏覽器內 `__stormAudio.music` 顯示 day／night 都是 `file`（成功解碼）；頻譜圖 `docs/evidence/r23/bgm-{day,night}-spectrum.png`。**沒有真人聽過**，循環接縫只靠淡入淡出處理，聽感屬未驗證。
- CREDITS.md 已記錄 `music.ts` 架構與來源，詳細 task id 見本節。

## 5. 未完成與風險

1. **配樂聽感未驗證**：AI 生成曲只有頻譜檢查，沒有人耳試聽；循環點用淡出接回，會有一瞬間變安靜。Safari 舊版如果不能解碼 Ogg Vorbis，會自動改用程序化配樂（已有後備，但音色差很多）。
2. **誘餌平衡沒進固定種子模擬**：`waveSimulation` 仍是「不用誘餌」的保守基準，R22 的 W29／W30 勝率閘門不受影響。誘餌會讓中段變容易（桌機機器人第 6 波壁壘承傷 50→0），後段 40 隻以上的屍群一次只能引走半徑內的一部分，但沒有長局實測。建議下輪把誘餌加進模擬的 operator 策略再調數值。
3. **4.3 換皮風險只能降低，不能保證**：誘餌把經營和塔防綁在一起、清波評級、連斬是差異化，但 App Review 結果無法在本地驗證。
4. **美術素材沒有新增**：角色、場景模型沿用既有素材（本輪規定不能新增 AI 2D 原畫、不能用 Blender）。誘餌圖示用 🥩 emoji（和 HUD 背包圖示一致），headless 截圖裡顯示成灰階字形，實機會是彩色 emoji。缺件：專屬誘餌圖示、肉塊落地的濺雪粒子貼圖、連斬徽章底圖，現在都是 CSS／程序化替代，之後可以直接換成正式素材。
5. 手機兩個視口的實玩機器人不會走位（見 §2），手機上誘餌吸引的實際體感靠 smoke 驗證，沒有人工實機試玩。
6. 沒有 push、沒有部署、沒有碰任何商店。
