import { z } from 'zod'
import { AddressSchema } from './address'

export const OrderItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  unitPrice: z.number().int().nonnegative(), // centavos
  quantity: z.number().int().positive(),
  unit: z.enum(['un', 'cx', 'kg']),
})
export type OrderItem = z.infer<typeof OrderItemSchema>

export const OrderStatusSchema = z.enum([
  'aguardando', 'ofertas-recebidas', 'aceito', 'confirmado', 'a-caminho', 'entregue', 'cancelado',
])
export type OrderStatus = z.infer<typeof OrderStatusSchema>

export const OrderSchema = z.object({
  id: z.string(),
  uid: z.string(),
  type: z.literal('compra-direta'),
  status: OrderStatusSchema,
  product: z.string(),
  quantity: z.number().int().positive(),
  unit: z.enum(['un', 'cx', 'kg']),
  price: z.number().int().nonnegative().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  deliveryAddress: AddressSchema,
  createdAt: z.string(), // ISO 8601
  items: z.array(OrderItemSchema),
})
export type Order = z.infer<typeof OrderSchema>

// Schema de lista — construido aqui (mesma instancia de zod do pacote) para que consumidores
// (ex.: front/) nunca precisem importar 'zod' diretamente so para compor z.array(OrderSchema).
export const OrderListSchema = z.array(OrderSchema)

// Body do POST /orders — o cliente NAO envia id/uid/createdAt/status (servidor define, RN-03).
// Zod ignora chaves desconhecidas por padrao (nao-strict): se o body vier com id/uid/status,
// eles sao descartados no parse — o servidor sempre usa os seus proprios valores.
export const CreateOrderRequestSchema = z.object({
  product: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.enum(['un', 'cx', 'kg']),
  price: z.number().int().nonnegative().optional(),
  supplierId: z.string().optional(),
  supplierName: z.string().optional(),
  deliveryAddress: AddressSchema,
  items: z.array(OrderItemSchema).min(1),
})
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>
