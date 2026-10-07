// Non-mutating auth smoke checks: no valid credentials, database writes, or external calls.
import assert from "node:assert/strict";
const origin = "http://localhost:3000";
const checks = [
  ["/", {}, 200],
  ["/admin?view=admin", {}, 307],
  ["/dashboard?view=ortyd", {}, 307],
  ["/api/admin/ai-agent-stream?view=admin", {}, 403],
  ["/api/admin/user-password?view=admin", { method: "POST" }, 403],
  ["/api/admin/user-status?view=admin", { method: "POST" }, 403],
  ["/api/admin/procurement-source?view=admin", { method: "POST" }, 403],
  ["/api/nib?view=padma", { method: "POST" }, 403],
  ["/api/procurement-search/trigger?view=padma", { method: "POST" }, 403],
  ["/api/auth/google", { method: "POST" }, 403],
  [
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    },
    422,
  ],
  [
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid",
    },
    422,
  ],
  [
    "/api/auth/google",
    { method: "POST", headers: { Origin: "https://example.com" } },
    403,
  ],
];
for (const [path, options, status] of checks) {
  const response = await fetch(origin + path, {
    ...options,
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(response.status, status, path);
  await response.body?.cancel();
  console.log(`PASS ${options.method ?? "GET"} ${path}: ${status}`);
}
console.log(`${checks.length} localhost checks passed.`);
