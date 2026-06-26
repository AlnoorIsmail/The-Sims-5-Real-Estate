import type { RawPerception } from "@/lib/sim/types";
import type { SimEvent, SimTickState } from "@/lib/sim/types";
import type {
  AgentContextBundle,
  GameMasterEventCard,
  PerceptionDigestOutput,
} from "../types";
import type { HarnessToolDefinition } from "../llm/language-model";

export function assembleDecideActionPrompt(
  context: AgentContextBundle,
  tools: HarnessToolDefinition[]
): string {
  const identity = context.identity;
  const displayName =
    "displayName" in identity ? identity.displayName : identity.agentId;
  const persona = "persona" in identity ? identity.persona : null;

  const toolSummaries = tools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  return [
    context.systemRules,
    "",
    `You are ${displayName}, a resident in a synthetic apartment building simulator.`,
  persona
    ? `Persona: ${persona.temperament}, ${persona.economicPressure}, ${persona.socialStyle}.`
    : "",
    "",
    `Day ${context.visibleWorld.day} (${context.visibleWorld.dayPhase}).`,
    `You are at: ${context.visibleWorld.currentLocationLabel}.`,
    `Movement: ${context.visibleWorld.movementSummary ?? "idle"}.`,
    `Lifecycle: ${context.visibleWorld.lifecycleState}. Rent: ${context.visibleWorld.rentAccountState}.`,
    "",
    `Current goal: ${context.visibleWorld.goals.currentGoal}`,
    context.visibleWorld.goals.obligations.length
      ? `Obligations: ${context.visibleWorld.goals.obligations.join("; ")}`
      : "",
    context.visibleWorld.goals.fears.length
      ? `Fears: ${context.visibleWorld.goals.fears.join("; ")}`
      : "",
    "",
    "Mood and needs:",
    `mood ${context.visibleWorld.behavior.mood}, stress ${context.visibleWorld.behavior.stress}, sociability ${context.visibleWorld.behavior.sociability}.`,
    "",
    context.retrievedMemories.length
      ? `Memories:\n${context.retrievedMemories.map((m) => `- ${m.document}`).join("\n")}`
      : "No strong memories retrieved.",
    "",
    context.reflections.length
      ? `Reflections:\n${context.reflections.map((m) => `- ${m.document}`).join("\n")}`
      : "",
    "",
    context.recentLocalEvents.length
      ? `Recent events:\n${context.recentLocalEvents.map((e) => `- ${e.summary}`).join("\n")}`
      : "",
    "",
    context.budgetSummary
      ? `Landlord budget context (only if paying rent or requesting costly help): AED ${context.budgetSummary.budgetAed}.`
      : "",
    "",
    "Available tools (use exactly one):",
    toolSummaries,
    "",
    "Call one tool to act. For speech, use say_to with your spoken message.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function assembleDigestPrompt(
  context: AgentContextBundle,
  rawQueue: RawPerception[]
): string {
  const displayName =
    "displayName" in context.identity
      ? context.identity.displayName
      : context.identity.agentId;

  const numbered = rawQueue
    .map((p, i) => `[${i + 1}] ${p.text}`)
    .join("\n");

  return [
    `You are ${displayName}. Interpret what you noticed in your own words.`,
    `Location: ${context.visibleWorld.currentLocationLabel}.`,
    "",
    "For each numbered perception below, write one short subjective sentence.",
    "Format each line as: [N] your interpretation",
    "",
    numbered,
  ].join("\n");
}

export function mapDigestTextToPerceptions(
  prose: string,
  rawQueue: RawPerception[]
): PerceptionDigestOutput {
  const digests: PerceptionDigestOutput["digests"] = [];
  const lines = prose.split("\n").map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < rawQueue.length; i += 1) {
    const index = i + 1;
    const pattern = new RegExp(`^\\[${index}\\]\\s*(.+)$`);
    const matched = lines.find((line) => pattern.test(line));
    const note = matched
      ? matched.replace(pattern, "$1").trim()
      : lines[i]?.replace(/^\[\d+\]\s*/, "").trim() ??
        `I noticed: ${rawQueue[i].text}`;

    digests.push({
      rawPerceptionId: rawQueue[i].id,
      subjectiveNote: note,
    });
  }

  return { digests };
}

export function assembleReflectionPrompt(context: AgentContextBundle): string {
  const displayName =
    "displayName" in context.identity
      ? context.identity.displayName
      : context.identity.agentId;

  return [
    `You are ${displayName}. Write a short private reflection on recent events.`,
    "Plain prose only, 2-4 sentences. No JSON, no lists of IDs.",
    "",
    `Goal: ${context.visibleWorld.goals.currentGoal}`,
    `Recent events: ${context.recentLocalEvents.map((e) => e.summary).join("; ") || "quiet day"}`,
    `Memories: ${context.retrievedMemories.map((m) => m.document).join("; ") || "none"}`,
  ].join("\n");
}

export function assembleMorningBriefPrompt(
  state: SimTickState,
  card: GameMasterEventCard
): string {
  return [
    "Write a short morning brief for residents of a synthetic Abu Dhabi apartment building.",
    "Tone: professional property-management simulator with light PG-13 dark comedy.",
    "Do not present synthetic data as real market data.",
    "",
    `Day: ${state.day}`,
    `Event: ${card.publicText}`,
    `Context: ${card.privateContext}`,
    "",
    "Return 2-3 sentences of in-world briefing text only.",
  ].join("\n");
}

export function assembleDaySummaryPrompt(
  state: SimTickState,
  events: SimEvent[]
): string {
  return [
    "Write a short end-of-day summary for the landlord dashboard.",
    "Tone: professional, legible consequences.",
    "",
    `Day: ${state.day}`,
    `Budget AED: ${state.landlord.budgetAed}`,
    `Events (${events.length}):`,
    ...events.slice(-12).map((e) => `- ${e.summary}`),
    "",
    "Return 2-4 sentences only.",
  ].join("\n");
}
