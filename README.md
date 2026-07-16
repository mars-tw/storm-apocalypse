# 暴風啟示錄 Storm Apocalypse

[![Deploy Pages](https://github.com/mars-tw/storm-apocalypse/actions/workflows/deploy.yml/badge.svg)](https://github.com/mars-tw/storm-apocalypse/actions/workflows/deploy.yml)
[![Version](https://img.shields.io/badge/version-0.2.1-c66b3d)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-79c3d2.svg)](LICENSE)

在永夜暴雪中狩獵、經營最後一間肉舖，建立防線並在三十次鐘聲裡守住僅存的燈火。《暴風啟示錄》是一款可直接在瀏覽器遊玩的 3D 經營 × 動作 × 塔防遊戲。

**[立即線上遊玩](https://mars-tw.github.io/storm-apocalypse/)**

[![暴風啟示錄封面：誰來走進暴風](assets/cover.png)](https://mars-tw.github.io/storm-apocalypse/)

## 最新特色

- **三位可選主角與骨架動畫**：屠夫老闆娘、退伍狙擊手、機械師少年各有專屬模型；Blender 5.1 產線輸出共用 18 骨骨架及 `idle`、`run`、`attack_melee`、`attack_ranged` 動畫片段。
- **R8 角色藝術總修**：主角、四名常客、三種殭屍與 Boss 統一為可重建的 stylized low-poly 視覺，補齊剪影、五官、敘事配件、材質層次與戰鬥反應。
- **Blender 渲染 UI**：角色立繪、主選單背景、圖示、atlas 與 9-slice 元件由同一套 `bpy` 色票及燈光 preset 產出。
- **任務鏈**：15 章生存手冊串起狩獵、肉舖經營、武器、員工、牧場與防禦塔解鎖，夜襲另有輪替目標。
- **30 波戰役**：白晝整備、夜間守備、敵人梯次與每 10 波 Boss 戰，進度保存於瀏覽器本機。
- **品質分檔**：依裝置能力自動套用低／中／高畫質，並以動態渲染比例與特效降級維持可玩性。

## 遊戲畫面

![第 15 波夜襲、任務手冊與補給站介面](docs/evidence/R8/online-gameplay-r8.png)

![R8 常客、殭屍與 Boss 角色陣容](docs/evidence/R8/after-enemy-boss-npc-cast.png)

## 操作方式

| 平台 | 移動 | 攻擊 | 其他操作 |
| --- | --- | --- | --- |
| 桌機 | `WASD` 或方向鍵 | `Space` 或 `E`；按住可連續攻擊 | `B` 建造、`N` 啟動下一波；商店與任務亦可用畫面按鈕 |
| 手機／平板 | 左下虛擬搖桿 | 右下「揮砍」按鈕 | 使用畫面按鈕開啟任務、補給站及波次 |

## 技術棧

- Vite 8 + TypeScript 7
- Babylon.js 9（WebGL 3D、glTF/GLB、動畫與後製）
- Blender 5.1 `bpy`（程序建模、骨架動畫、角色立繪與 UI 渲染）
- Playwright（桌機、觸控、動畫契約與戰鬥 smoke 測試）
- GitHub Actions + GitHub Pages

目前版本為 **0.2.1**，與 [`package.json`](package.json) 及 lockfile 一致。

## 本地開發

需求：Node.js 22、npm；若要重建美術素材，另需 Blender 5.1。

```bash
npm ci
npx playwright install chromium
npm run dev
```

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動可供區網存取的 Vite 開發伺服器 |
| `npm run typecheck` | 執行 TypeScript 型別檢查，不產生檔案 |
| `npm run build` | 型別檢查後建立 `dist/` 正式版 |
| `npm run preview` | 預覽 `dist/` |
| `npm run test:smoke` | 以 headless Chromium 驗證桌機、手機、觸控與角色動畫流程 |
| `npm run test:smoke:headed` | 以可見 Chrome 執行 WebGL smoke 驗證 |

送出變更前至少執行：

```bash
npm run typecheck
npm run test:smoke
```

## Blender 5.1 素材產線

以下 PowerShell 命令會覆寫 `public/models/custom/`、`public/images/` 與 R8 證據圖；請從 repo 根目錄執行，完成後務必檢查 Git diff 與 smoke 結果。

```powershell
$blender = 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe'

& $blender --background --python tools/blender/build_animation_r2.py
& $blender --background --python tools/blender/build_character_pack.py
& $blender --background --python tools/blender/zombie_r8.py
& $blender --background --python tools/blender/boss_zombie.py
& $blender --background --python tools/blender/weapon_pack.py
& $blender --background --python tools/blender/ui_kit.py
& $blender --background --python tools/blender/r8_evidence.py -- --phase after
```

場景道具與建築則由同目錄下的單項腳本重建，例如 `butcher_stall.py`、`cash_register.py`、`doghouse.py`、`meat_slice.py` 與 `coin.py`。產線設計與動畫契約詳見 [`docs/CODEX_RESPONSE_blender_R2.md`](docs/CODEX_RESPONSE_blender_R2.md) 及 [`docs/CODEX_RESPONSE_storm_R8.md`](docs/CODEX_RESPONSE_storm_R8.md)。

## 授權與致謝

專案程式碼及本專案原創素材採 [MIT License](LICENSE)。第三方模型、字型、框架與開發工具的來源、授權及實際用途請見 [CREDITS.md](CREDITS.md)。

維護文件：[Roadmap](docs/ROADMAP.md) · [oss-audit 報告](docs/CODEX_RESPONSE_oss_audit.md)
