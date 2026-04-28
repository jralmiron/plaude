import { pgTable, serial, text, integer, timestamp, varchar } from 'drizzle-orm/pg-core';

export const transcriptions = pgTable('transcriptions', {
  id: serial('id').primaryKey(),
  language: varchar('language', { length: 50 }),
  durationSeconds: integer('duration_seconds'),
  rawText: text('raw_text').notNull(),
  formattedText: text('formatted_text').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;
