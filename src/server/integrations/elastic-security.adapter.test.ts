import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initializeSecuritySchema } from "../db/security-schema";
import { securityFixture } from "../seed/security-fixture";
import { ElasticSecurityAdapter, fromElasticSecurityDocument, toElasticSecurityDocument } from "./elastic-security.adapter";
import { createSecurityEventSource } from "./security-event-source.factory";
import { SqliteSecurityEventAdapter } from "./sqlite-security-event.adapter";

describe("ElasticSecurityAdapter", () => {
  let db: Database.Database | undefined;
  afterEach(() => db?.close());
  it("maps deterministic event documents in both directions", () => {
    const event = securityFixture.events[1], document = toElasticSecurityDocument(event);
    expect(document).toMatchObject({ eventId: "EVT-1002", subjectId: "INC-1001", timestamp: event.occurredAt });
    expect(fromElasticSecurityDocument(document)).toEqual(event);
  });
  it("constructs authenticated upsert and search requests without putting the secret in URLs or bodies", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => new Response(
      init?.method === "POST" ? JSON.stringify({ hits: { hits: [] } }) : "{}", { status: 200 }));
    db = new Database(":memory:"); initializeSecuritySchema(db);
    const adapter = new ElasticSecurityAdapter("https://elastic.example/", "secret-key",
      new SqliteSecurityEventAdapter(db), fetcher as typeof fetch);
    await adapter.indexSecurityEvent(securityFixture.events[0]);
    await adapter.indexSecurityEvent(securityFixture.events[0]);
    await adapter.searchEvents({ subjectType: "INCIDENT", subjectId: "INC-1001" });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toContain("bubblesurface-security-events/_doc/EVT-1001");
    expect(String(url)).not.toContain("secret-key");
    expect((init?.headers as Record<string, string>).authorization).toBe("ApiKey secret-key");
    expect(String(init?.body)).not.toContain("secret-key");
    expect(String(fetcher.mock.calls[1][0])).toBe(String(url));
  });
  it("falls back to SQLite when Elastic is not selected", () => {
    db = new Database(":memory:"); initializeSecuritySchema(db);
    expect(createSecurityEventSource(db, { SECURITY_EVENT_SOURCE: "sqlite", OPENAI_MODEL: "gpt-5.4", IDENTITY_PROVIDER: "demo" }))
      .toBeInstanceOf(SqliteSecurityEventAdapter);
  });
});
