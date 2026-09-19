import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'

export interface ProductRepository {
  list(): Promise<Product[]>                                    // publico, so active=true
  listForSupplier(): Promise<Product[]>                          // autenticado, todos do fornecedor atual
  create(req: CreateProductRequest): Promise<Product>
  update(id: string, req: UpdateProductRequest): Promise<Product>
  remove(id: string): Promise<void>
}

export interface DomainErrorOptions {
  requestId?: string
  cause?: unknown
}

/** Lançado por update()/remove() quando o produto não existe. */
export class ProductNotFoundError extends Error {
  public readonly code = 'PRODUCT_NOT_FOUND' as const
  public readonly requestId?: string
  constructor(productId: string, options?: DomainErrorOptions) {
    super(`Product not found: ${productId}`, { cause: options?.cause })
    this.name = 'ProductNotFoundError'
    this.requestId = options?.requestId
  }
}

/** Lançado por update()/remove() quando o produto existe mas não pertence ao fornecedor atual (403). */
export class ProductForbiddenError extends Error {
  public readonly code = 'FORBIDDEN' as const
  public readonly requestId?: string
  constructor(productId: string, options?: DomainErrorOptions) {
    super(`Not allowed to modify product: ${productId}`, { cause: options?.cause })
    this.name = 'ProductForbiddenError'
    this.requestId = options?.requestId
  }
}
