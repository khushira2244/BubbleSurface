import { z } from "zod";

const integrationEnvironmentSchema = z.object({
  ELASTIC_ENDPOINT: z.url().optional(), ELASTIC_API_KEY: z.string().min(1).optional(),
  OKTA_ORG_URL: z.url().optional(), OKTA_API_TOKEN: z.string().min(1).optional(),
  OKTA_CLIENT_ID: z.string().min(1).optional(), OKTA_CLIENT_SECRET: z.string().min(1).optional(),
}).superRefine((value, context) => {
  if (value.ELASTIC_ENDPOINT && !value.ELASTIC_API_KEY) context.addIssue({ code: "custom", message: "ELASTIC_API_KEY is required when ELASTIC_ENDPOINT is set." });
  if (value.OKTA_ORG_URL && !value.OKTA_API_TOKEN && !(value.OKTA_CLIENT_ID && value.OKTA_CLIENT_SECRET)) context.addIssue({ code: "custom", message: "Okta credentials are required when OKTA_ORG_URL is set." });
});

export type IntegrationConfig = z.infer<typeof integrationEnvironmentSchema>;
export function getIntegrationConfig(environment: NodeJS.ProcessEnv = process.env): IntegrationConfig {
  return integrationEnvironmentSchema.parse(environment);
}
