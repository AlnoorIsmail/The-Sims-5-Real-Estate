/** Provider-neutral tool schema built deterministically by the harness. */
export interface HarnessToolParameter {
  type: "string" | "boolean" | "number";
  description?: string;
  enum?: string[];
}

export interface HarnessToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, HarnessToolParameter>;
    required: string[];
  };
}

/** Native tool call returned by the LLM; routing is harness-owned. */
export interface HarnessToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Thin language-machine seam. The harness owns IDs, routing, and memory metadata.
 */
export interface LanguageModel {
  completeText(prompt: string): Promise<string>;
  completeWithTools(
    prompt: string,
    tools: HarnessToolDefinition[]
  ): Promise<HarnessToolCall | null>;
}
