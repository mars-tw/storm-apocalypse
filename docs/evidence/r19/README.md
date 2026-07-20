# R19 evidence manifest

## Before（PLAYTEST-R1 唯讀複本）

| 檔案 | 原始來源 |
| --- | --- |
| `before/390x844-combat.png` | `docs/playtest/shots/phone-portrait-05-touch-gameplay.png` |
| `before/844x390-combat.png` | `docs/playtest/shots/phone-portrait-09-rotated-landscape.png` |
| `before/1366x768-combat.png` | `docs/playtest/shots/desktop-45-wave3-player-combat.png` |

## After（Playwright 真夜襲 attack frame）

最終 full smoke 以 `R19_EVIDENCE_DIR=docs/evidence/r19/after` 產出：

- `after-390x844-combat-attack.png` + `after-390x844-framing.json`
- `after-844x390-combat-attack.png` + `after-844x390-framing.json`
- `after-1366x768-combat-attack.png` + `after-1366x768-framing.json`
- `smoke-results.json`：最終 full smoke 機讀結果（181/181、0 failed）

JSON 記錄 viewport、profile、HUD safe frame、player bounds、玩家錨點、攻擊方向、方向像素長度、遮擋採樣與相機 beta/radius/offset。歷史 evidence 未覆寫。
