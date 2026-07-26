import { apiFetch } from '@/lib/api-client'
import type { ProductRepository } from '@/lib/ports/product-repository'
import { ProductNotFoundError, ProductForbiddenError } from '@/lib/ports/product-repository'
import type { Product, CreateProductRequest, UpdateProductRequest } from '@contracts'
import { ProductSchema, ProductListSchema } from '@contracts'

export class HttpProductRepository implements ProductRepository {
  async list(): Promise<Product[]> {
    const res = await apiFetch('/products')
    if (!res.ok) throw new Error(`Failed to list products: HTTP ${res.status}`)
    const json = await res.json()
    return ProductListSchema.parse(json)
  }

  async listForSupplier(): Promise<Product[]> {
    const res = await apiFetch('/products?scope=fornecedor')
    if (!res.ok) throw new Error(`Failed to list supplier products: HTTP ${res.status}`)
    const json = await res.json()
    return ProductListSchema.parse(json)
  }

  async create(req: CreateProductRequest): Promise<Product> {
    const res = await apiFetch('/products', { method: 'POST', body: JSON.stringify(req) })
    if (!res.ok) throw new Error(`Failed to create product: HTTP ${res.status}`)
    const json = await res.json()
    return ProductSchema.parse(json)
  }

  async update(id: string, req: UpdateProductRequest): Promise<Product> {
    const res = await apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(req) })
    if (res.status === 404) throw new ProductNotFoundError(id)
    if (res.status === 403) throw new ProductForbiddenError(id)
    if (!res.ok) throw new Error(`Failed to update product: HTTP ${res.status}`)
    const json = await res.json()
    return ProductSchema.parse(json)
  }

  async remove(id: string): Promise<void> {
    const res = await apiFetch(`/products/${id}`, { method: 'DELETE' })
    if (res.status === 404) throw new ProductNotFoundError(id)
    if (res.status === 403) throw new ProductForbiddenError(id)
    if (!res.ok) throw new Error(`Failed to remove product: HTTP ${res.status}`)
  }
}
