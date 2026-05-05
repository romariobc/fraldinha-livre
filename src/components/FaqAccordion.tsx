'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FAQ_ITEMS = [
  {
    question: 'Quais tamanhos de fraldas vocês oferecem?',
    answer: 'Oferecemos fraldas do tamanho RN (recém-nascido) ao XXG, das principais marcas do mercado. O catálogo é atualizado constantemente pelos nossos fornecedores parceiros.',
  },
  {
    question: 'Como funciona a entrega?',
    answer: 'A entrega é realizada diretamente pelo fornecedor que aceitou seu pedido. O prazo e método são informados no momento da confirmação, antes do pagamento.',
  },
  {
    question: 'As fraldas são originais e de qualidade garantida?',
    answer: 'Sim! Todos os fornecedores passam por um processo de verificação antes de entrar na plataforma. Só trabalhamos com produtos originais e com nota fiscal.',
  },
  {
    question: 'Posso cancelar ou alterar um pedido?',
    answer: 'Você pode cancelar o pedido antes do pagamento a qualquer momento. Após o pagamento, entre em contato — avaliamos caso a caso com o fornecedor.',
  },
  {
    question: 'Como é feito o pagamento?',
    answer: 'Aceitamos cartão de crédito, PIX e boleto via Mercado Pago. O pagamento é processado com total segurança e repassado ao fornecedor após confirmação da entrega.',
  },
]

export default function FaqAccordion() {
  return (
    <Accordion defaultValue={['item-0']} className="flex flex-col gap-2.5">
      {FAQ_ITEMS.map((item, i) => (
        <AccordionItem
          key={i}
          value={`item-${i}`}
          className="bg-white rounded-xl border-none shadow-sm overflow-hidden"
        >
          <AccordionTrigger className="px-6 py-4 font-display font-bold text-sm text-brand-text text-left hover:text-primary-dark hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4 text-sm text-brand-muted leading-relaxed">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
