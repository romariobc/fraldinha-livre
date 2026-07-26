import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'

export interface ProductRepository {
  list(): Promise<Product[]>                                    // publico, so active=true
  listForSupplier(): Promise<Product[]>                          // autenticado, todos do fornecedor atual
  create(req: CreateProductRequest): Promise<Product>
  update(id: string, req: UpdateProductRequest): Promise<Product>
  remove(id: string): Promise<void>
}

/** Lançado por update()/remove() quando o produto não existe. */
export class ProductNotFoundError extends Error {
  constructor(productId: string) {
    super(`Product not found: ${productId}`)
    this.name = 'ProductNotFoundError'
  }
}

/** Lançado por update()/remove() quando o produto existe mas não pertence ao fornecedor atual (403). */
export class ProductForbiddenError extends Error {
  constructor(productId: string) {
    super(`Not allowed to modify product: ${productId}`)
    this.name = 'ProductForbiddenError'
  }
}
