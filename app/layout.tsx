import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hermes — Transcribe tus conversaciones',
  description:
    'Hermes graba conversaciones, las transcribe con IA y protege cada historial por usuario con panel privado y PDFs persistentes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
