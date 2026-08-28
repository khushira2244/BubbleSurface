import { securityEventSchema, type SecurityEvent } from "../domain/security/security.schemas";
import type { EventSearchQuery, EvidenceTimeline, SecurityEventSource } from "./security-ports";

export const ELASTIC_SECURITY_EVENTS_INDEX = "bubblesurface-security-events";
type FetchLike = typeof fetch;

export function toElasticSecurityDocument(event: SecurityEvent): Record<string, unknown> {
  return {
    eventId: event.id, subjectType: event.subjectType, subjectId: event.subjectId,
    identityId: event.identityId, deviceId: event.deviceId, sessionId: event.sessionId,
    assetId: event.assetId, eventType: event.eventType, timestamp: event.occurredAt,
    source: event.source, summary: event.summary, attributes: event.attributes,
  };
}

export function fromElasticSecurityDocument(document: unknown): SecurityEvent {
  const value = document as Record<string, unknown>;
  return securityEventSchema.parse({
    id: value.eventId, subjectType: value.subjectType, subjectId: value.subjectId,
    identityId: value.identityId ?? null, deviceId: value.deviceId ?? null,
    sessionId: value.sessionId ?? null, assetId: value.assetId ?? null,
    eventType: value.eventType, occurredAt: value.timestamp, source: value.source,
    summary: value.summary, attributes: value.attributes ?? {},
  });
}

export class ElasticSecurityAdapter implements SecurityEventSource {
  private readonly endpoint: string;
  constructor(endpoint: string, private readonly apiKey: string, private readonly fallback: SecurityEventSource,
    private readonly fetcher: FetchLike = fetch, private readonly index = ELASTIC_SECURITY_EVENTS_INDEX) {
    this.endpoint = endpoint.replace(/\/$/, "");
  }
  private headers(): Record<string, string> {
    return { authorization: `ApiKey ${this.apiKey}`, "content-type": "application/json" };
  }
  async indexSecurityEvent(event: SecurityEvent): Promise<void> {
    const response = await this.fetcher(`${this.endpoint}/${this.index}/_doc/${encodeURIComponent(event.id)}`, {
      method: "PUT", headers: this.headers(), body: JSON.stringify(toElasticSecurityDocument(event)),
    });
    if (!response.ok) throw new ElasticRequestError(response.status);
  }
  async searchEvents(query: EventSearchQuery): Promise<SecurityEvent[]> {
    const filters: Array<Record<string, unknown>> = [];
    if (query.subjectType) filters.push({ term: { "subjectType.keyword": query.subjectType } });
    if (query.subjectId) filters.push({ term: { "subjectId.keyword": query.subjectId } });
    if (query.identityId) filters.push({ term: { "identityId.keyword": query.identityId } });
    if (query.from || query.to) filters.push({ range: { timestamp: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } });
    const response = await this.fetcher(`${this.endpoint}/${this.index}/_search`, {
      method: "POST", headers: this.headers(), body: JSON.stringify({
        size: Math.min(Math.max(query.limit ?? 100, 1), 500),
        sort: [{ timestamp: "asc" }], query: { bool: { filter: filters } },
      }),
    });
    if (!response.ok) throw new ElasticRequestError(response.status);
    const body = await response.json() as { hits?: { hits?: Array<{ _source: unknown }> } };
    return (body.hits?.hits ?? []).map((hit) => fromElasticSecurityDocument(hit._source));
  }
  getEventsForIdentity(identityId: string) { return this.searchEvents({ identityId }); }
  getEventsForIncident(incidentId: string) { return this.searchEvents({ subjectType: "INCIDENT", subjectId: incidentId }); }
  async getEvidenceTimeline(subjectType: "INCIDENT" | "FINDING", subjectId: string): Promise<EvidenceTimeline> {
    const [events, fallbackTimeline] = await Promise.all([
      this.searchEvents({ subjectType, subjectId }), this.fallback.getEvidenceTimeline(subjectType, subjectId),
    ]);
    return { events, evidence: fallbackTimeline.evidence };
  }
}

export class ElasticRequestError extends Error {
  readonly code = "ELASTIC_REQUEST_FAILED";
  constructor(readonly status: number) { super(`Elastic request failed with HTTP ${status}.`); }
}
