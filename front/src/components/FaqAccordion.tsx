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
    answer: 'Neste beta, o fornecedor atualiza as etapas de confirmação, despacho e entrega no painel. A logística é simulada; não há contratação de frete real pela plataforma.',
  },
  {
    question: 'As fraldas são originais e de qualidade garantida?',
    answer: 'Consulte as informações do produto e do fornecedor no catálogo. Este beta valida o fluxo da loja e não representa uma garantia de entrega ou certificação de produtos.',
  },
  {
    question: 'Posso cancelar ou alterar um pedido?',
    answer: 'Você pode cancelar uma compra direta enquanto ela aguarda confirmação do fornecedor. Depois disso, acompanhe o status na sua conta. O pagamento deste beta é simulado, sem cobrança ou estorno real.',
  },
  {
    question: 'Como é feito o pagamento?',
    answer: 'O checkout simula Pix ou cartão, com resultado aprovado ou recusado para validar o fluxo. Nenhuma cobrança real é feita. A integração financeira será um módulo posterior; o provedor ainda está em decisão.',
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
