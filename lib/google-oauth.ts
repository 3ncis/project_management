export type GoogleConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  signingKey: string;
};
export type GoogleAccount = { sub: string; email: string; name: string };

const encode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const decode = (value: string) =>
  Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
export const randomOAuthValue = () =>
  encode(crypto.getRandomValues(new Uint8Array(32)));
export async function oauthHash(value: string) {
  return encode(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
}

export function resolveGoogleConfig(
  values: Record<string, unknown>,
): GoogleConfig | null {
  const clientId = String(values.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret = String(values.GOOGLE_CLIENT_SECRET ?? "").trim();
  const redirectUri = String(values.GOOGLE_REDIRECT_URI ?? "").trim();
  const signingKey = String(values.OAUTH_SESSION_SECRET ?? "").trim();
  if (
    !clientId.endsWith(".apps.googleusercontent.com") ||
    !clientSecret ||
    !/^[a-f0-9]{64}$/i.test(signingKey)
  )
    return null;
  try {
    const url = new URL(redirectUri);
    const localHttp =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);
    if (
      (!localHttp && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== "/api/auth/google/callback"
    )
      return null;
  } catch {
    return null;
  }
  return { clientId, clientSecret, redirectUri, signingKey };
}

async function signingKey(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret))
    throw new Error("Invalid OAuth signing key");
  const bytes = Uint8Array.from(secret.match(/../g)!, (hex) =>
    parseInt(hex, 16),
  );
  return crypto.subtle.importKey(
    "raw",
    bytes,
    { 
      name: "HMAC", 
      hash: "SHA-256" 
    },
    false,
    ["sign", "verify"],
  );
}

export async function signOAuthCookie(
  payload: Record<string, unknown>,
  secret: string,
) {
  const data = encode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secret),
    new TextEncoder().encode(data),
  );
  return `${data}.${encode(new Uint8Array(signature))}`;
}

export async function readOAuthCookie(
  value: string | undefined,
  secret: string,
  purpose: string,
  sessionHash: string,
): Promise<Record<string, unknown> | null> {
  if (!value || value.length > 4000) return null;
  try {
    const parts = value.split(".");
    if (
      parts.length !== 2 ||
      !(await crypto.subtle.verify(
        "HMAC",
        await signingKey(secret),
        decode(parts[1]),
        new TextEncoder().encode(parts[0]),
      ))
    )
      return null;
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if (
      !payload ||
      payload.purpose !== purpose ||
      payload.sessionHash !== sessionHash ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt <= Date.now()
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

export async function googleAuthorizationUrl(
  config: GoogleConfig,
  state: string,
  verifier: string,
) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    code_challenge: await oauthHash(verifier),
    code_challenge_method: "S256",
  }).toString();
  return url;
}

// Identity is read from Google's authenticated userinfo endpoint, never an unverified JWT.
// Access tokens are transient and are not stored or returned to the browser.
export async function exchangeGoogleCode(
  config: GoogleConfig,
  code: string,
  verifier: string,
  fetcher: typeof fetch = fetch,
): Promise<GoogleAccount> {
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) throw new Error("Google token exchange failed");
  const token = (await response.json()) as Record<string, unknown>;
  if (
    typeof token.access_token !== "string" ||
    String(token.token_type).toLowerCase() !== "bearer"
  )
    throw new Error("Invalid Google token");
  const profileResponse = await fetcher(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!profileResponse.ok) throw new Error("Google profile request failed");
  const profile = (await profileResponse.json()) as Record<string, unknown>;
  if (
    typeof profile.sub !== "string" ||
    !profile.sub ||
    typeof profile.email !== "string" ||
    !profile.email ||
    profile.email_verified !== true
  )
    throw new Error("Google email is not verified");
  return {
    sub: profile.sub.slice(0, 255),
    email: profile.email.slice(0, 320),
    name:
      typeof profile.name === "string"
        ? profile.name.slice(0, 200)
        : profile.email.slice(0, 320),
  };
}
