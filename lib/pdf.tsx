import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { Transcription } from './schema';

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logo: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: '#4f46e5',
  },
  tagline: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    marginTop: 18,
    marginBottom: 24,
  },
  metaItem: {
    marginRight: 32,
  },
  metaLabel: {
    fontSize: 8,
    color: '#9ca3af',
  },
  metaValue: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#9ca3af',
    marginBottom: 10,
    letterSpacing: 1,
  },
  content: {
    fontSize: 11,
    lineHeight: 1.8,
    color: '#374151',
    fontFamily: 'Helvetica',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 48,
    right: 48,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
});

const LANGUAGE_MAP: Record<string, string> = {
  spanish: 'Español',
  english: 'English',
  es: 'Español',
  en: 'English',
};

function formatLanguage(lang: string | null): string {
  if (!lang) return '--';
  return LANGUAGE_MAP[lang.toLowerCase()] ?? lang;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PdfDocument({ transcription }: { transcription: Transcription }) {
  return (
    <Document
      title={`Transcripción — ${formatDate(transcription.createdAt)}`}
      author="plaude"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.logo}>plaude</Text>
          <Text style={styles.tagline}>Transcripción de audio</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>FECHA</Text>
            <Text style={styles.metaValue}>{formatDate(transcription.createdAt)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>IDIOMA</Text>
            <Text style={styles.metaValue}>{formatLanguage(transcription.language)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>DURACIÓN</Text>
            <Text style={styles.metaValue}>{formatDuration(transcription.durationSeconds)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>TRANSCRIPCIÓN</Text>
        <Text style={styles.content}>{transcription.formattedText}</Text>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Generado con plaude</Text>
          <Text style={styles.footerText}>{formatDate(transcription.createdAt)}</Text>
        </View>
      </Page>
    </Document>
  );
}
