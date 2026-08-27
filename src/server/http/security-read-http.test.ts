import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSecuritySchema } from "../db/security-schema";
import { SecurityContextService } from "../domain/security/security-context.service";
import { SqliteSecurityContextRepository } from "../repositories/sqlite-security-context.repository";
import { seedSecurityData } from "../seed/seed-security-data";
import { readFindingContext, readIdentityPrivileges, readIdentitySessions, readIncidentContext } from "./security-read-http";

const request = new Request("http://localhost/api/test");
const context = (id: string) => ({ params: Promise.resolve({ id }) });

describe("security read HTTP handlers", () => {
  let db: Database.Database;
  let service: SecurityContextService;
  beforeEach(() => {
    db = new Database(":memory:"); initializeSecuritySchema(db); seedSecurityData(db);
    service = new SecurityContextService(new SqliteSecurityContextRepository(db));
  });
  afterEach(() => db.close());

  it("returns the primary incident investigation context", async () => {
    const response = await readIncidentContext(service)(request, context("INC-1001"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.identity.displayName).toBe("Asha Mehta");
    expect(body.data.events).toHaveLength(7);
    expect(body.data.devices[1].trustStatus).toBe("UNKNOWN");
  });

  it("returns the vulnerability finding context", async () => {
    const response = await readFindingContext(service)(request, context("FIND-2001"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.vulnerability.cwe).toBe("CWE-89");
    expect(body.data.evidence).toHaveLength(2);
  });

  it("returns active sessions and privileges independently", async () => {
    const sessions = await (await readIdentitySessions(service)(request, context("IDN-ASHA"))).json();
    const privileges = await (await readIdentityPrivileges(service)(request, context("IDN-ASHA"))).json();
    expect(sessions.data).toHaveLength(2);
    expect(privileges.data.map((item: { name: string }) => item.name)).toEqual(["standard-employee", "finance-admin"]);
  });

  it("returns a typed 404 for a missing subject", async () => {
    const response = await readIncidentContext(service)(request, context("INC-9999"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: {
      code: "SECURITY_CONTEXT_NOT_FOUND", message: "Incident INC-9999 was not found.",
    } });
  });
});
