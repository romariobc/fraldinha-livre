import { z } from 'zod'

export const AddressSchema = z.object({
  logradouro: z.string().min(1),
  numero: z.string().min(1),
  complemento: z.string().optional(),
  bairro: z.string().min(1),
  cidade: z.string().min(1),
  estado: z.string().length(2),
  cep: z.string().min(1),
})
export type Address = z.infer<typeof AddressSchema>

// Validate new checkout input without rewriting historical order addresses.
export const CheckoutAddressSchema = AddressSchema.extend({
  logradouro: z.string().refine(value => value.trim().length > 0, 'Informe o logradouro.'),
  numero: z.string().refine(value => value.trim().length > 0, 'Informe o número.'),
  bairro: z.string().refine(value => value.trim().length > 0, 'Informe o bairro.'),
  cidade: z.string().refine(value => value.trim().length > 0, 'Informe a cidade.'),
  estado: z.string().regex(/^[A-Za-z]{2}$/, 'Informe a UF com duas letras.'),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, 'Informe um CEP com oito dígitos.'),
})
