import Link from 'next/link'

export default function AssistentePage() {
  return (
    <section className="container-fl py-8">
      <h1 className="font-display text-2xl font-bold text-brand-text">Assistente de compra</h1>
      <p className="mt-3">O assistente está indisponível nesta versão.</p>
      <Link href="/catalogo" className="mt-4 inline-block font-semibold underline">
        Abrir catálogo
      </Link>
    </section>
  )
}
