import Database from "better-sqlite3";
import { resolve } from "node:path";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const endpoint = process.env.ELASTIC_ENDPOINT?.replace(/\/$/, "");
const apiKey = process.env.ELASTIC_API_KEY;
if (!endpoint || !apiKey) {
  console.error("Elastic sync requires ELASTIC_ENDPOINT and ELASTIC_API_KEY.");
  process.exitCode = 1;
} else {
  const database = new Database(resolve(process.env.DATABASE_PATH ?? "./data/security-ops.db"), { readonly: true });
  const rows = database.prepare("SELECT * FROM security_events WHERE subject_type = 'INCIDENT' AND subject_id = ? ORDER BY id").all("INC-1001");
  database.close();
  let upserted = 0, failed = 0;
  for (const row of rows) {
    const document = { eventId: row.id, subjectType: row.subject_type, subjectId: row.subject_id,
      identityId: row.identity_id, deviceId: row.device_id, sessionId: row.session_id, assetId: row.asset_id,
      eventType: row.event_type, timestamp: row.occurred_at, source: row.source, summary: row.summary,
      attributes: JSON.parse(row.attributes_json) };
    try {
      const response = await fetch(`${endpoint}/bubblesurface-security-events/_doc/${encodeURIComponent(row.id)}`, {
        method: "PUT", headers: { authorization: `ApiKey ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(document),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      upserted += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to upsert event ${row.id}: ${error instanceof Error ? error.message : "request failed"}`);
    }
  }
  console.log(JSON.stringify({ subjectId: "INC-1001", upserted, failed }));
  if (failed) process.exitCode = 1;
}
