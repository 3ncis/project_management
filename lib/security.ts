const encoder = new TextEncoder();

function encryptionKeyHex() {
  const value = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) {
    if (process.env.NODE_ENV !== 'production') return '0'.repeat(64);
    throw new Error('Konfigurasi keamanan kredensial belum tersedia.');
  }
  return value;
}

function fromHex(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function sealCredential(value: string) {
  const key = await crypto.subtle.importKey('raw', fromHex(encryptionKeyHex()), { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

export function correlationId() {
  return crypto.randomUUID();
}

export function safeError(error: unknown) {
  if (error instanceof Error && error.message.includes('belum tersedia')) return error.message;
  return 'Permintaan tidak dapat diproses.';
}

export function maskUsername(username: string) {
  const normalized = username.trim();
  if (normalized.includes('@')) {
    const [local, domain] = normalized.split('@');
    return `${local.slice(0, 2)}${'•'.repeat(Math.max(3, Math.min(6, local.length - 2)))}@${domain}`;
  }
  return `${normalized.slice(0, 2)}••••`;
}
