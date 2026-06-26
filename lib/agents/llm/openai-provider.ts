import OpenAI from "openai";
import type {
  HarnessToolCall,
  HarnessToolDefinition,
  LanguageModel,
} from "./language-model";

export interface OpenAiLanguageModelOptions {
  apiKey: string;
  model?: string;
}

export class OpenAiLanguageModel implements LanguageModel {
  private client: OpenAI;
  private model: string;

  constructor(options: OpenAiLanguageModelOptions) {
    if (!options.apiKey) {
      throw new Error("OpenAiLanguageModel requires an apiKey.");
    }
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? "gpt-4o-mini";
  }

  async completeText(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: "You write concise in-world simulation narration. Plain text only.",
        },
        { role: "user", content: prompt },
      ],
    });
    return (response.choices[0]?.message?.content ?? "").trim();
  }

  async completeWithTools(
    prompt: string,
    tools: HarnessToolDefinition[]
  ): Promise<HarnessToolCall | null> {
    const openAiTools = tools.map((tool) => ({
      type: "function" as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a simulation resident. Call exactly one tool to act this turn.",
        },
        { role: "user", content: prompt },
      ],
      tools: openAiTools,
      tool_choice: "required",
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") return null;

    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch {
      return null;
    }

    return { name: toolCall.function.name, args };
  }
}
