import type { CharacterLlmConfig, HarnessConfig, LlmBackend } from "../types";
import { GeminiLanguageModel } from "./gemini-provider";
import type { LanguageModel } from "./language-model";
import { OpenAiLanguageModel } from "./openai-provider";

export class UnconfiguredLanguageModel implements LanguageModel {
  async completeText(): Promise<string> {
    throw new Error("Language model not configured. Pass an apiKey or enable mockMode.");
  }
  async completeWithTools(): Promise<null> {
    throw new Error("Language model not configured. Pass an apiKey or enable mockMode.");
  }
}

export function createLanguageModelFromConfig(
  llmConfig: CharacterLlmConfig | undefined,
  harnessConfig: HarnessConfig
): LanguageModel {
  if (!llmConfig?.apiKey) {
    return new UnconfiguredLanguageModel();
  }

  const backend: LlmBackend = llmConfig.backend ?? "gemini";

  if (backend === "openai") {
    return new OpenAiLanguageModel({
      apiKey: llmConfig.apiKey,
      model: llmConfig.model ?? harnessConfig.openaiModel,
    });
  }

  return new GeminiLanguageModel({
    apiKey: llmConfig.apiKey,
    model: llmConfig.model ?? harnessConfig.geminiModel,
  });
}

export function resolveCharacterLlmFromEnv(agentId: string): CharacterLlmConfig | undefined {
  const suffix = agentId.toUpperCase().replace(/-/g, "_");

  const geminiKey =
    process.env[`GEMINI_API_KEY_${suffix}`] ?? process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return { apiKey: geminiKey, backend: "gemini" };
  }

  const openaiKey =
    process.env[`OPENAI_API_KEY_${suffix}`] ?? process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return { apiKey: openaiKey, backend: "openai" };
  }

  return undefined;
}

export function resolveGameMasterLlmFromEnv(): CharacterLlmConfig | undefined {
  const geminiKey =
    process.env.GEMINI_API_KEY_GAME_MASTER ?? process.env.GEMINI_API_KEY;
  if (geminiKey) {
    return { apiKey: geminiKey, backend: "gemini" };
  }

  const openaiKey =
    process.env.OPENAI_API_KEY_GAME_MASTER ?? process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return { apiKey: openaiKey, backend: "openai" };
  }

  return undefined;
}

export function mergeCharacterLlmConfig(
  agentId: string,
  identityLlm: CharacterLlmConfig | undefined,
  explicit?: CharacterLlmConfig
): CharacterLlmConfig | undefined {
  return explicit ?? identityLlm ?? resolveCharacterLlmFromEnv(agentId);
}
