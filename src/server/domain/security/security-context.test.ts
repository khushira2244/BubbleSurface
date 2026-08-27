import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initializeSecuritySchema } from "../../db/security-schema";
import { SqliteSecurityContextRepository } from "../../repositories/sqlite-security-context.repository";
import { seedSecurityData } from "../../seed/seed-security-data";
import { securityFixture } from "../../seed/security-fixture";
import { FixtureRelationshipError, validateSecurityFixture } from "./fixture-validator";
import { SecurityContextService } from "./security-context.service";

describe("security context foundation", () => {
  let db: Database.Database;
  let service: SecurityContextService;

  beforeEach(() => {
    db = new Database(":memory:");
    initializeSecuritySchema(db);
    seedSecurityData(db);
    service = new SecurityContextService(new SqliteSecurityContextRepository(db));
  });
  afterEach(() => db.close());

  it("loads the validated seed fixture idempotently", () => {
    seedSecurityData(db);
    expect(db.prepare("SELECT COUNT(*) AS count FROM security_cases").get()).toEqual({ count: 5 });
    expect(db.prepare("SELECT COUNT(*) AS count FROM evidence").get()).toEqual({ count: 9 });
  });

  it("resolves all seeded relationship references", () => {
    expect(() => validateSecurityFixture(securityFixture)).not.toThrow();
    const brokenReferences = db.prepare(`
      SELECT COUNT(*) AS count FROM sessions s
      LEFT JOIN identities i ON i.id = s.identity_id
      LEFT JOIN devices d ON d.id = s.device_id
      WHERE i.id IS NULL OR (s.device_id IS NOT NULL AND d.id IS NULL)
    `).get();
    expect(brokenReferences).toEqual({ count: 0 });
  });

  it("returns the connected primary incident context", () => {
    const context = service.getIncidentContext("INC-1001");
    expect(context.lifecycle).toMatchObject({ state: "INVESTIGATING", version: 3 });
    expect(context.identity?.displayName).toBe("Asha Mehta");
    expect(context.devices.map((x) => x.id)).toEqual(["DEV-ASHA-CORP", "DEV-ASHA-UNKNOWN"]);
    expect(context.sessions).toHaveLength(2);
    expect(context.privileges).toHaveLength(2);
    expect(context.assets.map((x) => x.id)).toEqual(["AST-FINANCE"]);
    expect(context.events).toHaveLength(7);
    expect(context.evidence).toHaveLength(4);
  });

  it("returns the connected vulnerability finding context", () => {
    const context = service.getFindingContext("FIND-2001");
    expect(context.lifecycle.state).toBe("INVESTIGATING");
    expect(context.asset.id).toBe("AST-CUSTOMER-API");
    expect(context.vulnerability).toMatchObject({ id: "VULN-3001", cwe: "CWE-89", status: "VALIDATING" });
    expect(context.events).toHaveLength(2);
    expect(context.evidence).toHaveLength(2);
    expect(context.evidence[1].details).toMatchObject({ validationComplete: false });
  });

  it("rejects a fixture with a missing relationship", () => {
    const invalid = structuredClone(securityFixture);
    invalid.sessions[0].identityId = "IDN-MISSING";
    expect(() => validateSecurityFixture(invalid)).toThrow(FixtureRelationshipError);
  });
});
