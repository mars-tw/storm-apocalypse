import { EMPLOYEES, MAIN_QUESTS, NAMED_CUSTOMERS, PROTAGONISTS, SHOP_UNLOCK_CHAPTER, TOWERS, WEAPONS, hasCompletedChapter, towerCostForState } from "./content";
import { currentLoopDefinition, currentMainQuest, type QuestCompletion } from "./quests";
import type { PlayerSettings } from "./settings";
import type { EmployeeId, ProtagonistId, RuntimeState, TowerId, WeaponId } from "./state";
import { getWavePlan } from "./waveDirector";

type ShopCategory = "weapon" | "employee" | "pasture";
type ShopTab = "weapon" | "employee" | "regular" | "expansion";
type SystemTab = "game" | "audio" | "system";

export type WorldActionTarget =
  | { type: "tower"; id: TowerId; x: number; y: number }
  | { type: "employee"; id: EmployeeId; x: number; y: number }
  | { type: "pasture"; id: "pasture2"; x: number; y: number };

interface ActionState {
  title: string;
  detail: string;
  label: string;
  disabled: boolean;
  active: boolean;
  locked: boolean;
  icon: string;
}

const SHOP_TABS: ReadonlyArray<{ id: ShopTab; label: string }> = [
  { id: "weapon", label: "武裝" },
  { id: "employee", label: "員工" },
  { id: "regular", label: "常客" },
  { id: "expansion", label: "擴張" },
];

function detectTouchMode(): boolean {
  const userAgentData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  if (userAgentData?.mobile || mobileUa) return true;

  // 主指標為準：觸控筆電（滑鼠為主但有觸控螢幕）必須維持桌機操作介面
  const primaryCoarse = matchMedia("(pointer: coarse)").matches;
  const touchCapable = matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  return primaryCoarse || touchCapable && window.innerWidth <= 1100;
}

export class UiController {
  readonly joystick: HTMLElement;
  readonly touchMode: boolean;
  private readonly intro: HTMLElement;
  private readonly loadingBar: HTMLElement;
  private readonly loadingText: HTMLElement;
  private readonly startButton: HTMLButtonElement;
  private readonly money: HTMLElement;
  private readonly meat: HTMLElement;
  private readonly stock: HTMLElement;
  private readonly wave: HTMLElement;
  private readonly performance: HTMLElement;
  private readonly baseHealth: HTMLElement;
  private readonly baseHealthFill: HTMLElement;
  private readonly questPanel: HTMLElement;
  private readonly panelScrim: HTMLElement;
  private readonly questToggle: HTMLButtonElement;
  private readonly questChapter: HTMLElement;
  private readonly questTitle: HTMLElement;
  private readonly questLog: HTMLElement;
  private readonly questProgress: HTMLElement;
  private readonly questProgressFill: HTMLElement;
  private readonly questReward: HTMLElement;
  private readonly loopQuest: HTMLElement;
  private readonly loopTitle: HTMLElement;
  private readonly loopCopy: HTMLElement;
  private readonly loopProgress: HTMLElement;
  private readonly loopProgressFill: HTMLElement;
  private readonly prompt: HTMLElement;
  private readonly commandPanel: HTMLElement;
  private readonly towerDock: HTMLElement;
  private readonly waveButton: HTMLButtonElement;
  private readonly weaponButton: HTMLButtonElement;
  private readonly weaponIcon: HTMLElement;
  private readonly attackButton: HTMLButtonElement;
  private readonly attackIcon: HTMLElement;
  private readonly worldAction: HTMLElement;
  private readonly worldActionButton: HTMLButtonElement;
  private readonly worldActionIcon: HTMLElement;
  private readonly worldActionTitle: HTMLElement;
  private readonly worldActionDetail: HTMLElement;
  private readonly worldActionPrice: HTMLElement;
  private readonly toastHost: HTMLElement;
  private readonly result: HTMLElement;
  private readonly resultTitle: HTMLElement;
  private readonly resultCopy: HTMLElement;
  private readonly resultStats: HTMLElement;
  private readonly protagonistStatus: HTMLElement;
  private readonly systemMenu: HTMLElement;
  private readonly settingsButton: HTMLButtonElement;
  private readonly masterVolume: HTMLInputElement;
  private readonly sfxVolume: HTMLInputElement;
  private readonly masterVolumeValue: HTMLOutputElement;
  private readonly sfxVolumeValue: HTMLOutputElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly shakeButton: HTMLButtonElement;
  private readonly resetConfirm: HTMLElement;
  private readonly requiresProtagonistSelection: boolean;
  private selectedProtagonist: ProtagonistId = "butcher_matron";
  private renderedChapter = 0;
  private activeShopTab: ShopTab = "weapon";
  private activeWorldAction: WorldActionTarget | null = null;
  private activeSystemTab: SystemTab = "game";
  private systemMenuOpen = false;
  private focusBeforeMenu: HTMLElement | null = null;
  private settings: PlayerSettings;

  onStart: () => void = () => undefined;
  onAttackStart: () => void = () => undefined;
  onAttackEnd: () => void = () => undefined;
  onWave: () => void = () => undefined;
  onReset: () => void = () => undefined;
  onProtagonistSelect: (id: ProtagonistId) => void = () => undefined;
  onShopAction: (category: ShopCategory, id: string) => void = () => undefined;
  onTowerAction: (id: TowerId) => void = () => undefined;
  onWeaponCycle: () => void = () => undefined;
  onPauseChange: (paused: boolean) => void = () => undefined;
  onSettingsChange: (settings: PlayerSettings) => void = () => undefined;
  onUiSound: () => void = () => undefined;

