import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type {
  HarnessToolCall,
  HarnessToolDefinition,
  LanguageModel,
} from "./language-model";

export interface GeminiLanguageModelOptions {
  apiKey: string;
  model?: string;
}

export class GeminiLanguageModel implements LanguageModel {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(options: GeminiLanguageModelOptions) {
    if (!options.apiKey) {
      throw new Error("GeminiLanguageModel requires an apiKey.");
    }
    this.client = new GoogleGenerativeAI(options.apiKey);
    this.model = options.model ?? "gemini-2.0-flash";
  }

  async completeText(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: { temperature: 0.6 },
    });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  }

  async completeWithTools(
    prompt: string,
    tools: HarnessToolDefinition[]
  ): Promise<HarnessToolCall | null> {
    const declarations = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: toGeminiSchema(tool),
    }));

    const model = this.client.getGenerativeModel({
      model: this.model,
      tools: [{ functionDeclarations: declarations as never }],
      generationConfig: { temperature: 0.4 },
    });

    const result = await model.generateContent(prompt);
    const call = result.response.functionCalls()?.[0];
    if (!call) return null;

    return {
      name: call.name,
      args: (call.args ?? {}) as Record<string, unknown>,
    };
  }
}

function toGeminiSchema(tool: HarnessToolDefinition): object {
  const properties: Record<string, object> = {};

  for (const [key, param] of Object.entries(tool.parameters.properties)) {
    const prop: Record<string, unknown> = {
      type:
        param.type === "number"
          ? SchemaType.NUMBER
          : param.type === "boolean"
            ? SchemaType.BOOLEAN
            : SchemaType.STRING,
    };
    if (param.description) prop.description = param.description;
    if (param.enum) prop.enum = param.enum;
    properties[key] = prop;
  }

  return {
    type: SchemaType.OBJECT,
    properties,
    required: tool.parameters.required,
  };
}
