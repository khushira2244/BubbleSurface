export interface ReasoningModelResponse {
  model: string; outputText: string; usage: Record<string, unknown> | null;
}
export interface ReasoningModelClient {
  createStructuredResponse(input: { instructions: string; context: unknown; schema: Record<string, unknown> }): Promise<ReasoningModelResponse>;
}

export class OpenAiResponsesApiError extends Error {
  readonly name = "OpenAiResponsesApiError";
  constructor(readonly upstreamStatus: number, readonly openAiCode: string | null,
    readonly openAiType: string | null, readonly upstreamMessage: string,
    readonly requestId: string | null) {
    super(`OpenAI Responses API returned HTTP ${upstreamStatus}.`);
  }
}

interface OpenAiErrorBody {
  error?: { code?: unknown; type?: unknown; message?: unknown };
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 2_000) : null;
}

export function toOpenAiStructuredOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toOpenAiStructuredOutputSchema);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).map(([key, child]) =>
    [key === "oneOf" ? "anyOf" : key, toOpenAiStructuredOutputSchema(child)] as const);
  return Object.fromEntries(entries);
}

export class OpenAiResponsesClient implements ReasoningModelClient {
  constructor(private readonly apiKey: string, private readonly model: string,
    private readonly timeoutMs = 30_000, private readonly fetcher: typeof fetch = fetch) {}
  async createStructuredResponse(input: { instructions: string; context: unknown; schema: Record<string, unknown> }): Promise<ReasoningModelResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher("https://api.openai.com/v1/responses", {
        method: "POST", signal: controller.signal,
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, store: false, instructions: input.instructions,
          input: JSON.stringify(input.context), text: { format: {
            type: "json_schema", name: "security_reasoning_assessment", strict: true,
            schema: toOpenAiStructuredOutputSchema(input.schema),
          } } }),
      });
      if (!response.ok) {
        let errorBody: OpenAiErrorBody = {};
        try { errorBody = await response.json() as OpenAiErrorBody; } catch { /* Non-JSON upstream error. */ }
        const requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id");
        const upstreamError = new OpenAiResponsesApiError(response.status, safeString(errorBody.error?.code),
          safeString(errorBody.error?.type), safeString(errorBody.error?.message) ?? "OpenAI returned an unspecified error.",
          requestId);
        if (process.env.NODE_ENV !== "production") {
          console.error("OpenAI Responses API request failed", {
            upstreamStatus: upstreamError.upstreamStatus,
            openAiCode: upstreamError.openAiCode,
            openAiType: upstreamError.openAiType,
            openAiMessage: upstreamError.upstreamMessage,
            requestId: upstreamError.requestId,
          });
        }
        throw upstreamError;
      }
      const body = await response.json() as Record<string, unknown>;
      const output = Array.isArray(body.output) ? body.output : [];
      const text = output.flatMap((item) => typeof item === "object" && item !== null && Array.isArray((item as { content?: unknown }).content)
        ? (item as { content: unknown[] }).content : []).find((part) => typeof part === "object" && part !== null
          && (part as { type?: string }).type === "output_text") as { text?: unknown } | undefined;
      if (typeof text?.text !== "string") throw new Error("Missing output text");
      return { model: typeof body.model === "string" ? body.model : this.model, outputText: text.text,
        usage: typeof body.usage === "object" && body.usage !== null ? body.usage as Record<string, unknown> : null };
    } finally { clearTimeout(timeout); }
  }
}
