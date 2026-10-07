// Import downloaded OAuth credentials without printing them or putting them in source.
// This command only creates a new ignored local config; it never overwrites one.
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolveGoogleConfig } from "../lib/google-oauth.ts";

try {
  const input = process.argv[2];
  if (!input) throw new Error("missing-input");
  const downloaded = JSON.parse(
    readFileSync(input, "utf8").replace(/^\uFEFF/, ""),
  );
  const client = downloaded.web;
  const callback = "http://localhost:3000/api/auth/google/callback";
  if (
    !client ||
    !Array.isArray(client.redirect_uris) ||
    !client.redirect_uris.includes(callback)
  )
    throw new Error("invalid-client");
  const values = {
    GOOGLE_CLIENT_ID: client.client_id,
    GOOGLE_CLIENT_SECRET: client.client_secret,
    GOOGLE_REDIRECT_URI: callback,
    OAUTH_SESSION_SECRET: randomBytes(32).toString("hex"),
  };
  if (
    Object.values(values).some(
      (value) => typeof value !== "string" || /[\r\n]/.test(value),
    ) ||
    !resolveGoogleConfig(values)
  )
    throw new Error("invalid-config");
  const content =
    "# Local secrets: never commit, publish, or share this file.\n" +
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n") +
    "\n";
  const target = fileURLToPath(new URL("../.dev.vars", import.meta.url));
  writeFileSync(target, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
  console.log(
    "Google OAuth imported into ignored .dev.vars. Secret values are not displayed.",
  );
  console.log(`Registered callback verified: ${callback}`);
} catch {
  console.error(
    "Import not completed. Check that the JSON is a Web OAuth client with the localhost callback, and that .dev.vars does not already exist. No existing config was overwritten.",
  );
  process.exitCode = 1;
}
