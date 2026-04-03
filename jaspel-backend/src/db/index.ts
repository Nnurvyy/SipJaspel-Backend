import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getDb(envDb: D1Database) {
  return drizzle(envDb, { schema });
}

export type DbClient = ReturnType<typeof getDb>;
