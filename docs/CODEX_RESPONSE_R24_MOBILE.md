# R24 手機優先內容與操作驗收

日期：2026-10-15。版本：**0.2.15**，介面標記 **R24**。計畫：[OPTIM_PLAN_R24.md](OPTIM_PLAN_R24.md)。

本輪功能與自動驗證狀態為 **VERIFIED**；實機手感、乾淨機況效能及既存 W29 平衡閘仍為 **BLOCKED**。只在本 repo 工作，全程背景／headless，沒有 push、部署、商店操作、對外訊息或憑證讀取。

## 可玩變更與驗收對照

| 計畫 | 實際變更 | 狀態與證據 |
|---|---|---|
| M1 塔位 | 快捷列放開後選位，顯示中央／西側／東側固定塔基、下一級射程／傷害及費用；場景有射程環。可切換、取消，再確認才建造／升級，確認後立即收合。保留原本固定塔位，沒有宣稱可任意拖放。 | VERIFIED：三視口真觸控驗證選取／切換／取消零扣款、確認僅建一級；確認／取消／暫停命中區皆 ≥44px 且中心可點。`mobile-results.json`、`after-*-tower-preview.png` |
| M2 誘餌 | 輕點沿面向快投；按住拖曳依鏡頭方向瞄準，距離 2.4～8，顯示落點標記；放開才消耗免費邊角料／肉並啟動原有冷卻。取消區、pointercancel、失焦、旋轉、暫停及第二指皆有處理。畫面外落點明確標示。 | VERIFIED：真 CDP 多指事件；取消不扣資源／不啟冷卻，放開後實際肉塊座標與預覽誤差 <0.01，冷卻中實體觸控不重投。`after-*-bait-aim.png`、`after-*-wave.png` |
| C1 戰術波 | 第 3 波「飢餓快襲」：兩名奔行者領先、五名行屍跟進。第 7 波「蠻屍搬貨隊」：兩名蠻屍、一名奔行者與七名行屍；波前預告直接說明誘餌或控場對策。 | VERIFIED：純規則逐隻檢查，加上實際遊戲生成 runner／brute 的 E2E；`after-390x844-wave7-haulers.png`。沿用既有四種敵人及真骨架動畫，未新增敵人模型或假稱新物種。 |
| C2 守夜委託 | 三種委託輪替：引來兩隻敵人、親手擊殺兩隻、清波壁壘承傷 ≤12。每波首次成功才給一枚永久守夜章，重玩同波不重複給。 | VERIFIED：完整自然清掉第 1 波取得第 1 章；門檻、失敗與重複領取有規則測試。`after-390x844-supply-earned.png` |
| C3 局外解鎖 | 1／3／5 章解鎖誘餌袋／修繕箱／賞金證。一次選一種，開波生效：免費誘餌 1→2、額外修壁壘 6、清波多 ✦15。獨立本機存檔，戰役重置保留。 | VERIFIED：真清波解鎖與選取、重載後免費誘餌 2 份、UI 實際重置戰役後保留、夜襲不能換；另以明示存檔橋段驗證壁壘 63→81、首波獎金 19→34。 |
| M3 手機選單 | 補給放在既有暫停選單第四分頁，直式兩欄、矮橫式四欄；新增文字完整可見、返回／繼續始終可點。保留既有新手信標、手冊與骨架戰鬥流程。 | VERIFIED：390×844、844×390、1366×600；實際旋轉取消瞄準。`after-*-supply-locked.png` |
| Q1 品質 | 版本同步 package／lockfile／README；原有 smoke 的版本斷言由精確 R23 改為精確 R24，沒有刪測試或放寬數值斷言。 | VERIFIED：下表與 `version-check.json`、`secret-scan.json` |

## 自動驗證

證據目錄：[`evidence/r24-mobile/`](evidence/r24-mobile/)。所有瀏覽器 `headless: true`。

