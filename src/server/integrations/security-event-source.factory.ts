import type Database from "better-sqlite3";
import type { IntegrationConfig } from "../config/integrations";
import type { SecurityEventSource } from "./security-ports";
import { ElasticSecurityAdapter } from "./elastic-security.adapter";
import { SqliteSecurityEventAdapter } from "./sqlite-security-event.adapter";

export function createSecurityEventSource(db: Database.Database, config: IntegrationConfig,
  fetcher: typeof fetch = fetch): SecurityEventSource {
  const sqlite = new SqliteSecurityEventAdapter(db);
  if (config.SECURITY_EVENT_SOURCE !== "elastic" || !config.ELASTIC_ENDPOINT || !config.ELASTIC_API_KEY) return sqlite;
  return new ElasticSecurityAdapter(config.ELASTIC_ENDPOINT, config.ELASTIC_API_KEY, sqlite, fetcher);
}
