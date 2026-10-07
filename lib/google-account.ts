import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { getSessionViewer, SESSION_COOKIE } from "./auth";
import {
  oauthHash,
  readOAuthCookie,
  resolveGoogleConfig,
  type GoogleAccount,
} from "./google-oauth";

export const GOOGLE_FLOW_COOKIE = "pst_google_flow";
export const GOOGLE_ACCOUNT_COOKIE = "pst_google_account";

export function getGoogleConfig() {
  const bindings = env as unknown as Record<string, unknown>;
  return resolveGoogleConfig(
    Object.fromEntries(
      [
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "GOOGLE_REDIRECT_URI",
        "OAUTH_SESSION_SECRET",
      ].map((key) => [key, bindings[key] ?? process.env[key]]),
    ),
  );
}

export async function getGoogleConnection(): Promise<{
  configured: boolean;
  account: GoogleAccount | null;
}> {
  const config = getGoogleConfig();
  if (!config) return { configured: false, account: null };
  const viewer = await getSessionViewer();
  const jar = await cookies();
  const session = jar.get(SESSION_COOKIE)?.value;
  if (viewer?.role !== "admin" || !session)
    return { configured: true, account: null };
  const payload = await readOAuthCookie(
    jar.get(GOOGLE_ACCOUNT_COOKIE)?.value,
    config.signingKey,
    "google-account",
    await oauthHash(session),
  );
  if (
    !payload ||
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.name !== "string"
  )
    return { configured: true, account: null };
  return {
    configured: true,
    account: { sub: payload.sub, email: payload.email, name: payload.name },
  };
}
