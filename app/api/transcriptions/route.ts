import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';
import { desc } from 'drizzle-orm';
import Groq from 'groq-sdk';

export async function GET() {
  const db = getDb();
  const result = await db
    .select()
    .from(transcriptions)
    .orderBy(desc(transcriptions.createdAt));

  return Response.json(result);
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const { rawText, language, durationSeconds } = await request.json();

  if (!rawText) {
    return Response.json({ error: 'rawText requerido' }, { status: 400 });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Format with LLaMA (fallback to rawText on failure)
  let formattedText = rawText;
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'Eres un editor profesional de transcripciones de audio. Recibes texto en bruto generado por speech-to-text y debes formatearlo correctamente. Reglas estrictas: (1) No añadas, elimines ni cambies ninguna palabra o significado. (2) Añade puntuación correcta: puntos, comas, signos de interrogación y exclamación donde corresponda. (3) Crea párrafos cada 4-5 oraciones o cuando cambie el tema. (4) Respeta el idioma original, ya sea español o inglés. (5) Devuelve ÚNICAMENTE el texto formateado, sin ningún comentario, introducción ni conclusión.',
        },
        { role: 'user', content: rawText },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });
    formattedText = completion.choices[0]?.message?.content?.trim() || rawText;
  } catch {
    // fallback to rawText
  }

  const db = getDb();
  const [saved] = await db
    .insert(transcriptions)
    .values({ language, durationSeconds, rawText, formattedText })
    .returning();

  return Response.json({ id: saved.id, success: true });
}
