import { LOOP_QUESTS, MAIN_QUESTS, type LoopQuestDefinition, type MainQuestDefinition } from "./content";
import { saveState, type RuntimeState } from "./state";

export interface QuestCompletion {
  chapter: number;
  title: string;
  reward: string;
}

export function currentMainQuest(state: RuntimeState): MainQuestDefinition | undefined {
  return MAIN_QUESTS.find((quest) => quest.chapter === state.quest.chapter);
}

export function updateMainQuests(state: RuntimeState): QuestCompletion[] {
  const completions: QuestCompletion[] = [];
  let quest = currentMainQuest(state);
  while (quest && quest.progress(state) >= quest.target) {
    state.money += quest.rewardGold;
    if (!state.quest.completed.includes(quest.chapter)) state.quest.completed.push(quest.chapter);
    if (quest.rewardUnlock && !state.quest.unlocks.includes(quest.rewardUnlock)) state.quest.unlocks.push(quest.rewardUnlock);
    completions.push({ chapter: quest.chapter, title: quest.title, reward: quest.rewardLabel });
    state.quest.chapter = quest.chapter + 1;
    if (quest.rewardUnlock === "repair") state.baseHealth = 100;
    quest = currentMainQuest(state);
  }
  if (completions.length > 0) saveState(state);
  return completions;
}

export function assignLoopQuest(state: RuntimeState, wave: number): void {
  if (state.quest.loop?.wave === wave) return;
  const available = LOOP_QUESTS.filter((quest) => quest.available(state));
  const quest = available[(wave - 1) % available.length] ?? LOOP_QUESTS[0];
  const target = Math.min(quest.target(wave), quest.id.includes("kills") ? 5 + wave * 2 : Number.MAX_SAFE_INTEGER);
  state.quest.loop = {
    id: quest.id,
    wave,
    progress: 0,
    target,
    reward: 20 + wave * (quest.id === "player-kills" || quest.id === "tower-kills" ? 3 : 2),
    completed: false,
    claimed: false,
  };
  saveState(state);
}

export function currentLoopDefinition(state: RuntimeState): LoopQuestDefinition | undefined {
  return LOOP_QUESTS.find((quest) => quest.id === state.quest.loop?.id);
}

export function addLoopProgress(state: RuntimeState, id: string, amount = 1): boolean {
  const loop = state.quest.loop;
  if (!loop || loop.id !== id || loop.completed || loop.wave !== state.wave + 1) return false;
  loop.progress = Math.min(loop.target, loop.progress + amount);
  if (loop.progress < loop.target) return false;
  loop.completed = true;
  if (!loop.claimed) {
    loop.claimed = true;
    state.money += loop.reward;
  }
  saveState(state);
  return true;
}
