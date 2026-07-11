import Link from 'next/link';
import { Construction } from 'lucide-react';

interface EmConstrucaoProps {
  titulo: string;
}

export default function EmConstrucao({ titulo }: EmConstrucaoProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <Construction className="w-16 h-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-brand-text mb-2">{titulo}</h1>
        <p className="text-sm text-brand-muted mb-2">Página em construção</p>
        <p className="text-brand-muted mb-8">
          Estamos preparando esta página. Volte em breve.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          ← Voltar ao início
        </Link>
      </div>
    </div>
  );
}
