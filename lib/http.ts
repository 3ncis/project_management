/** Accept only JSON objects; null/arrays/primitives must not crash API validation. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch { return {}; }
}

/** Shared client error handling keeps forms recoverable after offline/invalid responses. */
export async function requestJson(url: string, init: RequestInit) {
  try {
    const response = await fetch(url, init);
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid JSON response');
    return { ok: response.ok, result: value as { message?: string; error?: string; destination?: string } };
  } catch {
    return { ok: false, result: { error: 'Tidak dapat menghubungi server. Periksa koneksi lalu coba kembali.' } };
  }
}
