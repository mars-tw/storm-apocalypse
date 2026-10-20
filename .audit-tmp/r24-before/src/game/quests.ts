import { LOOP_QUESTS, MAIN_QUESTS, type LoopQuestContext, type LoopQuestDefinition, type MainQuestDefinition } from "./content";
import { creditIncome, saveState, type RuntimeState } from "./state";

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
    const firstCompletion = !state.quest.completed.includes(quest.chapter);
    if (firstCompletion) {
      creditIncome(state, quest.rewardGold);
      state.quest.completed.push(quest.chapter);
      completions.push({ chapter: quest.chapter, title: quest.title, reward: quest.rewardLabel });
    }
    if (quest.rewardUnlock && !state.quest.unlocks.includes(quest.rewardUnlock)) state.quest.unlocks.push(quest.rewardUnlock);
    state.quest.chapter = quest.chapter + 1;
    if (quest.rewardUnlock === "repair") state.baseHealth = 100;
    quest = currentMainQuest(state);
  }
  if (completions.length > 0) saveState(state);
  return completions;
}

export function assignLoopQuest(state: RuntimeState, context: LoopQuestContext): void {
  const wave = context.wave;
  const existing = state.quest.loop;
  const existingDefinition = LOOP_QUESTS.find((quest) => quest.id === existing?.id);
  if (existing?.wave === wave && (existing.claimed || existingDefinition?.available(state, context))) return;
  const rotationStart = (wave - 1) % LOOP_QUESTS.length;
  const quest = Array.from({ length: LOOP_QUESTS.length }, (_, offset) => LOOP_QUESTS[(rotationStart + offset) % LOOP_QUESTS.length])
    .find((candidate) => candidate.available(state, context)) ?? LOOP_QUESTS[2];
  const target = Math.min(quest.target(wave), quest.id.includes("kills") ? context.enemyCount : Number.MAX_SAFE_INTEGER);
  state.quest.loop = {
    id: quest.id,
    wave,
    progress: 0,
    target,
    reward: quest.rewardBase + wave * quest.rewardPerWave,
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
    creditIncome(state, loop.reward);
  }
  saveState(state);
  return true;
}
