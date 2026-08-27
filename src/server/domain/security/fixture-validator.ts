import { securityFixtureSchema, type SecurityFixture } from "./security.schemas";

export class FixtureRelationshipError extends Error {
  readonly code = "INVALID_FIXTURE_RELATIONSHIP";
}

const requireReference = (exists: boolean, description: string) => {
  if (!exists) throw new FixtureRelationshipError(description);
};

export function validateSecurityFixture(input: unknown): SecurityFixture {
  const fixture = securityFixtureSchema.parse(input);
  const ids = <T extends { id: string }>(items: T[]) => new Set(items.map((item) => item.id));
  const caseIds = ids(fixture.cases), incidentIds = ids(fixture.incidents), findingIds = ids(fixture.findings);
  const identityIds = ids(fixture.identities), deviceIds = ids(fixture.devices), sessionIds = ids(fixture.sessions);
  const assetIds = ids(fixture.assets), eventIds = ids(fixture.events);

  for (const incident of fixture.incidents) {
    requireReference(caseIds.has(incident.id), `Incident ${incident.id} has no lifecycle case.`);
    if (incident.affectedIdentityId) requireReference(identityIds.has(incident.affectedIdentityId), `Incident ${incident.id} references missing identity ${incident.affectedIdentityId}.`);
  }
  for (const finding of fixture.findings) {
    requireReference(caseIds.has(finding.id), `Finding ${finding.id} has no lifecycle case.`);
    requireReference(assetIds.has(finding.assetId), `Finding ${finding.id} references missing asset ${finding.assetId}.`);
  }
  for (const device of fixture.devices) requireReference(identityIds.has(device.identityId), `Device ${device.id} references missing identity ${device.identityId}.`);
  for (const session of fixture.sessions) {
    requireReference(identityIds.has(session.identityId), `Session ${session.id} references missing identity ${session.identityId}.`);
    if (session.deviceId) requireReference(deviceIds.has(session.deviceId), `Session ${session.id} references missing device ${session.deviceId}.`);
  }
  for (const privilege of fixture.privileges) {
    requireReference(identityIds.has(privilege.identityId), `Privilege ${privilege.id} references missing identity ${privilege.identityId}.`);
    if (privilege.assetId) requireReference(assetIds.has(privilege.assetId), `Privilege ${privilege.id} references missing asset ${privilege.assetId}.`);
  }
  for (const vulnerability of fixture.vulnerabilities) {
    requireReference(findingIds.has(vulnerability.findingId), `Vulnerability ${vulnerability.id} references missing finding ${vulnerability.findingId}.`);
    requireReference(assetIds.has(vulnerability.assetId), `Vulnerability ${vulnerability.id} references missing asset ${vulnerability.assetId}.`);
  }
  for (const event of fixture.events) {
    requireReference(event.subjectType === "INCIDENT" ? incidentIds.has(event.subjectId) : findingIds.has(event.subjectId), `Event ${event.id} references missing subject ${event.subjectId}.`);
    if (event.identityId) requireReference(identityIds.has(event.identityId), `Event ${event.id} references missing identity ${event.identityId}.`);
    if (event.deviceId) requireReference(deviceIds.has(event.deviceId), `Event ${event.id} references missing device ${event.deviceId}.`);
    if (event.sessionId) requireReference(sessionIds.has(event.sessionId), `Event ${event.id} references missing session ${event.sessionId}.`);
    if (event.assetId) requireReference(assetIds.has(event.assetId), `Event ${event.id} references missing asset ${event.assetId}.`);
  }
  for (const evidence of fixture.evidence) {
    requireReference(evidence.subjectType === "INCIDENT" ? incidentIds.has(evidence.subjectId) : findingIds.has(evidence.subjectId), `Evidence ${evidence.id} references missing subject ${evidence.subjectId}.`);
    if (evidence.eventId) requireReference(eventIds.has(evidence.eventId), `Evidence ${evidence.id} references missing event ${evidence.eventId}.`);
  }
  for (const relation of fixture.incidentAssets) {
    requireReference(incidentIds.has(relation.incidentId), `Incident-asset link references missing incident ${relation.incidentId}.`);
    requireReference(assetIds.has(relation.assetId), `Incident-asset link references missing asset ${relation.assetId}.`);
  }
  return fixture;
}
