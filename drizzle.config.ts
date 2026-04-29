import { config } from 'dotenv';
config({ path: '.env.local' });

import { defineConfig } from 'drizzle-kit';

// Normalize URL: fix duplicated scheme (postgresql:postgresql://)
function normalizeDbUrl(url: string | undefined): string {
  let u = (url ?? '').trim().replace(/^["']|["']$/g, '');
  u = u.replace(/^postgresql:postgresql:\/\//, 'postgresql://');
  u = u.replace(/^postgres:postgres:\/\//, 'postgresql://');
  if (u.startsWith('postgres://')) u = 'postgresql://' + u.slice('postgres://'.length);
  return u;
}

export default defineConfig({
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: normalizeDbUrl(process.env.DATABASE_URL),
  },
});
