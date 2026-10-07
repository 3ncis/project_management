import { d1 } from './binding';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb() {
  return drizzle(d1(), { schema });
}
