# oss-audit：開源版全面檢查與更新

日期：2026-07-15

版本：`0.2.1`

分支：`main`

稽核基準：`c132b7f`（R8.2）

## 結論

本輪已完成開源入口、授權揭露、repository 衛生、分享 meta、版本一致性與功能 sanity 的全面稽核。修改範圍只包含文件、`index.html` meta 與 `.gitignore`；沒有修改 `src/` 遊戲邏輯，也沒有修改 `public/` 模型、圖片或其他素材。

Node 22.23.1（與 GitHub Actions 的 Node 22 基準一致）下：型別檢查、正式建置與 **81/81 smoke 全數通過**。

## 逐項交付

| # | 項目 | 結果 |
| ---: | --- | --- |
| 1 | README 全面翻新 | 完成遊戲簡介、線上遊玩、R8 最新特色、桌機／手機操作、3 張精選證據圖、技術棧、npm scripts、Blender 5.1 重建命令、smoke 與 CI badge |
| 2 | LICENSE | 保留標準 MIT 全文，修正 copyright 為 `Copyright (c) 2026 mars-tw` |
| 3 | CREDITS／第三方授權表 | 依現行載入路徑重查 Quaternius、Kenney、Noto 字型、npm 直接依賴與 Blender；每項列出來源、授權、用途及是否仍載入 |
| 4 | repo 衛生與 docs | 擴充 `.gitignore`；列出並刪除 3 個追蹤中的 `.pyc` 與 6 個本機 log；全 repo Markdown 本地目標檢查通過 |
| 5 | OG meta／封面 | 補 canonical、Open Graph、Twitter Card、圖片尺寸與 alt；使用可公開存取的 1920×1080 Blender 主選單背景 |
| 6 | 版本一致性 | README、`package.json`、`package-lock.json` 均為 `0.2.1` |
| 7 | 功能 sanity | `npm run typecheck` PASS；Node 22 下 `test:smoke` 81/81 PASS；production build PASS |

## README 與截圖選擇

README 使用下列三張 `docs/evidence/R8/` 成品，涵蓋封面、實機與角色陣容，沒有新增或改動素材：

1. `after-menu-background.png`：三主角、肉舖與防禦塔的 1920×1080 Blender 主視覺。
2. `online-gameplay-r8.png`：夜襲第 15 波、任務鏈與補給站同框的實機畫面。
3. `after-enemy-boss-npc-cast.png`：四名常客、三色殭屍與 Boss 的 R8 角色陣容。

Blender 章節記錄三主角／三塔、七角色包、三色殭屍、Boss、武器、UI kit 與 R8 evidence 的 headless 重建命令。這些命令會覆寫正式素材，因此 README 明確要求重建後檢查 Git diff 及 smoke。

## 素材與授權盤點

完整表格見 [`CREDITS.md`](../CREDITS.md)。本輪由 `src/game/StormGame.ts`、`src/game/content.ts` 與 `src/styles.css` 的實際路徑交叉核對：

- Quaternius Ultimate Animated Animal Pack：`cow.glb` 仍用於牧場牛。
- Quaternius Zombie Apocalypse Kit：`survivor.glb` 與 `customer.glb` 仍用於員工及匿名顧客；舊 `zombie.glb` 仍在 repo，但現行敵人不再載入它。
- Kenney Nature Kit：松樹、岩石、柵欄、門與營火石仍載入。
- Kenney Tower Defense Kit：目前只載入 `tower/arrow.glb`；舊塔身與塔武器未載入。
- Kenney Holiday Kit：雪屋模組與燈籠仍載入；`bench.glb` 未載入。
- Noto Sans TC／Noto Serif TC：由 Google Fonts 遠端載入，採 SIL OFL 1.1；repo 沒有內嵌字型檔。
- R8 custom 模型與 UI：由 repo 內 Blender 5.1 `bpy` 腳本原創生成，沿用專案 MIT，沒有把 Quaternius／Kenney 模型直接包入 R8 custom 路徑。
- 現行 repo 沒有音樂、音效或其他內嵌第三方字型。

來源頁面與關鍵公開 URL 於 2026-07-15 檢查皆回應 HTTP 200：線上遊戲、OG 封面、GitHub repo、兩個 Quaternius pack 與三個 Kenney kit。

## repo 衛生

### 已刪除：曾被 Git 追蹤的 Python cache

- `tools/blender/__pycache__/animated_asset_utils.cpython-313.pyc`
- `tools/blender/__pycache__/blender_utils.cpython-313.pyc`
- `tools/blender/__pycache__/hero_rig_factory.cpython-313.pyc`

### 已刪除：本機已忽略的暫存 log

- `tools/custom-preview.err.log`
- `tools/custom-preview.out.log`
- `tools/preview.err.log`
- `tools/preview.out.log`
- `tools/vite.err.log`
- `tools/vite.out.log`

### 保留但確實忽略

- `node_modules/`：本機依賴，不入庫。
- `dist/`：建置驗證輸出，不入庫。
- `tools/asset_sources/`：CC0 原始包與來源授權的本機追溯資料，不隨 repo 發布。

`.gitignore` 另補齊 Vite／coverage／Playwright 輸出、Python cache、Blender backup、編輯器暫存、作業系統雜項及本機 `.env`。

## OG、連結與版本驗證

- `index.html` 與 build 後 `dist/index.html` 均含 canonical、`og:title`、`og:description`、`og:url`、`og:image`、`og:image:width/height`、圖片 alt 及 Twitter large card。
- OG 圖片：`https://mars-tw.github.io/storm-apocalypse/images/ui/background/menu-background.png`，HTTP 200，本機與 build 輸出尺寸皆為 1920×1080。
- 全 repo Markdown 的相對檔案／圖片目標：PASS，0 個遺失。
- README 版本：`0.2.1`；`package.json`：`0.2.1`；lockfile root：`0.2.1`。

## 驗證結果

| 檢查 | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run build` | PASS；只有既有 public absolute URL 與 large chunk 提示 |
| Node 22.23.1 `npm` script `test:smoke` | **81/81 PASS，0 failed** |
| `git diff --check` | PASS |
| Markdown 本地連結檢查 | PASS，0 遺失 |
| 關鍵外部 URL | PASS，8/8 HTTP 200 |
| Gitleaks 8.30.1：Git 歷史＋本輪 staged 變更 | PASS，0 findings |

本機全域預設為 Node 24.15.0；在該非 CI 基準 runtime 上，smoke 曾出現一次頁面載入逾時與一次子程序未結束。切換到 repo／CI 指定的 Node 22.23.1 後，同一個 npm `test:smoke` script 完整跑完並 81/81 全綠，未放寬斷言、未改 smoke、未改遊戲邏輯。

## 變更檔案

- `.gitignore`
- `README.md`
- `LICENSE`
- `CREDITS.md`
- `index.html`
- `docs/CODEX_RESPONSE_oss_audit.md`
- 刪除上述 3 個已追蹤 `.pyc`

預定本地 commit 訊息：`文件：完成開源版全面稽核與更新`。本輪不 push。
