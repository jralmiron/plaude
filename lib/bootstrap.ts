import { sql } from 'drizzle-orm';
import { getDb } from './db';
import { ensureSeedUsers } from './auth';

declare global {
  // eslint-disable-next-line no-var
  var __hermesBootstrapPromise: Promise<void> | undefined;
}

async function bootstrapOnce() {
  const db = getDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      username varchar(100) NOT NULL UNIQUE,
      display_name varchar(120) NOT NULL DEFAULT '',
      password_hash text NOT NULL DEFAULT '',
      password_plain text NOT NULL DEFAULT '',
      role varchar(20) NOT NULL DEFAULT 'user',
      can_manage_users boolean NOT NULL DEFAULT false,
      can_manage_passwords boolean NOT NULL DEFAULT false,
      can_view_all_conversations boolean NOT NULL DEFAULT false,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name varchar(120) NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain text NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_users boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_manage_passwords boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_all_conversations boolean NOT NULL DEFAULT false`);
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);

  await db.execute(sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id integer`);
  await db.execute(sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);

  await db.execute(sql`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS user_id integer`);
  await db.execute(sql`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS session_id integer`);
  await db.execute(sql`ALTER TABLE transcriptions ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pdf_documents (
      id serial PRIMARY KEY,
      user_id integer,
      transcription_id integer NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(120) NOT NULL DEFAULT 'application/pdf',
      size_bytes integer NOT NULL,
      content_base64 text NOT NULL,
      source_hash varchar(64) NOT NULL,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`ALTER TABLE pdf_documents ADD COLUMN IF NOT EXISTS content_base64 text`);
  await db.execute(sql`ALTER TABLE pdf_documents ADD COLUMN IF NOT EXISTS source_hash varchar(64)`);
  await db.execute(sql`ALTER TABLE pdf_documents ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS pdf_documents_transcription_unique ON pdf_documents (transcription_id)`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS audio_chunks_session_chunk_idx ON audio_chunks (session_id, chunk_index)`);

  await ensureSeedUsers();
}

export async function ensureAppBootstrap() {
  if (!globalThis.__hermesBootstrapPromise) {
    globalThis.__hermesBootstrapPromise = bootstrapOnce().catch((error) => {
      globalThis.__hermesBootstrapPromise = undefined;
      throw error;
    });
  }
  await globalThis.__hermesBootstrapPromise;
}
