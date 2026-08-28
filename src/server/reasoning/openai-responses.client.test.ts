import { describe, expect, it, vi } from "vitest";
import { OpenAiResponsesApiError, OpenAiResponsesClient } from "./openai-responses.client";

describe("OpenAiResponsesClient", () => {
  it("uses the current Responses structured-output contract", async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ model: "gpt-5.6-sol", usage: {}, output: [{
      type: "message", content: [{ type: "output_text", text: "{}" }],
    }] }), { status: 200 }));
    const client = new OpenAiResponsesClient("test-secret", "gpt-5.6", 1_000, fetcher as typeof fetch);
    await client.createStructuredResponse({ instructions: "safe instructions", context: { incident: "redacted" },
      schema: { type: "object", properties: { action: { oneOf: [{ const: "A" }, { const: "B" }] } },
        additionalProperties: false } });
    const [url, init] = fetcher.mock.calls[0];
    const payload = JSON.parse(String(init?.body));
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(payload).toMatchObject({ model: "gpt-5.6", store: false, text: { format: {
      type: "json_schema", name: "security_reasoning_assessment", strict: true,
      schema: { type: "object", properties: { action: { anyOf: [{ const: "A" }, { const: "B" }] } },
        additionalProperties: false },
    } } });
    expect(JSON.stringify(payload.text.format.schema)).not.toContain("oneOf");
    expect(payload).not.toHaveProperty("response_format");
  });

  it("extracts safe upstream diagnostics without exposing credentials publicly", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetcher = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ error: {
      code: "invalid_request_error", type: "invalid_request_error", message: "Invalid schema.",
    } }), { status: 400, headers: { "x-request-id": "req_test_123" } }));
    const client = new OpenAiResponsesClient("do-not-log-this-key", "gpt-5.6", 1_000, fetcher as typeof fetch);
    const failure = await client.createStructuredResponse({ instructions: "safe", context: {}, schema: {} })
      .catch((error: unknown) => error);
    expect(failure).toMatchObject<Partial<OpenAiResponsesApiError>>({ upstreamStatus: 400,
      openAiCode: "invalid_request_error", openAiType: "invalid_request_error",
      upstreamMessage: "Invalid schema.", requestId: "req_test_123" });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("do-not-log-this-key");
    logger.mockRestore();
  });
});
