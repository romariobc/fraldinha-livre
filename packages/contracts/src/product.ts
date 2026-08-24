import { z } from 'zod'

export const ProductAtributosSchema = z.object({
  faixaPeso: z.string(),
  genero: z.literal('unissex'),
  absorcao: z.string(),
  tecnologia: z.string(),
  erpId: z.string().optional(),
})
export type ProductAtributos = z.infer<typeof ProductAtributosSchema>

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  brand: z.string().min(1),
  size: z.string().min(1),
  quantity: z.number().int().nonnegative(),
  priceCents: z.number().int().nonnegative(),
  oldPriceCents: z.number().int().nonnegative().optional().nullable(),
  supplierId: z.string(),
  slug: z.string().min(1),
  categoria: z.string().min(1),
  descricao: z.string(),
  atributos: ProductAtributosSchema,
  badge: z.string().optional(),
  active: z.boolean(),
  imageUrl: z.string().optional(),
})
export type Product = z.infer<typeof ProductSchema>
export const ProductListSchema = z.array(ProductSchema)

// Body do POST /products — servidor define id/supplierId/active, nunca vem do body.
export const CreateProductRequestSchema = ProductSchema.omit({ id: true, supplierId: true, active: true })
export type CreateProductRequest = z.infer<typeof CreateProductRequestSchema>

// Body do PUT /products/:id — tudo opcional exceto o que muda; inclui `active`
// (única forma de editar despublicar/republicar).
export const UpdateProductRequestSchema = CreateProductRequestSchema.partial().extend({
  active: z.boolean().optional(),
})
export type UpdateProductRequest = z.infer<typeof UpdateProductRequestSchema>
