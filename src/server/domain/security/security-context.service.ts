import type { FindingContext, IncidentContext } from "./security.schemas";
import type { SecurityContextRepository } from "./security.repository";

export class SecurityContextNotFoundError extends Error {
  readonly code = "SECURITY_CONTEXT_NOT_FOUND";
  constructor(entity: string, id: string) { super(`${entity} ${id} was not found.`); }
}

export class SecurityContextService {
  constructor(private readonly repository: SecurityContextRepository) {}

  getIncidentContext(incidentId: string): IncidentContext {
    const lifecycle = this.repository.getCase(incidentId);
    const incident = this.repository.getIncident(incidentId);
    if (!lifecycle || !incident) throw new SecurityContextNotFoundError("Incident", incidentId);
    const identity = incident.affectedIdentityId ? this.repository.getIdentity(incident.affectedIdentityId) : null;
    return {
      lifecycle, incident, identity,
      devices: identity ? this.repository.getDevicesForIdentity(identity.id) : [],
      sessions: identity ? this.repository.getActiveSessions(identity.id) : [],
      privileges: identity ? this.repository.getPrivilegesForIdentity(identity.id) : [],
      assets: this.repository.getAssetsForIncident(incidentId),
      events: this.repository.getSecurityEventsForSubject("INCIDENT", incidentId),
      evidence: this.repository.getEvidenceForSubject("INCIDENT", incidentId),
    };
  }

  getFindingContext(findingId: string): FindingContext {
    const lifecycle = this.repository.getCase(findingId);
    const finding = this.repository.getFinding(findingId);
    if (!lifecycle || !finding) throw new SecurityContextNotFoundError("Finding", findingId);
    const vulnerability = this.repository.getVulnerabilityForFinding(findingId);
    const asset = this.repository.getAsset(finding.assetId);
    if (!vulnerability || !asset) throw new SecurityContextNotFoundError("Finding relationship", findingId);
    return {
      lifecycle, finding, vulnerability, asset,
      events: this.repository.getSecurityEventsForSubject("FINDING", findingId),
      evidence: this.repository.getEvidenceForSubject("FINDING", findingId),
    };
  }

  getIdentityContext(identityId: string) {
    const identity = this.repository.getIdentity(identityId);
    if (!identity) throw new SecurityContextNotFoundError("Identity", identityId);
    return { identity, devices: this.repository.getDevicesForIdentity(identityId),
      sessions: this.repository.getActiveSessions(identityId), privileges: this.repository.getPrivilegesForIdentity(identityId) };
  }

  getDeviceContext(deviceId: string) {
    const device = this.repository.getDevice(deviceId);
    if (!device) throw new SecurityContextNotFoundError("Device", deviceId);
    return device;
  }

  getIncident(incidentId: string) {
    const lifecycle = this.repository.getCase(incidentId);
    const incident = this.repository.getIncident(incidentId);
    if (!lifecycle || !incident) throw new SecurityContextNotFoundError("Incident", incidentId);
    return { lifecycle, incident };
  }

  getFinding(findingId: string) {
    const lifecycle = this.repository.getCase(findingId);
    const finding = this.repository.getFinding(findingId);
    if (!lifecycle || !finding) throw new SecurityContextNotFoundError("Finding", findingId);
    return { lifecycle, finding };
  }

  getActiveSessions(identityId: string) {
    if (!this.repository.getIdentity(identityId)) throw new SecurityContextNotFoundError("Identity", identityId);
    return this.repository.getActiveSessions(identityId);
  }

  getPrivileges(identityId: string) {
    if (!this.repository.getIdentity(identityId)) throw new SecurityContextNotFoundError("Identity", identityId);
    return this.repository.getPrivilegesForIdentity(identityId);
  }

  getIncidentEvents(incidentId: string) {
    if (!this.repository.getIncident(incidentId)) throw new SecurityContextNotFoundError("Incident", incidentId);
    return this.repository.getSecurityEventsForSubject("INCIDENT", incidentId);
  }

  getIncidentEvidence(incidentId: string) {
    if (!this.repository.getIncident(incidentId)) throw new SecurityContextNotFoundError("Incident", incidentId);
    return this.repository.getEvidenceForSubject("INCIDENT", incidentId);
  }
}
