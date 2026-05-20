import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordPlain: text('password_plain').notNull().default(''),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  canManageUsers: boolean('can_manage_users').notNull().default(false),
  canManagePasswords: boolean('can_manage_passwords').notNull().default(false),
  canViewAllConversations: boolean('can_view_all_conversations').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const sessions = pgTable('sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  outputLanguage: varchar('output_language', { length: 10 }).notNull().default('es'),
  status: varchar('status', { length: 20 }).notNull().default('recording'),
  transcriptionId: integer('transcription_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Session = typeof sessions.$inferSelect;

export const audioChunks = pgTable(
  'audio_chunks',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    rawText: text('raw_text').notNull(),
    language: varchar('language', { length: 50 }),
    durationSeconds: integer('duration_seconds'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    sessionChunkIdx: uniqueIndex('audio_chunks_session_chunk_idx').on(table.sessionId, table.chunkIndex),
  })
);

export type AudioChunk = typeof audioChunks.$inferSelect;

export const transcriptions = pgTable('transcriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  sessionId: integer('session_id'),
  language: varchar('language', { length: 50 }),
  outputLanguage: varchar('output_language', { length: 10 }),
  durationSeconds: integer('duration_seconds'),
  rawText: text('raw_text').notNull(),
  formattedText: text('formatted_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;

export const pdfDocuments = pgTable(
  'pdf_documents',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id'),
    transcriptionId: integer('transcription_id').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull().default('application/pdf'),
    sizeBytes: integer('size_bytes').notNull(),
    contentBase64: text('content_base64').notNull(),
    sourceHash: varchar('source_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    transcriptionUnique: uniqueIndex('pdf_documents_transcription_unique').on(table.transcriptionId),
  })
);

export type PdfDocument = typeof pdfDocuments.$inferSelect;
