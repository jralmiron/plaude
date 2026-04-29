/**
 * Test de funcionamiento completo de Plaude
 * Verifica: BD (Neon) · API REST · PDF · Groq API key
 *
 * Uso: node scripts/test-flow.mjs
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASE = 'http://localhost:3000';
const SEP = '─'.repeat(50);

let passed = 0;
let failed = 0;

function ok(msg) {
  console.log(`  ✓  ${msg}`);
  passed++;
}

function fail(msg, detail = '') {
  console.log(`  ✗  ${msg}${detail ? ` → ${detail}` : ''}`);
  failed++;
}

function section(title) {
  console.log(`\n${SEP}\n  ${title}\n${SEP}`);
}

function getNeonUrl() {
  let url = (process.env.DATABASE_URL ?? '').trim().replace(/^["']|["']$/g, '');
  url = url.replace(/^postgresql:postgresql:\/\//, 'postgresql://');
  url = url.replace(/^postgres:postgres:\/\//, 'postgresql://');
  if (url.startsWith('postgres://')) url = 'postgresql://' + url.slice('postgres://'.length);
  return url;
}

// ── 1. ENV VARS ─────────────────────────────────────────────────────────────
section('1 · Variables de entorno');

const envVars = ['GROQ_API_KEY', 'DATABASE_URL', 'BLOB_READ_WRITE_TOKEN'];
for (const v of envVars) {
  if (process.env[v]) ok(`${v} configurada`);
  else fail(`${v} no encontrada en .env.local`);
}

// ── 2. SERVIDOR NEXT.JS ──────────────────────────────────────────────────────
section('2 · Servidor Next.js (localhost:3000)');

try {
  const res = await fetch(`${BASE}/`);
  if (res.ok) ok(`GET / → ${res.status}`);
  else fail(`GET /`, `HTTP ${res.status}`);
} catch (e) {
  fail('No se puede conectar al servidor', e.message);
  console.log('\n  → Asegúrate de que "npm run dev" está en marcha\n');
  process.exit(1);
}

// ── 3. BASE DE DATOS (GET /api/transcriptions) ───────────────────────────────
section('3 · Base de datos — GET /api/transcriptions');

let initialCount = 0;
try {
  const res = await fetch(`${BASE}/api/transcriptions`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  initialCount = data.length;
  ok(`Conexión a Neon DB correcta (${initialCount} transcripciones existentes)`);
} catch (e) {
  fail('Error al consultar la BD', e.message);
}

// ── 4. GROQ API KEY ──────────────────────────────────────────────────────────
section('4 · Groq API — validación de clave');

try {
  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { data } = await res.json();
  const whisper = data.find((m) => m.id.includes('whisper'));
  const llama = data.find((m) => m.id.includes('llama-3.3-70b'));
  if (whisper) ok(`Modelo Whisper disponible: ${whisper.id}`);
  else fail('Whisper no encontrado en los modelos disponibles');
  if (llama) ok(`Modelo LLaMA disponible: ${llama.id}`);
  else fail('llama-3.3-70b no encontrado');
} catch (e) {
  fail('Error al validar Groq API key', e.message);
}

// ── 5. INSERCIÓN DIRECTA EN BD (simulando resultado de transcripción) ────────
section('5 · Inserción y recuperación de transcripción de prueba');

let testId = null;

try {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(getNeonUrl());

  // Insertar con SQL nativo para evitar imports TypeScript
  const rows = await sql`
    INSERT INTO transcriptions (language, duration_seconds, raw_text, formatted_text)
    VALUES ('es', 5, 'Esta es una prueba de funcionamiento del sistema plaude.', 'Esta es una prueba de funcionamiento del sistema plaude.')
    RETURNING id
  `;
  testId = rows[0].id;
  ok(`Registro insertado en BD con id=${testId}`);

  // Verificar que aparece en la API
  const res = await fetch(`${BASE}/api/transcriptions`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const list = await res.json();
  const found = list.find((t) => t.id === testId);
  if (found) ok(`Registro recuperado correctamente via GET /api/transcriptions`);
  else fail('El registro insertado no aparece en la API');
} catch (e) {
  fail('Error en inserción directa a BD', e.message);
}

// ── 6. GENERACIÓN DE PDF ─────────────────────────────────────────────────────
section('6 · Generación de PDF');

if (testId) {
  try {
    const res = await fetch(`${BASE}/api/transcriptions/${testId}/pdf`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = res.headers.get('content-type');
    const buffer = await res.arrayBuffer();
    if (contentType?.includes('pdf') && buffer.byteLength > 1000) {
      ok(`PDF generado correctamente (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
    } else {
      fail('PDF generado pero parece inválido', `content-type: ${contentType}, size: ${buffer.byteLength}`);
    }
  } catch (e) {
    fail('Error al generar PDF', e.message);
  }
}

// ── 7. LIMPIEZA ──────────────────────────────────────────────────────────────
section('7 · Limpieza');

if (testId) {
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(getNeonUrl());
    await sql`DELETE FROM transcriptions WHERE id = ${testId}`;
    ok(`Registro de prueba (id=${testId}) eliminado`);
  } catch (e) {
    fail('Error al limpiar el registro de prueba', e.message);
  }
}

// ── RESUMEN ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`  RESULTADO: ${passed} pasados · ${failed} fallidos`);
console.log(`${'═'.repeat(50)}\n`);
