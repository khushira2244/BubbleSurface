import type { Auth0User } from "./auth0-management.client";
import { Auth0ProviderError } from "./auth0.errors";

export function assertDedicatedDemoUser(user:Auth0User,expectedUserId:string,expectedEmail:string):void {
  if(user.user_id!==expectedUserId||user.email!==expectedEmail) {
    throw new Auth0ProviderError("AUTH0_IDENTITY_MISMATCH","Configured Auth0 target is not the dedicated Asha demo identity; no mutation or verification was accepted.");
  }
}
