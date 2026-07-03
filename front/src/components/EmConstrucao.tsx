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
          <Construction className="w-16 h-16 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{titulo}</h1>
        <p className="text-sm text-gray-600 mb-2">Página em construção</p>
        <p className="text-gray-600 mb-8">
          Estamos preparando esta página. Volte em breve.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          ← Voltar ao início
        </Link>
      </div>
    </div>
  );
}
