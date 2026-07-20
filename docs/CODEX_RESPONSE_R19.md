實作者：Codex（GPT-5）

# storm R19 修正回報

## 逐項修法

### 1. SA-R1-01 / Grok P0：390×844 角色與命中方向不可讀

- `StormGame` 新增極窄直向 camera profile；只在 aspect `< 0.72` 漸入，aspect `<= 0.56` 才完整套用，844×390、1366×768 與一般平板保持原 R18 profile。
- 相機直接量測 top HUD 底緣與 bottom controls 頂緣，建立 12px 內縮安全框；角色錨點用 `targetScreenOffset.y` 對準安全框中心。
- 完整窄直向 profile：radius 額外 +3、beta `1.02 → 0.82`，同時平滑 target/radius/beta/offset，避開近景圍欄且保留最近威脅視野。
- smoke-only framing probe 以 skinned player 的 world bounds 投影、實際 `Scene.pick` 遮擋採樣與 mesh forward 攻擊方向做機器驗證；角色 physics root 與視覺骨架仍分離，既有攻擊 anticipation/impact/recovery 與敵人 hurt/death 完全未改。

390×844 真夜襲量測：HUD 安全框 `x=12–378, y=180–575`；角色 bounds `x=169.72–230.20, y=343.20–428.21`（約 `60.48×85.01px`），完整位於安全框；9/9 遮擋採樣命中角色；攻擊方向投影 `73.42px`。`after/after-390x844-combat-attack.png` 可見角色位於下方 HUD 上方、未被圍欄截斷，持槍姿勢與朝右上敵群的射擊方向均可辨。

### 2. SA-R1-03 / P2：旋轉後短暫 24 FPS

- 移除 resize event 內的同步 `engine.resize()`。
- 改為 140ms trailing debounce：CSS/visual viewport 先穩定，resize burst 最後只重建一次 Babylon render target；相機安全框快取則在事件當下失效。
- smoke 新增五事件 burst gate：70ms 內零 rebuild，220ms 後恰好一個 rebuild。
- 這是低風險尖峰緩解；Playwright headless 無法替代原手機 GPU 的真人 FPS 複測，殘留實機效能量測列在下方。

### 3. SA-R1-02 / P1：第 30 波數值牆

- 本輪未改平衡。R1 只有兩局手動結果（18／24 秒、26／28 擊殺），repo 也沒有固定 seed／重播 harness，無法安全推論單一生成間隔或防守能力。
- `docs/OPTIM_PLAN_R19.md` 已列 deterministic seed、多策略多局、壁壘傷害時間線、擊殺來源與 A/B 單變數驗證需求；避免用不完整資料破壞 W1–29 與既有 smoke。

## Playwright 三視口證據

| 視口 | Profile | 角色 bounds | 可見採樣 | 攻擊方向 | 結果 |
| --- | --- | ---: | ---: | ---: | --- |
| 390×844 | narrow-portrait | 60.48×85.01px | 9/9 | 73.42px | 角色完整在 `y=180–575` 安全框，非 HUD／圍欄截斷 |
| 844×390 | standard | 33.41×44.07px | 8/9 | 34.86px | 保持 R18 橫向 framing |
| 1366×768 | standard | 61.32×86.69px | 5/9 | 68.59px | 保持桌機 framing，通過至少半數可見 gate |

before/after PNG 與 after framing JSON：`docs/evidence/r19/`。before 來源為 PLAYTEST-R1 截圖的唯讀複本；原 `docs/playtest/` 未修改、未納入 commit。

## Gates

- `npm run typecheck`：PASS（exit 0）。
- `npm run build`：PASS（exit 0，Vite production build，3223 modules transformed）；僅保留既有 runtime asset resolution 與大 chunk 警告。
- `npm run test:smoke`：PASS，`181/181 checks passed; 0 failed`；包含既有 R18 boot／selection／waiting assertions、R19 三視口 framing 與 resize burst gate。完整機讀結果為 `docs/evidence/r19/smoke-results.json`。
- active version surfaces 搜尋 `0.2.9`：0 命中；歷史 R18 文件與未提交的 `docs/playtest/` 原始報告照約束保留舊版紀錄。
- 強特徵秘密掃描：0 命中。
- 分支：`main`；提交採 file-scoped staging，未納入 `docs/playtest/`、`docs/audit_openclose/` 或本機測試暫存。

完整 smoke 另修正 Windows/D3D11 runner 收尾：只延遲第一個 entry bundle 模擬 R18 loading，瀏覽器 close／launch 有上限，證據落盤後明確返回 exit code；避免測試已完成卻被 Chromium GPU 子程序卡住。

## 版本鏈

- `package.json`：0.2.10
- `package-lock.json`：root/package 0.2.10
- `README.md`：badge、版本文字與 R19 功能說明 0.2.10
- UI marker／系統註記：R19

## 殘留

- SA-R1-02 保留於 R19 backlog，等待固定 seed 多局資料。
- SA-R1-03 已降低同幀重建風險，但仍需同一支真人手機旋轉複測 FPS trace；若仍有可感尖峰，再評估短過場遮罩。
- 本輪沒有新增 AI 圖或其他美術資產，沒有 push。
