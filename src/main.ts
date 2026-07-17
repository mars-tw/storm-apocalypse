import "./styles.css";
import { ProceduralAudio } from "./game/audio";
import { loadSettings, saveSettings } from "./game/settings";
import { StormGame } from "./game/StormGame";
import { loadState, resetSave } from "./game/state";
import { UiController } from "./game/ui";

async function bootstrap(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  const root = document.querySelector<HTMLElement>("#app");
  if (!canvas || !root) throw new Error("Storm Apocalypse mount points are missing.");

  const state = loadState();
  const settings = loadSettings();
  const audio = new ProceduralAudio(settings);
  const ui = new UiController(root, state, settings);
  const testBuild = import.meta.env.DEV || import.meta.env.MODE === "smoke";
  const uiOnlySmoke = testBuild
    && new URLSearchParams(window.location.search).has("smoke")
    && new URLSearchParams(window.location.search).has("ui-only");
  if (uiOnlySmoke) {
    ui.markReady();
    return;
  }
  const game = new StormGame(canvas, ui, state, settings, audio);
  let gameReady = false;
  let startRequested = false;
  ui.onProtagonistSelect = (id) => game.selectProtagonist(id);
  ui.onStart = () => {
    if (gameReady) game.start();
    else {
      startRequested = true;
      ui.setLoading(0.02, "守燈人已就位，正在展開北境");
    }
  };
  ui.onAttackStart = () => game.startAttack();
  ui.onAttackEnd = () => game.stopAttack();
  ui.onWave = () => game.startWave();
  ui.onShopAction = (category, id) => game.shopAction(category, id);
  ui.onTowerAction = (id) => game.towerAction(id);
  ui.onWeaponCycle = () => game.cycleWeapon();
  ui.onReset = () => resetSave();
  ui.onPauseChange = (paused) => game.setPaused(paused);
  ui.onSettingsChange = (next) => {
    Object.assign(settings, next);
    saveSettings(settings);
    audio.updateSettings(settings);
    game.applySettings(settings);
  };
  ui.onUiSound = () => audio.play("ui");
  window.addEventListener("pointerdown", () => void audio.unlock(), { capture: true, once: true });
  window.addEventListener("keydown", () => void audio.unlock(), { capture: true, once: true });
  const smokeMode = testBuild && new URLSearchParams(window.location.search).has("smoke");
  if (!smokeMode) ui.markInteractive();

  try {
    await game.initialize();
    gameReady = true;
    ui.markReady();
    if (startRequested) game.start();
  } catch (error) {
    console.error(error);
    ui.setLoading(0.12, "北境資產載入失敗，請重新整理頁面");
  }
}

void bootstrap();
