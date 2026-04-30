import { pgTable, serial, text, integer, timestamp, varchar } from 'drizzle-orm/pg-core';

export const transcriptions = pgTable('transcriptions', {
  id: serial('id').primaryKey(),
  language: varchar('language', { length: 50 }),       // detected input language
  outputLanguage: varchar('output_language', { length: 10 }), // 'es' | 'en'
  durationSeconds: integer('duration_seconds'),
  rawText: text('raw_text').notNull(),
  formattedText: text('formatted_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;

// Una sesión representa una grabación activa o finalizada
export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  outputLanguage: varchar('output_language', { length: 10 }).notNull().default('es'),
  status: varchar('status', { length: 20 }).notNull().default('recording'), // recording | processing | done | error
  transcriptionId: integer('transcription_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;

// Cada chunk de 1 minuto transcrito por Whisper
export const audioChunks = pgTable('audio_chunks', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  rawText: text('raw_text').notNull(),
  language: varchar('language', { length: 50 }),
  durationSeconds: integer('duration_seconds'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type AudioChunk = typeof audioChunks.$inferSelect;

// Usuarios de la aplicación
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'), // 'admin' | 'user'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