| 指令 | 結果 | 證據 |
|---|---|---|
| `npm run build`（包含 `tsc --noEmit`，與既有 CI 的建置入口相同） | VERIFIED，0 error | `build.txt` |
| `npm run test:smoke` | VERIFIED，196／196，原有回歸、動畫、模態互斥、RWD、控制可達性全綠 | `smoke-results.json`、`smoke.txt` |
| `npm run test:r24-mobile` | VERIFIED，74／74 | `mobile-results.json`、`mobile.txt` |
| `npm run test:r24-rules` | VERIFIED，14／14 | `rules-results.json`、`rules.txt` |
| `npm run test:r23-feedback` | VERIFIED，7／7 | `r23-feedback.txt` |
| `npm run test:simulation-fidelity` | VERIFIED，2 種生成間隔各觀測 1,001 次，誤差 0.0000% | `spawn-fidelity.json`、`simulation-fidelity.txt` |
| W25～30 基線逐局比較 | VERIFIED，720／720 與未修改 R23 快照完全一致 | `late-balance-regression.json`、`balance-before.json`、`balance.json` |
| 秘密掃描，`rg` 等價執行指定的兩個正則，排除 .git／node_modules | VERIFIED，0 命中；未讀取 .secrets | `secret-scan.json` |
| 舊版號搜尋、`git diff --check` | VERIFIED，執行期檔案舊 0.2.14 零命中；只保留歷史報告、before 證據與本機基線快照 | `version-check.json` |

before 取自未修改 HEAD `50695f2ee346f36fe602c53df442e9cc3f27530f` 的來源快照，與 after 使用相同初始存檔橋段、視口、headless Chromium。after 戰鬥截圖是在確認建造弩塔測試之後，不能據此比較兩版戰鬥勝率。before／after 各有 390×844、844×390、1366×600 的白天及戰鬥畫面。新增預覽、取消與補給另有截圖。測試的自然清波只證明此配置下流程可達，不代表新手自然通關率。`validation-summary.json` 記錄受測來源 SHA-256 與驗證計數。

## 效能與既存紅燈

- **並發載量測，僅供參考**：`scripts/measure-performance.mjs` 桌機／手機各 3 跑，兩組 p95 的三跑中位皆 16.8ms。這是本機 Chromium 模擬手機，背景另有並行工作；**不宣稱通過出貨效能閘**。`perf-raw.json` 已明記此限制與 shippingPerformanceGate=BLOCKED，數字未改寫。
- `npm run sim:balance -- --output ...` 的既存滿配 W29 守門為 **BLOCKED**：40／60＝66.7%，高於原 40～60% 上限。未修改 R23 HEAD 快照同樣失敗，W25～30 的 720 局及全部 gate 與本輪逐欄一致。保留失敗、原斷言和後期數值；沒有用放寬閾值或逐波 HP 調整製造綠燈。這項額外診斷不是全綠交付聲明。
- 新補給是可選優勢，既有固定種子模擬未加入補給策略；不能用原曲線宣稱補給平衡已驗收。
- 建置仍有既存 >500kB chunk 警告，主 JS 約 5.8MB（gzip 約 1.26MB）；低速手機首次下載與長局溫控未驗證。

## 美術、聲音與八大面向

美術、人物、地圖、角色樣子沿用現有正式資產；按鈕、選單、技能是本輪主改項；動作流暢度由原骨架／命中幀／hurt／death 守門回歸。沒有新增程序化方塊角色或場景，也沒有以整張圖搖動當動畫。

本輪無新生成 2D／3D／音訊資產；工具未提供可指定並核對的 `gpt-image-2` model slug，本輪沒有冒稱使用該模型。新落點／射程圈是操作標示。資產清單見 `asset-manifest.json`。

缺件與未驗證項目：專屬誘餌圖示、瞄準／取消專屬音效；實體 Android／iOS 多點觸控與 15～30 分鐘長局、乾淨機況出貨效能、補給對後段難度的影響。現有音訊未改寫來源或授權宣告。

守夜章只存在本機瀏覽器，沒有雲端或跨裝置同步；清除網站資料會移除。localStorage 無法寫入時只能保留本次執行期間的狀態。

## 繁中文案處理

依共用規則 mode 2 直接套用，不增加確認流程。

| 原句／原行為 | 原因 | 改成什麼 |
|---|---|---|
| 「點『誘餌』丟一塊肉」 | 需交代新手勢與取消 | 「輕點快投；拖曳瞄準，放開投擲。拖進取消區不扣肉。」 |
| 塔快捷列直接建造／升級 | 手機誤觸會花錢，且看不到固定位置 | 「中央／西側／東側固定塔位 · 射程 · 傷害」＋「確認建造／升級」＋「取消選取」 |
| R23 功能標記 | 與本輪內容不符 | 「R24 · 手機瞄準／戰術波／守夜補給」 |

既存 `docs/playtest/` 檔案原樣保留且未加入提交。本輪基線快照留在 `.audit-tmp/r24-before/`，也不提交。只提交本輪明確列出的原始碼、測試、計畫、報告與證據。
