import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Create per-request — Neon's HTTP driver is designed for this pattern
export function getDb() {
  // Normalize URL: trim, strip quotes, fix doubled prefix (postgresql:postgresql://)
  let url = (process.env.DATABASE_URL ?? '').trim().replace(/^["']|["']$/g, '');
  // Fix duplicated scheme: "postgresql:postgresql://" → "postgresql://"
  url = url.replace(/^postgresql:postgresql:\/\//, 'postgresql://');
  url = url.replace(/^postgres:postgres:\/\//, 'postgresql://');
  // Normalize postgres:// → postgresql://
  if (url.startsWith('postgres://')) {
    url = 'postgresql://' + url.slice('postgres://'.length);
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}
