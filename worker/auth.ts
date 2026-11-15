import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AuthInfo } from "./types";

// Google's public keys for Firebase ID tokens. jose caches them between requests.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

/** Verifies a Firebase Authentication ID token and returns the user it belongs to. */
export async function verifyFirebaseToken(token: string, projectId: string): Promise<AuthInfo> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  if (!payload.sub) throw new Error("Token has no subject");
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
  };
}
