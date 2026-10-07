import { env } from 'cloudflare:workers';

export function d1() {
  if (!env.DB) throw new Error('Database D1 belum tersedia.');
  return env.DB;
}
