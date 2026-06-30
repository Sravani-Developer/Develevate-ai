import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

type JsonValue = Record<string, unknown>;

@Injectable()
export class AiService {
  private readonly client?: OpenAI;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>("OPENAI_API_KEY");
    this.client = apiKey ? new OpenAI({ apiKey }) : undefined;
  }

  async generateJson<T extends JsonValue>(system: string, user: string, fallback: T): Promise<T> {
    if (!this.client) return fallback;
    const response = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });
    const content = response.choices[0]?.message.content;
    return content ? (JSON.parse(content) as T) : fallback;
  }

  async *streamEvaluation(prompt: string) {
    if (!this.client) {
      yield "AI key is not configured. Add OPENAI_API_KEY to enable streaming evaluation.";
      return;
    }
    const stream = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      messages: [{ role: "user", content: prompt }]
    });
    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta.content;
      if (token) yield token;
    }
  }
}
