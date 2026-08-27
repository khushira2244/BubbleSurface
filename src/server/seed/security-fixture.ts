import type { SecurityFixture } from "../domain/security/security.schemas";

const t = {
  created: "2026-08-26T03:00:00.000Z",
  updated: "2026-08-27T03:30:00.000Z",
};
const caseT = { createdAt: t.created, updatedAt: t.updated };

export const securityFixture: SecurityFixture = {
  cases: [
    { id: "INC-1001", type: "INCIDENT", title: "Unusual sessions and privilege activity for Asha Mehta", state: "INVESTIGATING", version: 3, ...caseT },
    { id: "FIND-2001", type: "VULNERABILITY_FINDING", title: "Potential SQL injection in customer search", state: "INVESTIGATING", version: 3, ...caseT },
    { id: "INC-1002", type: "INCIDENT", title: "Suspicious OAuth token use", state: "TRIAGE", version: 2, ...caseT },
    { id: "FIND-2002", type: "VULNERABILITY_FINDING", title: "Excessive cloud storage permission", state: "NEW", version: 1, ...caseT },
    { id: "INC-1003", type: "INCIDENT", title: "High-risk unmanaged device activity", state: "TRIAGE", version: 2, ...caseT },
  ],
  identities: [
    { id: "IDN-ASHA", displayName: "Asha Mehta", email: "asha.mehta@northstar.example", department: "Finance Operations", normalLocation: "Bengaluru, IN", riskLevel: "HIGH", source: "simulated-iam", createdAt: t.created, updatedAt: t.updated },
    { id: "IDN-ROHAN", displayName: "Rohan Rao", email: "rohan.rao@northstar.example", department: "Engineering", normalLocation: "Hyderabad, IN", riskLevel: "MEDIUM", source: "simulated-iam", createdAt: t.created, updatedAt: t.updated },
    { id: "IDN-MIRA", displayName: "Mira Shah", email: "mira.shah@northstar.example", department: "Sales", normalLocation: "Mumbai, IN", riskLevel: "MEDIUM", source: "simulated-iam", createdAt: t.created, updatedAt: t.updated },
  ],
  devices: [
    { id: "DEV-ASHA-CORP", identityId: "IDN-ASHA", hostname: "NS-BLR-0421", platform: "Windows 11 Enterprise", trustStatus: "TRUSTED", location: "Bengaluru, IN", source: "simulated-edr", lastSeenAt: "2026-08-27T02:25:00.000Z", createdAt: t.created, updatedAt: t.updated },
    { id: "DEV-ASHA-UNKNOWN", identityId: "IDN-ASHA", hostname: "unknown-browser-91", platform: "Linux / Chromium", trustStatus: "UNKNOWN", location: "Frankfurt, DE", source: "simulated-iam", lastSeenAt: "2026-08-27T02:25:00.000Z", createdAt: t.created, updatedAt: t.updated },
    { id: "DEV-ROHAN-CORP", identityId: "IDN-ROHAN", hostname: "NS-HYD-0188", platform: "macOS 15", trustStatus: "TRUSTED", location: "Hyderabad, IN", source: "simulated-edr", lastSeenAt: "2026-08-27T04:10:00.000Z", createdAt: t.created, updatedAt: t.updated },
    { id: "DEV-MIRA-BYOD", identityId: "IDN-MIRA", hostname: "personal-android", platform: "Android 16", trustStatus: "UNTRUSTED", location: "Mumbai, IN", source: "simulated-edr", lastSeenAt: "2026-08-27T05:10:00.000Z", createdAt: t.created, updatedAt: t.updated },
  ],
  assets: [
    { id: "AST-FINANCE", name: "Finance Administration Portal", type: "WEB_APPLICATION", environment: "production", criticality: "CRITICAL", component: "admin-console", source: "simulated-cmdb", createdAt: t.created, updatedAt: t.updated },
    { id: "AST-CUSTOMER-API", name: "Customer Service API", type: "API", environment: "production", criticality: "HIGH", component: "customer-search", source: "simulated-cmdb", createdAt: t.created, updatedAt: t.updated },
    { id: "AST-CLOUD-STORAGE", name: "Customer Export Storage", type: "CLOUD_STORAGE", environment: "production", criticality: "HIGH", component: "exports-bucket", source: "simulated-cspm", createdAt: t.created, updatedAt: t.updated },
    { id: "AST-CRM", name: "Sales CRM", type: "SAAS", environment: "production", criticality: "MEDIUM", component: "oauth-integration", source: "simulated-cmdb", createdAt: t.created, updatedAt: t.updated },
  ],
  sessions: [
    { id: "SES-ASHA-NORMAL", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-CORP", tokenType: "OIDC", status: "ACTIVE", ipAddress: "49.207.12.44", location: "Bengaluru, IN", createdAt: "2026-08-26T09:02:00.000Z", lastSeenAt: "2026-08-27T02:00:00.000Z", source: "simulated-iam" },
    { id: "SES-ASHA-SUSPICIOUS", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-UNKNOWN", tokenType: "OIDC_REFRESH", status: "ACTIVE", ipAddress: "185.220.101.44", location: "Frankfurt, DE", createdAt: "2026-08-27T02:13:00.000Z", lastSeenAt: "2026-08-27T02:25:00.000Z", source: "simulated-iam" },
    { id: "SES-ROHAN-OAUTH", identityId: "IDN-ROHAN", deviceId: "DEV-ROHAN-CORP", tokenType: "OAUTH", status: "ACTIVE", ipAddress: "103.88.12.10", location: "Hyderabad, IN", createdAt: "2026-08-27T04:00:00.000Z", lastSeenAt: "2026-08-27T04:10:00.000Z", source: "simulated-saas" },
    { id: "SES-MIRA-BYOD", identityId: "IDN-MIRA", deviceId: "DEV-MIRA-BYOD", tokenType: "SAML", status: "ACTIVE", ipAddress: "106.51.22.18", location: "Mumbai, IN", createdAt: "2026-08-27T05:00:00.000Z", lastSeenAt: "2026-08-27T05:10:00.000Z", source: "simulated-iam" },
  ],
  privileges: [
    { id: "PRV-ASHA-EMPLOYEE", identityId: "IDN-ASHA", assetId: null, name: "standard-employee", scope: "organization", status: "ACTIVE", grantedAt: "2025-01-10T08:00:00.000Z", revokedAt: null, source: "simulated-iam" },
    { id: "PRV-ASHA-FINADMIN", identityId: "IDN-ASHA", assetId: "AST-FINANCE", name: "finance-admin", scope: "finance-production", status: "ACTIVE", grantedAt: "2026-08-27T02:19:00.000Z", revokedAt: null, source: "simulated-iam" },
    { id: "PRV-ROHAN-DEV", identityId: "IDN-ROHAN", assetId: "AST-CUSTOMER-API", name: "service-developer", scope: "customer-api", status: "ACTIVE", grantedAt: "2025-03-01T08:00:00.000Z", revokedAt: null, source: "simulated-iam" },
  ],
  incidents: [
    { id: "INC-1001", affectedIdentityId: "IDN-ASHA", summary: "Unfamiliar authentication followed by token, privilege, and sensitive-access activity", severity: "CRITICAL", category: "IDENTITY_SESSION_COMPROMISE", owner: "analyst-kavya", source: "simulated-siem", createdAt: "2026-08-27T02:17:00.000Z", updatedAt: t.updated },
    { id: "INC-1002", affectedIdentityId: "IDN-ROHAN", summary: "OAuth token used with an unusual permission scope", severity: "HIGH", category: "SUSPICIOUS_OAUTH", owner: null, source: "simulated-saas", createdAt: "2026-08-27T04:12:00.000Z", updatedAt: t.updated },
    { id: "INC-1003", affectedIdentityId: "IDN-MIRA", summary: "Sensitive CRM access from an unmanaged mobile device", severity: "MEDIUM", category: "DEVICE_RISK", owner: null, source: "simulated-edr", createdAt: "2026-08-27T05:12:00.000Z", updatedAt: t.updated },
  ],
  findings: [
    { id: "FIND-2001", assetId: "AST-CUSTOMER-API", summary: "Potential SQL injection behavior in customer search query handling", severity: "HIGH", status: "INVESTIGATING", component: "GET /v1/customers/search", owner: "analyst-neel", source: "simulated-sast", createdAt: "2026-08-27T01:20:00.000Z", updatedAt: t.updated },
    { id: "FIND-2002", assetId: "AST-CLOUD-STORAGE", summary: "Storage export role permits broader read access than intended", severity: "MEDIUM", status: "POTENTIAL", component: "exports-reader-role", owner: null, source: "simulated-cspm", createdAt: "2026-08-27T06:00:00.000Z", updatedAt: t.updated },
  ],
  vulnerabilities: [
    { id: "VULN-3001", findingId: "FIND-2001", assetId: "AST-CUSTOMER-API", title: "Potential SQL injection in customer search", cwe: "CWE-89", endpoint: "GET /v1/customers/search?q=", status: "VALIDATING", description: "A query construction path may concatenate an untrusted search term. Validation is incomplete.", createdAt: "2026-08-27T01:20:00.000Z", updatedAt: t.updated },
    { id: "VULN-3002", findingId: "FIND-2002", assetId: "AST-CLOUD-STORAGE", title: "Overly broad cloud permission", cwe: null, endpoint: null, status: "POTENTIAL", description: "The export reader role appears to include a wildcard resource scope.", createdAt: "2026-08-27T06:00:00.000Z", updatedAt: t.updated },
  ],
  incidentAssets: [
    { incidentId: "INC-1001", assetId: "AST-FINANCE" },
    { incidentId: "INC-1002", assetId: "AST-CRM" },
    { incidentId: "INC-1003", assetId: "AST-CRM" },
  ],
  events: [
    { id: "EVT-1001", subjectType: "INCIDENT", subjectId: "INC-1001", eventType: "LOGIN_SUCCESS", occurredAt: "2026-08-26T09:02:00.000Z", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-CORP", sessionId: "SES-ASHA-NORMAL", assetId: null, source: "simulated-iam", summary: "Successful login from Asha's managed laptop in Bengaluru", attributes: { authenticationMethod: "password+mfa", risk: "low" } },
    { id: "EVT-1002", subjectType: "INCIDENT", subjectId: "INC-1001", eventType: "LOGIN_SUCCESS", occurredAt: "2026-08-27T02:11:00.000Z", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-UNKNOWN", sessionId: null, assetId: null, source: "simulated-iam", summary: "Successful login from an unfamiliar device in Frankfurt", attributes: { authenticationMethod: "password", risk: "high" } },
    { id: "EVT-1003", subjectType: "INCIDENT", subjectId: "INC-1001", eventType: "SESSION_CREATED", occurredAt: "2026-08-27T02:13:00.000Z", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-UNKNOWN", sessionId: "SES-ASHA-SUSPICIOUS", assetId: null, source: "simulated-iam", summary: "Refresh-capable session created for the unfamiliar device", attributes: { tokenType: "OIDC_REFRESH" } },
    { id: "EVT-1004", subjectType: "INCIDENT", subjectId: "INC-1001", eventType: "MFA_ANOMALY", occurredAt: "2026-08-27T02:16:00.000Z", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-UNKNOWN", sessionId: "SES-ASHA-SUSPICIOUS", assetId: null, source: "simulated-iam", summary: "Three MFA challenges failed within two minutes", attributes: { failedChallenges: 3 } },
    { id: "EVT-1005", subjectType: "INCIDENT", subjectId: "INC-1001", eventType: "PRIVILEGE_GRANTED", occurredAt: "2026-08-27T02:19:00.000Z", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-UNKNOWN", sessionId: "SES-ASHA-SUSPICIOUS", assetId: "AST-FINANCE", source: "simulated-iam", summary: "Finance administrator role granted outside the normal change window", attributes: { privilegeId: "PRV-ASHA-FINADMIN" } },
    { id: "EVT-1006", subjectType: "INCIDENT", subjectId: "INC-1001", eventType: "SENSITIVE_ASSET_ACCESS", occurredAt: "2026-08-27T02:22:00.000Z", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-UNKNOWN", sessionId: "SES-ASHA-SUSPICIOUS", assetId: "AST-FINANCE", source: "simulated-app", summary: "Payroll export configuration was opened", attributes: { operation: "read", resource: "payroll-export" } },
    { id: "EVT-1007", subjectType: "INCIDENT", subjectId: "INC-1001", eventType: "SESSION_ACTIVITY", occurredAt: "2026-08-27T02:25:00.000Z", identityId: "IDN-ASHA", deviceId: "DEV-ASHA-UNKNOWN", sessionId: "SES-ASHA-SUSPICIOUS", assetId: "AST-FINANCE", source: "simulated-app", summary: "Unusual session queried multiple finance records", attributes: { queryCount: 42 } },
    { id: "EVT-2001", subjectType: "FINDING", subjectId: "FIND-2001", eventType: "STATIC_ANALYSIS_SIGNAL", occurredAt: "2026-08-27T01:20:00.000Z", identityId: null, deviceId: null, sessionId: null, assetId: "AST-CUSTOMER-API", source: "simulated-sast", summary: "Untrusted search input may reach a dynamically constructed query", attributes: { confidence: "medium" } },
    { id: "EVT-2002", subjectType: "FINDING", subjectId: "FIND-2001", eventType: "VALIDATION_OBSERVATION", occurredAt: "2026-08-27T01:45:00.000Z", identityId: null, deviceId: null, sessionId: null, assetId: "AST-CUSTOMER-API", source: "simulated-validation", summary: "A malformed search value produced a database syntax error in staging", attributes: { environment: "staging", complete: false } },
    { id: "EVT-3001", subjectType: "INCIDENT", subjectId: "INC-1002", eventType: "OAUTH_SCOPE_ANOMALY", occurredAt: "2026-08-27T04:10:00.000Z", identityId: "IDN-ROHAN", deviceId: "DEV-ROHAN-CORP", sessionId: "SES-ROHAN-OAUTH", assetId: "AST-CRM", source: "simulated-saas", summary: "Token accessed a scope not previously used by this integration", attributes: { scope: "contacts.export" } },
    { id: "EVT-3002", subjectType: "FINDING", subjectId: "FIND-2002", eventType: "PERMISSION_ANALYSIS", occurredAt: "2026-08-27T06:00:00.000Z", identityId: null, deviceId: null, sessionId: null, assetId: "AST-CLOUD-STORAGE", source: "simulated-cspm", summary: "Reader role includes wildcard resource access", attributes: { permission: "storage.objects.get" } },
    { id: "EVT-3003", subjectType: "INCIDENT", subjectId: "INC-1003", eventType: "UNMANAGED_DEVICE_ACCESS", occurredAt: "2026-08-27T05:10:00.000Z", identityId: "IDN-MIRA", deviceId: "DEV-MIRA-BYOD", sessionId: "SES-MIRA-BYOD", assetId: "AST-CRM", source: "simulated-edr", summary: "Unmanaged Android device accessed customer export view", attributes: { deviceCompliance: false } },
  ],
  evidence: [
    { id: "EVD-1001", subjectType: "INCIDENT", subjectId: "INC-1001", eventId: "EVT-1002", type: "AUTHENTICATION", summary: "Location and device differ from Asha's normal sign-in profile", source: "simulated-iam", observedAt: "2026-08-27T02:11:00.000Z", details: { distanceKm: 7400, devicePreviouslySeen: false } },
    { id: "EVD-1002", subjectType: "INCIDENT", subjectId: "INC-1001", eventId: "EVT-1004", type: "MFA", summary: "Repeated failed MFA challenges followed the unfamiliar login", source: "simulated-iam", observedAt: "2026-08-27T02:16:00.000Z", details: { failures: 3 } },
    { id: "EVD-1003", subjectType: "INCIDENT", subjectId: "INC-1001", eventId: "EVT-1005", type: "PRIVILEGE_CHANGE", summary: "A new privileged role was granted outside the change window", source: "simulated-iam", observedAt: "2026-08-27T02:19:00.000Z", details: { changeTicket: null, role: "finance-admin" } },
    { id: "EVD-1004", subjectType: "INCIDENT", subjectId: "INC-1001", eventId: "EVT-1006", type: "RESOURCE_ACCESS", summary: "The unfamiliar session reached a critical finance resource", source: "simulated-app", observedAt: "2026-08-27T02:22:00.000Z", details: { assetCriticality: "CRITICAL" } },
    { id: "EVD-2001", subjectType: "FINDING", subjectId: "FIND-2001", eventId: "EVT-2001", type: "CODE_CONTEXT", summary: "Search term reaches a query-building function without a confirmed parameter binding", source: "simulated-sast", observedAt: "2026-08-27T01:20:00.000Z", details: { file: "src/customer/search.repository.ts", lines: "84-91", boundedSnippet: "queryBuilder.where(searchTerm)" } },
    { id: "EVD-2002", subjectType: "FINDING", subjectId: "FIND-2001", eventId: "EVT-2002", type: "VALIDATION", summary: "Staging produced a syntax error, but exploitability has not been established", source: "simulated-validation", observedAt: "2026-08-27T01:45:00.000Z", details: { validationComplete: false, productionTested: false } },
    { id: "EVD-3001", subjectType: "INCIDENT", subjectId: "INC-1002", eventId: "EVT-3001", type: "TOKEN_SCOPE", summary: "Observed OAuth scope differs from the integration baseline", source: "simulated-saas", observedAt: "2026-08-27T04:10:00.000Z", details: { firstSeen: true } },
    { id: "EVD-3002", subjectType: "FINDING", subjectId: "FIND-2002", eventId: "EVT-3002", type: "CLOUD_PERMISSION", summary: "Resource wildcard expands access beyond the expected bucket prefix", source: "simulated-cspm", observedAt: "2026-08-27T06:00:00.000Z", details: { resource: "*" } },
    { id: "EVD-3003", subjectType: "INCIDENT", subjectId: "INC-1003", eventId: "EVT-3003", type: "DEVICE_POSTURE", summary: "Device is unmanaged and fails the corporate compliance baseline", source: "simulated-edr", observedAt: "2026-08-27T05:10:00.000Z", details: { managed: false, encrypted: null } },
  ],
};