  constructor(root: HTMLElement, state: RuntimeState, settings: PlayerSettings) {
    this.touchMode = detectTouchMode();
    root.classList.toggle("is-touch", this.touchMode);
    const startHint = this.touchMode ? "虛擬搖桿移動 · 揮砍鈕攻擊" : "WASD 移動 · 空白鍵攻擊";
    const promptKey = this.touchMode ? "搖桿" : "WASD";
    const promptHint = this.touchMode ? "虛擬搖桿移動 · 揮砍鈕攻擊" : "穿越雪地 · 空白鍵揮砍";
    this.requiresProtagonistSelection = state.requiresProtagonistSelection;
    this.selectedProtagonist = state.protagonistId;
    this.settings = { ...settings };
    root.dataset.uiVersion = "R12";
    const icon = (name: string, className = ""): string => `<i class="asset-icon asset-icon--${name}${className ? ` ${className}` : ""}" aria-hidden="true"></i>`;
    const skillIcons: Record<ProtagonistId, string> = {
      butcher_matron: "skill-butcher",
      vet_sniper: "skill-sniper",
      mech_youth: "skill-mechanic",
    };
    const selectionCards = PROTAGONISTS.map((protagonist) => `
      <button class="character-card${protagonist.id === this.selectedProtagonist ? " is-selected" : ""}" type="button" data-protagonist="${protagonist.id}" aria-pressed="${protagonist.id === this.selectedProtagonist}">
        <span class="character-card__portrait"><picture><source media="(max-width:540px)" srcset="${import.meta.env.BASE_URL}${protagonist.portrait.replace(".png", "-low.png")}"><source media="(max-width:1100px)" srcset="${import.meta.env.BASE_URL}${protagonist.portrait.replace(".png", "-medium.png")}"><img src="${import.meta.env.BASE_URL}${protagonist.portrait}" width="512" height="768" alt="${protagonist.name} Blender 英雄立繪"></picture></span>
        <span class="character-card__copy"><small>${protagonist.runSummary}</small><b>${protagonist.name}</b><q>「${protagonist.persona}」</q><span class="character-card__skill">${icon(skillIcons[protagonist.id])}<span><em>${protagonist.passive}</em><i>${protagonist.passiveDescription}</i></span></span></span>
      </button>`).join("");
    const introContent = this.requiresProtagonistSelection ? `
      <div class="character-select" id="character-select">
        <div class="character-select__head"><span>新戰役 · 選擇守燈人</span><h1>誰來走進<span>暴風</span>？</h1><p>三條路都能守到第三十次鐘聲。確認後，本局不可換角。</p></div>
        <div class="character-grid" role="radiogroup" aria-label="選擇主角">${selectionCards}</div>
        <div class="loader"><i><em id="loading-bar"></em></i><span id="loading-text">喚醒風雪…</span></div>
        <button class="start-button start-button--confirm" id="start-button" disabled><span>確認屠夫老闆娘</span><small>寫入存檔 · ${startHint}</small></button>
      </div>` : `
      <div class="intro__content">
        <span class="intro__overline">北境封鎖區 · 第 1,247 日</span><h1><span>暴風</span>啟示錄</h1><h2>STORM APOCALYPSE</h2>
        <p>在永夜暴雪中狩獵、經營最後一間肉舖，<br>並在三十次鐘聲裡守住僅存的燈火。</p>
        <div class="intro__features"><span>30 波戰役</span><span>經營 × 塔防</span><span>本地存檔</span></div>
        <div class="loader"><i><em id="loading-bar"></em></i><span id="loading-text">喚醒風雪…</span></div>
        <button class="start-button" id="start-button" disabled><span>踏 入 暴 風</span><small>${startHint}</small></button>
      </div>`;
    const shopTabs = SHOP_TABS.map((tab) => `
      <button class="command-tab${tab.id === this.activeShopTab ? " is-active" : ""}" type="button" data-shop-tab="${tab.id}" role="tab" aria-selected="${tab.id === this.activeShopTab}" aria-controls="shop-section-${tab.id}">${tab.label}</button>`).join("");
    root.innerHTML = `
      <div class="vignette"></div>
      <header class="hud hud--top">
        <div class="brand-mark"><span class="brand-mark__sigil">✦</span><span><b>暴風啟示錄</b><small>STORM APOCALYPSE</small></span></div>
        <div class="resources">
          <div class="resource resource--gold"><span>✦</span><div><small>資金</small><b id="hud-money">35</b></div></div>
          <div class="resource"><span>🥩</span><div><small>背包</small><b id="hud-meat">0 / 6</b></div></div>
          <div class="resource"><span>▤</span><div><small>攤位存貨</small><b id="hud-stock">0 / 6</b></div></div>
        </div>
        <div class="hud-status"><div class="wave-chip"><small>30 波戰役</small><b id="hud-wave">黎明 · 0 / 30</b></div><span class="protagonist-status" id="protagonist-status"></span><small id="performance-chip">高畫質</small><button class="settings-button" id="settings-button" type="button" aria-label="開啟暫停與設定" aria-controls="system-menu" aria-expanded="false"><span aria-hidden="true">⚙</span></button></div>
      </header>

      <button class="panel-toggle panel-toggle--quest" id="quest-toggle" aria-label="開關生存手冊" aria-controls="quest-panel" aria-expanded="false">手冊 01 · 0/1</button>
      <div class="panel-scrim" id="panel-scrim" aria-hidden="true"></div>
      <aside class="quest-panel" id="quest-panel">
        <div class="quest-panel__line"><span id="quest-chapter">生存手冊 · 01 / 15</span><i></i><button id="quest-close" aria-label="收合生存手冊">×</button></div>
        <h2 id="quest-title">前往東側牧場</h2>
        <p class="quest-log" id="quest-log">封鎖線以東還有活物。今晚的湯，得靠自己的刀。</p>
        <div class="quest-meter"><span>任務進度</span><b id="quest-progress">0 / 1</b><i><em id="quest-progress-fill"></em></i></div>
        <div class="quest-reward"><span>完成獎勵</span><b id="quest-reward">✦ 10</b></div>
        <div class="base-meter"><span>肉舖壁壘</span><b id="base-health">100%</b><i><em id="base-health-fill"></em></i></div>
        <section class="loop-quest" id="loop-quest" hidden>
          <span>本波委託</span><b id="loop-title">完整貨架</b><p id="loop-copy">本波不損失攤位存貨</p>
          <div><i><em id="loop-progress-fill"></em></i><small id="loop-progress">0 / 1</small></div>
        </section>
      </aside>

      <button class="panel-toggle panel-toggle--shop" id="shop-toggle" aria-label="開關整備商店" aria-controls="command-panel" aria-expanded="false">整備</button>
      <aside class="command-panel" id="command-panel">
        <div class="command-panel__head"><div><small>北境補給站</small><b>武裝與自動化</b></div><button id="shop-close" aria-label="關閉整備商店">×</button></div>
        <div class="command-tabs" role="tablist" aria-label="整備分類">${shopTabs}</div>
        <section id="shop-section-weapon" class="shop-section is-active" data-shop-section="weapon" role="tabpanel"><h3>武器鏈</h3><div class="shop-grid">${WEAPONS.map((item) => `<button class="shop-item" data-category="weapon" data-id="${item.id}">${icon(`weapon-${item.id}`, "shop-item__icon")}<span class="shop-item__copy"><b>${item.name}</b><small>${item.description}</small></span><em data-price="weapon-${item.id}"></em></button>`).join("")}</div></section>
        <section id="shop-section-employee" class="shop-section" data-shop-section="employee" role="tabpanel" hidden><h3>自動化員工</h3><div class="shop-grid">${EMPLOYEES.map((item) => `<button class="shop-item" data-category="employee" data-id="${item.id}">${icon(`skill-${item.id}`, "shop-item__icon")}<span class="shop-item__copy"><b>${item.name}</b><small data-description="employee-${item.id}">${item.description}</small></span><em data-price="employee-${item.id}"></em></button>`).join("")}</div></section>
        <section id="shop-section-regular" class="shop-section regulars" data-shop-section="regular" role="tabpanel" hidden><h3>北境常客</h3><div class="regular-list">${NAMED_CUSTOMERS.map((customer) => `<article data-regular="${customer.id}"><div><b>${customer.name}</b><small>${customer.preference}</small></div><span><i></i><em>0 / 10</em></span></article>`).join("")}</div></section>
        <section id="shop-section-expansion" class="shop-section" data-shop-section="expansion" role="tabpanel" hidden><h3>牧場擴張</h3><button class="shop-item" data-category="pasture" data-id="pasture2">${icon("skill-butcher", "shop-item__icon")}<span class="shop-item__copy"><b>炸開牧場 2</b><small>強化牛 · 生命 9 · 掉落 6 肉</small></span><em data-price="pasture-pasture2"></em></button></section>
      </aside>

      <div class="context-prompt" id="context-prompt"><kbd>${promptKey}</kbd><span>${promptHint}</span></div>
      <div class="bottom-controls">
        <div class="joystick" aria-label="移動搖桿"><span class="joystick__ring"></span><span class="joystick__knob"></span></div>
        <div class="combat-dock">
          <div class="tower-dock" id="tower-dock" aria-label="防禦塔快捷列">
            ${TOWERS.map((item) => `<button class="tower-dock__button" type="button" data-tower-dock="${item.id}">${icon(`tower-${item.id}`, "tower-dock__icon")}<span><b>${item.name}</b><small data-tower-dock-status="${item.id}">建造</small></span></button>`).join("")}
          </div>
          <button class="wave-button" id="wave-button" disabled><small>準備防守</small><b>至少建造一座塔</b></button>
        </div>
        <div class="right-combat-controls">
          <button class="weapon-button" id="weapon-button" type="button" aria-label="切換武器"><i id="weapon-cycle-icon" class="asset-icon asset-icon--weapon-machete weapon-button__icon" aria-hidden="true"></i><small>武器</small></button>
          <button class="attack-button" id="attack-button" aria-label="攻擊"><i id="attack-icon" class="asset-icon asset-icon--weapon-machete attack-button__icon" aria-hidden="true"></i><small>揮砍</small></button>
        </div>
      </div>
      <div class="world-action-popover" id="world-action-popover" hidden>
        <button class="world-action-popover__button" id="world-action-button" type="button">
          <i id="world-action-icon" class="asset-icon asset-icon--tower-ballista world-action-popover__icon" aria-hidden="true"></i>
          <span><b id="world-action-title">建造</b><small id="world-action-detail">選擇操作</small></span>
          <em id="world-action-price"></em>
        </button>
      </div>
      <div class="toast-host" id="toast-host"></div>

      <section class="system-menu" id="system-menu" role="dialog" aria-modal="true" aria-labelledby="system-menu-title" hidden>
        <div class="system-menu__card">
          <header class="system-menu__head"><div><small>北境行動中樞</small><h2 id="system-menu-title">暫停與設定</h2></div><button id="system-menu-close" type="button" aria-label="關閉設定並繼續遊戲">×</button></header>
          <nav class="system-tabs" role="tablist" aria-label="設定分類">
            <button class="is-active" type="button" role="tab" data-system-tab="game" aria-selected="true" aria-controls="system-panel-game">遊戲</button>
            <button type="button" role="tab" data-system-tab="audio" aria-selected="false" aria-controls="system-panel-audio">聲音</button>
            <button type="button" role="tab" data-system-tab="system" aria-selected="false" aria-controls="system-panel-system">系統</button>
          </nav>
          <div class="system-menu__body">
            <section class="system-panel is-active" id="system-panel-game" data-system-panel="game" role="tabpanel">
              <div class="setting-block"><div><b>畫質檔位</b><small>自動會依裝置能力選擇，手動檔位會保存。</small></div><div class="quality-options" role="group" aria-label="畫質檔位">
                <button type="button" data-quality="auto">自動</button><button type="button" data-quality="high">高</button><button type="button" data-quality="medium">中</button><button type="button" data-quality="low">低</button>
              </div></div>
              <div class="setting-row"><span><b>螢幕震動</b><small>保留命中感，關閉後鏡頭保持穩定。</small></span><button class="setting-switch" id="shake-toggle" type="button" role="switch" aria-checked="true"><span></span><em>開啟</em></button></div>
            </section>
            <section class="system-panel" id="system-panel-audio" data-system-panel="audio" role="tabpanel" hidden>
              <label class="volume-control" for="master-volume"><span><b>主音量</b><output id="master-volume-value" for="master-volume">80%</output></span><input id="master-volume" type="range" min="0" max="100" step="1" value="80"></label>
              <label class="volume-control" for="sfx-volume"><span><b>效果音</b><output id="sfx-volume-value" for="sfx-volume">90%</output></span><input id="sfx-volume" type="range" min="0" max="100" step="1" value="90"></label>
              <div class="setting-row"><span><b>靜音</b><small>保留音量值，一鍵關閉所有程序化音效。</small></span><button class="setting-switch" id="mute-toggle" type="button" role="switch" aria-checked="false"><span></span><em>關閉</em></button></div>
            </section>
            <section class="system-panel" id="system-panel-system" data-system-panel="system" role="tabpanel" hidden>
              <div class="reset-save" id="reset-save"><div><b>重置戰役存檔</b><small>清除波次、角色、武器、員工與建設；聲音和畫質偏好會保留。</small></div><button class="danger-button" id="reset-save-open" type="button">重置存檔</button></div>
              <div class="reset-confirm" id="reset-confirm" hidden><strong>確定清除所有戰役進度？</strong><span><button id="reset-save-cancel" type="button">取消</button><button class="danger-button" id="reset-save-confirm" type="button">確認清除</button></span></div>
              <p class="system-note">R12 · 程序化 WebAudio · 本機存檔</p>
            </section>
          </div>
          <footer class="system-menu__footer"><span>遊戲模擬已暫停</span><button id="resume-button" type="button">繼續遊戲</button></footer>
        </div>
      </section>

      <section class="intro${this.requiresProtagonistSelection ? " intro--selection" : ""}" id="intro">
        <div class="intro__render" aria-hidden="true"><div class="intro__render-scene"></div><div class="intro__render-dust"></div></div>
        ${introContent}
        <div class="intro__side"><span>THE LAST BUTCHER</span><i></i><small>TAIPEI / LOCAL SAVE</small></div>
      </section>

      <section class="result" id="result" hidden><div class="result__card">
        <span>暴風戰報</span><h2 id="result-title">黎明仍在</h2><p id="result-copy"></p><div class="result-stats" id="result-stats"></div>
        <button id="result-button">帶著進度重整</button><button class="text-button" id="reset-button">清除進度並重開</button>
      </div></section>`;

    const get = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
    this.joystick = root.querySelector<HTMLElement>(".joystick")!;
    this.intro = get("intro");
    this.loadingBar = get("loading-bar");
    this.loadingText = get("loading-text");
    this.startButton = get("start-button");
    this.money = get("hud-money");
    this.meat = get("hud-meat");
    this.stock = get("hud-stock");
    this.wave = get("hud-wave");
    this.performance = get("performance-chip");
    this.baseHealth = get("base-health");
    this.baseHealthFill = get("base-health-fill");
    this.panelScrim = get("panel-scrim");
    this.questPanel = get("quest-panel");
    this.questToggle = get("quest-toggle");
    this.questChapter = get("quest-chapter");
    this.questTitle = get("quest-title");
    this.questLog = get("quest-log");
    this.questProgress = get("quest-progress");
    this.questProgressFill = get("quest-progress-fill");
    this.questReward = get("quest-reward");
    this.loopQuest = get("loop-quest");
    this.loopTitle = get("loop-title");
    this.loopCopy = get("loop-copy");
    this.loopProgress = get("loop-progress");
    this.loopProgressFill = get("loop-progress-fill");
    this.prompt = get("context-prompt");
    this.commandPanel = get("command-panel");
    this.towerDock = get("tower-dock");
    this.waveButton = get("wave-button");
    this.weaponButton = get("weapon-button");
    this.weaponIcon = get("weapon-cycle-icon");
    this.attackButton = get("attack-button");
    this.attackIcon = get("attack-icon");
    this.worldAction = get("world-action-popover");
    this.worldActionButton = get("world-action-button");
    this.worldActionIcon = get("world-action-icon");
    this.worldActionTitle = get("world-action-title");
    this.worldActionDetail = get("world-action-detail");
    this.worldActionPrice = get("world-action-price");
    this.toastHost = get("toast-host");
    this.result = get("result");
    this.resultTitle = get("result-title");
    this.resultCopy = get("result-copy");
    this.resultStats = get("result-stats");
    this.protagonistStatus = get("protagonist-status");
    this.systemMenu = get("system-menu");
    this.settingsButton = get("settings-button");
    this.masterVolume = get("master-volume");
    this.sfxVolume = get("sfx-volume");
    this.masterVolumeValue = get("master-volume-value");
    this.sfxVolumeValue = get("sfx-volume-value");
    this.muteButton = get("mute-toggle");
    this.shakeButton = get("shake-toggle");
    this.resetConfirm = get("reset-confirm");

    const clearPressed = (): void => {
      for (const button of root.querySelectorAll("button.is-pressed")) button.classList.remove("is-pressed");
    };
    root.addEventListener("pointerdown", (event) => {
      (event.target as HTMLElement).closest<HTMLButtonElement>("button:not(:disabled)")?.classList.add("is-pressed");
    });
    root.addEventListener("pointerup", clearPressed);
    root.addEventListener("pointercancel", clearPressed);
    root.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("button:not(:disabled)")) this.onUiSound();
    });
    window.addEventListener("blur", () => {
      clearPressed();
      this.onAttackEnd();
    });

    const bindImmediate = (button: HTMLButtonElement, action: () => void): void => {
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 || button.disabled) return;
        event.preventDefault();
        action();
      });
      button.addEventListener("click", (event) => {
        if (event.detail === 0) action();
      });
    };
    const shopToggle = get<HTMLButtonElement>("shop-toggle");
    const setOpenPanel = (panel: "quest" | "shop" | null): void => {
      const questOpen = panel === "quest";
      const shopOpen = panel === "shop";
      this.questPanel.classList.toggle("is-open", questOpen);
      this.commandPanel.classList.toggle("is-open", shopOpen);
      this.questToggle.setAttribute("aria-expanded", String(questOpen));
      shopToggle.setAttribute("aria-expanded", String(shopOpen));
      this.questToggle.classList.toggle("is-panel-open", questOpen);
      shopToggle.classList.toggle("is-panel-open", shopOpen);
      this.panelScrim.classList.toggle("is-active", this.touchMode && (questOpen || shopOpen));
    };

    for (const tab of root.querySelectorAll<HTMLButtonElement>("[data-shop-tab]")) {
      bindImmediate(tab, () => this.setShopTab(tab.dataset.shopTab as ShopTab));
    }
    for (const button of this.towerDock.querySelectorAll<HTMLButtonElement>("[data-tower-dock]")) {
      bindImmediate(button, () => this.onTowerAction(button.dataset.towerDock as TowerId));
    }
    bindImmediate(this.weaponButton, () => this.onWeaponCycle());
    bindImmediate(this.worldActionButton, () => {
      if (!this.activeWorldAction) return;
      if (this.activeWorldAction.type === "tower") this.onTowerAction(this.activeWorldAction.id);
      else if (this.activeWorldAction.type === "employee") this.onShopAction("employee", this.activeWorldAction.id);
      else this.onShopAction("pasture", this.activeWorldAction.id);
    });

    for (const card of root.querySelectorAll<HTMLButtonElement>("[data-protagonist]")) {
      card.addEventListener("click", () => {
        this.selectedProtagonist = card.dataset.protagonist as ProtagonistId;
        for (const candidate of root.querySelectorAll<HTMLButtonElement>("[data-protagonist]")) {
          const selected = candidate === card;
          candidate.classList.toggle("is-selected", selected);
          candidate.setAttribute("aria-pressed", String(selected));
        }
        const definition = PROTAGONISTS.find((entry) => entry.id === this.selectedProtagonist)!;
        this.startButton.querySelector("span")!.textContent = `確認${definition.name}`;
      });
    }
    this.startButton.addEventListener("click", () => {
      if (this.requiresProtagonistSelection) this.onProtagonistSelect(this.selectedProtagonist);
      this.onStart();
    });
    this.attackButton.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.attackButton.setPointerCapture(event.pointerId);
      this.onAttackStart();
    });
    const stopAttack = (event: PointerEvent): void => {
      if (this.attackButton.hasPointerCapture(event.pointerId)) this.attackButton.releasePointerCapture(event.pointerId);
      this.attackButton.classList.remove("is-pressed");
      this.onAttackEnd();
    };
    this.attackButton.addEventListener("pointerup", stopAttack);
    this.attackButton.addEventListener("pointercancel", stopAttack);
    this.attackButton.addEventListener("contextmenu", (event) => event.preventDefault());
    bindImmediate(this.waveButton, () => this.onWave());
    get("result-button").addEventListener("click", () => location.reload());
    get("reset-button").addEventListener("click", () => this.onReset());
    bindImmediate(shopToggle, () => setOpenPanel(this.commandPanel.classList.contains("is-open") ? null : "shop"));
    bindImmediate(get<HTMLButtonElement>("shop-close"), () => setOpenPanel(null));
    bindImmediate(this.questToggle, () => setOpenPanel(this.questPanel.classList.contains("is-open") ? null : "quest"));
    bindImmediate(get<HTMLButtonElement>("quest-close"), () => setOpenPanel(null));
    this.panelScrim.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpenPanel(null);
    });
    this.commandPanel.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".shop-item");
      if (!button || button.disabled) return;
      this.onShopAction(button.dataset.category as ShopCategory, button.dataset.id ?? "");
    });
    for (const tab of root.querySelectorAll<HTMLButtonElement>("[data-system-tab]")) {
      bindImmediate(tab, () => this.setSystemTab(tab.dataset.systemTab as SystemTab));
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-quality]")) {
      bindImmediate(button, () => this.updateSettings({ quality: button.dataset.quality as PlayerSettings["quality"] }));
    }
    bindImmediate(this.settingsButton, () => this.setSystemMenuOpen(true));
    bindImmediate(get<HTMLButtonElement>("system-menu-close"), () => this.setSystemMenuOpen(false));
    bindImmediate(get<HTMLButtonElement>("resume-button"), () => this.setSystemMenuOpen(false));
    bindImmediate(this.muteButton, () => this.updateSettings({ muted: !this.settings.muted }));
    bindImmediate(this.shakeButton, () => this.updateSettings({ screenShake: !this.settings.screenShake }));
    bindImmediate(get<HTMLButtonElement>("reset-save-open"), () => {
      this.resetConfirm.hidden = false;
      get<HTMLButtonElement>("reset-save-cancel").focus();
    });
    bindImmediate(get<HTMLButtonElement>("reset-save-cancel"), () => {
      this.resetConfirm.hidden = true;
      get<HTMLButtonElement>("reset-save-open").focus();
    });
    bindImmediate(get<HTMLButtonElement>("reset-save-confirm"), () => this.onReset());
    const updateVolume = (key: "masterVolume" | "sfxVolume", input: HTMLInputElement): void => {
      this.updateSettings({ [key]: Number(input.value) / 100 });
    };
    this.masterVolume.addEventListener("input", () => updateVolume("masterVolume", this.masterVolume));
    this.sfxVolume.addEventListener("input", () => updateVolume("sfxVolume", this.sfxVolume));
    this.systemMenu.addEventListener("pointerdown", (event) => {
      if (event.target === this.systemMenu) this.setSystemMenuOpen(false);
    });
    window.addEventListener("keydown", (event) => this.handleSystemMenuKey(event));
    this.syncSettingsControls();
  }

  setLoading(progress: number, text: string): void {
    this.loadingBar.style.width = `${Math.round(progress * 100)}%`;
    this.loadingText.textContent = `${text} · ${Math.round(progress * 100)}%`;
  }

  markReady(): void {
    this.setLoading(1, "風雪已就緒");
    this.startButton.disabled = false;
    this.startButton.classList.add("is-ready");
  }

  enterGame(): void {
    this.intro.classList.add("is-leaving");
    window.setTimeout(() => this.intro.remove(), 900);
  }

  private setSystemMenuOpen(open: boolean): void {
    if (this.systemMenuOpen === open) return;
    this.systemMenuOpen = open;
    if (open) {
      this.focusBeforeMenu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.systemMenu.hidden = false;
      this.settingsButton.setAttribute("aria-expanded", "true");
      document.documentElement.classList.add("is-paused");
      this.onPauseChange(true);
      this.systemMenu.querySelector<HTMLButtonElement>("#resume-button")?.focus();
    } else {
      this.systemMenu.hidden = true;
      this.resetConfirm.hidden = true;
      this.settingsButton.setAttribute("aria-expanded", "false");
      document.documentElement.classList.remove("is-paused");
      this.onPauseChange(false);
      this.focusBeforeMenu?.focus();
    }
  }

  private handleSystemMenuKey(event: KeyboardEvent): void {
    if (event.code === "Escape") {
      event.preventDefault();
      this.setSystemMenuOpen(!this.systemMenuOpen);
      return;
    }
    if (!this.systemMenuOpen || event.code !== "Tab") return;
    const focusable = [...this.systemMenu.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")]
      .filter((element) => !element.closest<HTMLElement>("[hidden]") && element.getClientRects().length > 0);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private setSystemTab(tab: SystemTab): void {
    this.activeSystemTab = tab;
    for (const button of this.systemMenu.querySelectorAll<HTMLButtonElement>("[data-system-tab]")) {
      const active = button.dataset.systemTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const panel of this.systemMenu.querySelectorAll<HTMLElement>("[data-system-panel]")) {
      const active = panel.dataset.systemPanel === tab;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    }
  }

  private updateSettings(patch: Partial<PlayerSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.syncSettingsControls();
    this.onSettingsChange({ ...this.settings });
  }

  private syncSettingsControls(): void {
    this.masterVolume.value = String(Math.round(this.settings.masterVolume * 100));
    this.sfxVolume.value = String(Math.round(this.settings.sfxVolume * 100));
    this.masterVolumeValue.value = `${this.masterVolume.value}%`;
    this.sfxVolumeValue.value = `${this.sfxVolume.value}%`;
    this.muteButton.setAttribute("aria-checked", String(this.settings.muted));
    this.muteButton.querySelector("em")!.textContent = this.settings.muted ? "開啟" : "關閉";
    this.muteButton.classList.toggle("is-active", this.settings.muted);
    this.shakeButton.setAttribute("aria-checked", String(this.settings.screenShake));
    this.shakeButton.querySelector("em")!.textContent = this.settings.screenShake ? "開啟" : "關閉";
    this.shakeButton.classList.toggle("is-active", this.settings.screenShake);
    for (const button of this.systemMenu.querySelectorAll<HTMLButtonElement>("[data-quality]")) {
      const selected = button.dataset.quality === this.settings.quality;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }
    this.systemMenu.dataset.activeTab = this.activeSystemTab;
    this.systemMenu.dataset.quality = this.settings.quality;
    this.systemMenu.dataset.muted = String(this.settings.muted);
    this.systemMenu.dataset.screenShake = String(this.settings.screenShake);
  }

  showWorldAction(target: WorldActionTarget): void {
    this.activeWorldAction = target;
    this.worldAction.hidden = false;
    this.positionWorldAction(target.x, target.y);
  }

  hideWorldAction(): void {
    this.activeWorldAction = null;
    this.worldAction.hidden = true;
  }

  private positionWorldAction(x: number, y: number): void {
    this.worldAction.style.left = `${Math.round(x)}px`;
    this.worldAction.style.top = `${Math.round(y)}px`;

    const margin = 12;
    const rect = this.worldAction.getBoundingClientRect();
    let offsetX = 0;
    let offsetY = 0;
    if (rect.left < margin) offsetX = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) offsetX = window.innerWidth - margin - rect.right;
    if (rect.top < margin) offsetY = margin - rect.top;
    else if (rect.bottom > window.innerHeight - margin) offsetY = window.innerHeight - margin - rect.bottom;

    if (offsetX !== 0 || offsetY !== 0) {
      this.worldAction.style.left = `${Math.round(x + offsetX)}px`;
      this.worldAction.style.top = `${Math.round(y + offsetY)}px`;
    }
  }

  update(state: RuntimeState): void {
    this.money.textContent = state.money.toString();
    this.meat.textContent = `${state.carriedMeat} / 6`;
    this.stock.textContent = `${state.displayedMeat} / ${state.stallLevel * 6}`;
    this.wave.textContent = state.waveActive ? `夜襲 · ${state.wave + 1} / 30 · ${state.enemiesRemaining} 敵` : `黎明 · ${state.wave} / 30`;
    this.performance.textContent = `${state.quality}畫質 · ${Math.round(state.currentFps || 0)} FPS · ${state.drawCalls} DC`;
    const protagonist = PROTAGONISTS.find((entry) => entry.id === state.protagonistId)!;
    this.protagonistStatus.textContent = `${protagonist.name} · ${protagonist.passive}`;
    this.protagonistStatus.title = protagonist.passiveDescription;
    this.baseHealth.textContent = `${Math.max(0, Math.round(state.baseHealth))}%`;
    this.baseHealthFill.style.width = `${Math.max(0, state.baseHealth)}%`;
    const hasTower = Object.values(state.towers).some((level) => level > 0);
    this.waveButton.disabled = !hasTower || state.waveActive || state.wave >= 30;
    this.waveButton.innerHTML = !hasTower
      ? `<small>準備防守</small><b>至少建造一座塔</b>`
      : state.waveActive
        ? `<small>暴雪警報</small><b>第 ${state.wave + 1} 波交戰中</b>`
        : state.wave >= 30
          ? `<small>北境守住了</small><b>三十波戰役完成</b>`
          : `<small>敵情：${getWavePlan(state.wave + 1).forecast}</small><b>啟動第 ${state.wave + 1} 波 · ${getWavePlan(state.wave + 1).title}</b>`;
    this.attackIcon.className = `asset-icon asset-icon--weapon-${state.weapon} attack-button__icon`;
    this.attackButton.querySelector("small")!.textContent = state.weapon === "smg" ? "掃射" : state.weapon === "axe" ? "橫掃" : "揮砍";
    this.updateWeaponButton(state);
    this.updateTowerDock(state);
    this.updateWorldAction(state);
    this.updateQuest(state);
    this.updateShop(state);
    this.updateRegulars(state);
  }

  private setShopTab(tab: ShopTab): void {
    this.activeShopTab = tab;
    for (const button of this.commandPanel.querySelectorAll<HTMLButtonElement>("[data-shop-tab]")) {
      const active = button.dataset.shopTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
    for (const section of this.commandPanel.querySelectorAll<HTMLElement>("[data-shop-section]")) {
      const active = section.dataset.shopSection === tab;
      section.classList.toggle("is-active", active);
      section.hidden = !active;
    }
  }

  private unlockedWeapons(state: RuntimeState): WeaponId[] {
    return WEAPONS.map((weapon) => weapon.id).filter((id) => state.weapons[id]);
  }

  private updateWeaponButton(state: RuntimeState): void {
    const unlocked = this.unlockedWeapons(state);
    const current = WEAPONS.find((weapon) => weapon.id === state.weapon)!;
    const nextIndex = (unlocked.indexOf(state.weapon) + 1) % Math.max(1, unlocked.length);
    const next = WEAPONS.find((weapon) => weapon.id === unlocked[nextIndex]) ?? current;
    this.weaponIcon.className = `asset-icon asset-icon--weapon-${state.weapon} weapon-button__icon`;
    this.weaponButton.disabled = unlocked.length <= 1;
    this.weaponButton.dataset.weapon = state.weapon;
    this.weaponButton.dataset.nextWeapon = next.id;
    this.weaponButton.setAttribute("aria-label", unlocked.length <= 1 ? `目前武器：${current.name}` : `切換武器：${current.name} → ${next.name}`);
  }

  private towerActionState(state: RuntimeState, id: TowerId): ActionState {
    const definition = TOWERS.find((tower) => tower.id === id)!;
    const level = state.towers[id];
    const maxed = level >= 3;
    const unlockChapter = level === 0 ? SHOP_UNLOCK_CHAPTER.defenseShop : SHOP_UNLOCK_CHAPTER.towerUpgrade;
    const locked = !maxed && !hasCompletedChapter(state, unlockChapter);
    const cost = maxed ? 0 : towerCostForState(state, id, level);
    const shortfall = Math.max(0, cost - state.money);
    return {
      title: level > 0 ? `${definition.name} Lv.${level}` : definition.name,
      detail: maxed ? "塔基已滿級" : level === 0 ? definition.description : `${definition.description} · 升至 Lv.${level + 1}`,
      label: maxed
        ? "滿級"
        : locked
          ? `手冊 ${unlockChapter}`
          : shortfall > 0
            ? `缺 ✦ ${shortfall}`
            : level === 0 ? `建造 ✦ ${cost}` : `升級 ✦ ${cost}`,
      disabled: state.waveActive || maxed || locked || shortfall > 0,
      active: level > 0,
      locked,
      icon: `tower-${id}`,
    };
  }

  private employeeActionState(state: RuntimeState, id: EmployeeId): ActionState {
    const definition = EMPLOYEES.find((employee) => employee.id === id)!;
    const level = state.employees[id];
    const maxed = level >= 2;
    const unlockChapter = level === 0 ? SHOP_UNLOCK_CHAPTER.employeeShop : SHOP_UNLOCK_CHAPTER.employeeUpgrade;
    const locked = !maxed && !hasCompletedChapter(state, unlockChapter);
    const cost = maxed ? 0 : level === 0 ? definition.price : definition.upgradePrice ?? 0;
    const shortfall = Math.max(0, cost - state.money);
    return {
      title: level > 0 ? `${definition.name} Lv.${level}` : definition.name,
      detail: maxed ? definition.upgradeDescription ?? "已滿級" : level === 0 ? definition.description : `升至 Lv2：${definition.upgradeDescription}`,
      label: maxed
        ? "滿級"
        : locked
          ? `手冊 ${unlockChapter}`
          : shortfall > 0
            ? `缺 ✦ ${shortfall}`
            : level === 0 ? `雇用 ✦ ${cost}` : `升級 ✦ ${cost}`,
      disabled: state.waveActive || maxed || locked || shortfall > 0,
      active: level > 0,
      locked,
      icon: `skill-${id}`,
    };
  }

  private pastureActionState(state: RuntimeState): ActionState {
    const locked = !state.pasture2Unlocked && !hasCompletedChapter(state, SHOP_UNLOCK_CHAPTER.pasture2);
    const shortfall = Math.max(0, 260 - state.money);
    return {
      title: "牧場 2",
      detail: state.pasture2Unlocked ? "第二牧場已開放" : "點牧場圍欄炸開林線，解鎖強化牛",
      label: state.pasture2Unlocked
        ? "已開放"
        : locked
          ? `手冊 ${SHOP_UNLOCK_CHAPTER.pasture2}`
          : shortfall > 0
            ? `缺 ✦ ${shortfall}`
            : "擴張 ✦ 260",
      disabled: state.waveActive || state.pasture2Unlocked || locked || shortfall > 0,
      active: state.pasture2Unlocked,
      locked,
      icon: "skill-butcher",
    };
  }

  private applyActionState(button: HTMLButtonElement, action: ActionState): void {
    button.disabled = action.disabled;
    button.classList.toggle("is-owned", action.active);
    button.classList.toggle("is-locked", action.locked);
    button.dataset.actionState = action.locked ? "locked" : action.disabled ? "disabled" : action.active ? "active" : "ready";
    button.title = `${action.title} · ${action.detail}`;
  }

  private updateTowerDock(state: RuntimeState): void {
    for (const item of TOWERS) {
      const action = this.towerActionState(state, item.id);
      const button = this.towerDock.querySelector<HTMLButtonElement>(`[data-tower-dock="${item.id}"]`);
      const title = button?.querySelector<HTMLElement>("b");
      const status = button?.querySelector<HTMLElement>(`[data-tower-dock-status="${item.id}"]`);
      if (!button || !title || !status) continue;
      this.applyActionState(button, action);
      button.dataset.level = state.towers[item.id].toString();
      title.textContent = state.towers[item.id] > 0 ? `Lv.${state.towers[item.id]}` : item.name;
      status.textContent = action.label;
      button.setAttribute("aria-label", `${action.title}，${action.label}`);
    }
  }

  private updateWorldAction(state: RuntimeState): void {
    if (!this.activeWorldAction) return;
    const target = this.activeWorldAction;
    const action = target.type === "tower"
      ? this.towerActionState(state, target.id)
      : target.type === "employee"
        ? this.employeeActionState(state, target.id)
        : this.pastureActionState(state);
    this.worldAction.dataset.actionType = target.type;
    this.worldAction.dataset.actionId = target.id;
    this.worldActionIcon.className = `asset-icon asset-icon--${action.icon} world-action-popover__icon`;
    this.worldActionTitle.textContent = action.title;
    this.worldActionDetail.textContent = action.detail;
    this.worldActionPrice.textContent = action.label;
    this.applyActionState(this.worldActionButton, action);
    this.positionWorldAction(target.x, target.y);
  }

  private updateQuest(state: RuntimeState): void {
    const quest = currentMainQuest(state);
    if (quest) {
      if (this.renderedChapter !== 0 && this.renderedChapter !== quest.chapter) {
        this.questPanel.classList.remove("quest-slide");
        requestAnimationFrame(() => this.questPanel.classList.add("quest-slide"));
      }
      this.renderedChapter = quest.chapter;
      const progress = Math.min(quest.target, quest.progress(state));
      this.questChapter.textContent = `生存手冊 · ${String(quest.chapter).padStart(2, "0")} / ${MAIN_QUESTS.length}`;
      this.questTitle.textContent = quest.title;
      this.questLog.textContent = `「${quest.log}」`;
      this.questProgress.textContent = `${progress} / ${quest.target}`;
      this.questProgressFill.style.width = `${progress / quest.target * 100}%`;
      this.questReward.textContent = quest.rewardLabel;
      this.questToggle.textContent = `手冊 ${String(quest.chapter).padStart(2, "0")} · ${progress}/${quest.target}`;
    } else {
      this.questChapter.textContent = "生存手冊 · 完成 ✓";
      this.questTitle.textContent = "北境守望者";
      this.questLog.textContent = "「第三十次鐘聲已有回音。這片封鎖區不再只有死人。」";
      this.questProgress.textContent = "15 / 15";
      this.questProgressFill.style.width = "100%";
      this.questReward.textContent = "全章完成";
      this.questToggle.textContent = "手冊 · 全章完成 ✓";
    }
    const loop = state.quest.loop;
    const definition = currentLoopDefinition(state);
    this.loopQuest.hidden = !state.waveActive || !loop || !definition;
    if (state.waveActive && loop && definition) {
      this.loopTitle.textContent = loop.completed ? `✓ ${definition.title}` : definition.title;
      this.loopCopy.textContent = `${definition.description} · 獎勵 ✦ ${loop.reward}`;
      this.loopProgress.textContent = `${loop.progress} / ${loop.target}`;
      this.loopProgressFill.style.width = `${Math.min(1, loop.progress / loop.target) * 100}%`;
      this.loopQuest.classList.toggle("is-complete", loop.completed);
    }
  }

  private updateShop(state: RuntimeState): void {
    const set = (key: string, text: string, disabled: boolean, active = false, lockText?: string): void => {
      const label = this.commandPanel.querySelector<HTMLElement>(`[data-price="${key}"]`);
      const button = label?.closest<HTMLButtonElement>(".shop-item");
      if (!label || !button) return;
      label.textContent = lockText ?? text;
      button.disabled = disabled || Boolean(lockText);
      button.classList.toggle("is-owned", active);
      button.classList.toggle("is-locked", Boolean(lockText));
    };
    for (const item of WEAPONS) {
      const owned = state.weapons[item.id];
      const equipped = state.weapon === item.id;
      const unlockChapter = item.id === "axe" ? SHOP_UNLOCK_CHAPTER.axe : item.id === "smg" ? SHOP_UNLOCK_CHAPTER.smg : 0;
      const chapterLock = !owned && unlockChapter > 0 && !hasCompletedChapter(state, unlockChapter)
        ? `🔒 完成手冊第 ${unlockChapter} 章解鎖`
        : undefined;
      const chainLock = !owned && item.id === "smg" && !state.weapons.axe && !chapterLock ? "🔒 需先購買迴旋斧" : undefined;
      set(`weapon-${item.id}`, equipped ? "使用中" : owned ? "已解鎖" : `購買 ✦ ${item.price}`, equipped || owned || state.money < item.price || state.waveActive, equipped, chapterLock ?? chainLock);
    }
    for (const item of EMPLOYEES) {
      const id = item.id as EmployeeId;
      const level = state.employees[id];
      const price = level === 0 ? item.price : item.upgradePrice ?? 0;
      const lockChapter = level === 0 ? SHOP_UNLOCK_CHAPTER.employeeShop : SHOP_UNLOCK_CHAPTER.employeeUpgrade;
      const lock = level < 2 && !hasCompletedChapter(state, lockChapter) ? `🔒 完成手冊第 ${lockChapter} 章解鎖` : undefined;
      const text = level === 0 ? `雇用 · ✦ ${price}` : level === 1 ? `升級 Lv2 · ✦ ${price}` : "已滿級 Lv2";
      const description = this.commandPanel.querySelector<HTMLElement>(`[data-description="employee-${id}"]`);
      if (description) description.textContent = level === 0 ? item.description : level === 1 ? `升至 Lv2：${item.upgradeDescription}` : `Lv2 · ${item.upgradeDescription}`;
      set(`employee-${id}`, text, level >= 2 || state.money < price || state.waveActive, level > 0, lock);
    }
    const pastureLock = !state.pasture2Unlocked && !hasCompletedChapter(state, SHOP_UNLOCK_CHAPTER.pasture2) ? `🔒 完成手冊第 ${SHOP_UNLOCK_CHAPTER.pasture2} 章解鎖` : undefined;
    set("pasture-pasture2", state.pasture2Unlocked ? "已開放" : "✦ 260", state.pasture2Unlocked || state.money < 260 || state.waveActive, state.pasture2Unlocked, pastureLock);
  }

  private updateRegulars(state: RuntimeState): void {
    for (const customer of NAMED_CUSTOMERS) {
      const affinity = state.customerAffinity[customer.id];
      const row = this.commandPanel.querySelector<HTMLElement>(`[data-regular="${customer.id}"]`);
      const fill = row?.querySelector<HTMLElement>("span > i");
      const value = row?.querySelector<HTMLElement>("span > em");
      if (!row || !fill || !value) continue;
      fill.style.width = `${affinity * 10}%`;
      value.textContent = `${affinity} / 10`;
      row.classList.toggle("is-regular", affinity >= 6);
      row.title = affinity >= 6 ? customer.affinityBonus : `好感 6 解鎖：${customer.affinityBonus}`;
    }
  }

  completeQuest(completion: QuestCompletion): void {
    this.questPanel.classList.remove("quest-complete");
    requestAnimationFrame(() => this.questPanel.classList.add("quest-complete"));
    this.toast(`手冊 ${String(completion.chapter).padStart(2, "0")} 完成 · ${completion.reward}`, "warm");
    window.setTimeout(() => this.questPanel.classList.remove("quest-complete"), 760);
  }

  setPrompt(key: string, text: string, visible = true): void {
    this.prompt.innerHTML = `<kbd>${key}</kbd><span>${text}</span>`;
    this.prompt.classList.toggle("is-visible", visible);
  }

  toast(message: string, tone: "warm" | "danger" | "ice" = "warm"): void {
    const toast = document.createElement("div");
    toast.className = `toast toast--${tone}`;
    const dot = document.createElement("i");
    const copy = document.createElement("span");
    copy.textContent = message;
    toast.append(dot, copy);
    this.toastHost.append(toast);
    window.setTimeout(() => toast.classList.add("is-out"), 2400);
    window.setTimeout(() => toast.remove(), 2900);
  }

  showResult(won: boolean, copy: string, stats: ReadonlyArray<[string, string]> = []): void {
    this.result.hidden = false;
    this.resultTitle.textContent = won ? "黎明仍在" : "最後的燈熄了";
    this.resultCopy.textContent = copy;
    this.resultStats.replaceChildren(...stats.map(([label, value]) => {
      const item = document.createElement("div");
      const small = document.createElement("small");
      const strong = document.createElement("b");
      small.textContent = label;
      strong.textContent = value;
      item.append(small, strong);
      return item;
    }));
    requestAnimationFrame(() => this.result.classList.add("is-visible"));
  }

}
