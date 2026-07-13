import "./styles.css";
import { StormGame } from "./game/StormGame";
import { loadState, resetSave } from "./game/state";
import { UiController } from "./game/ui";

async function bootstrap(): Promise<void> {
  const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
  const root = document.querySelector<HTMLElement>("#app");
  if (!canvas || !root) throw new Error("Storm Apocalypse mount points are missing.");

  const ui = new UiController(root);
  const game = new StormGame(canvas, ui, loadState());
  ui.onStart = () => game.start();
  ui.onAttackStart = () => game.startAttack();
  ui.onAttackEnd = () => game.stopAttack();
  ui.onWave = () => game.startWave();
  ui.onShopAction = (category, id) => game.shopAction(category, id);
  ui.onTowerAction = (id) => game.towerAction(id);
  ui.onReset = () => resetSave();

  try {
    await game.initialize();
    ui.markReady();
  } catch (error) {
    console.error(error);
    ui.setLoading(0.12, "北境資產載入失敗，請重新整理頁面");
  }
}

void bootstrap();
